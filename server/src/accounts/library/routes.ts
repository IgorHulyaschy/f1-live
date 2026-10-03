import { LIBRARY_SORTS, publishBodySchema, REPORT_REASONS } from '@f1-live/shared/library';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { User } from 'better-auth';
import { z } from 'zod';

import type { Accounts } from '../accounts.js';
import { planFor, subscriptionsOf } from '../entitlements.js';
import { HttpError } from '../http-error.js';
import {
	claimHandle,
	getEntry,
	handleAvailability,
	handleOf,
	listEntries,
	listMine,
	listTags,
	publish,
	recordAdd,
	report,
	unpublish,
	type LibraryPolicy
} from './entries.js';

/** A dashboard document is a few kilobytes; this leaves room for a description and stops abuse. */
const PUBLISH_BODY_LIMIT = 256 * 1024;

const idParams = z.object({ id: z.string().min(1).max(64) });

const listQuery = z.object({
	q: z.string().max(80).default(''),
	tag: z.string().max(40).default(''),
	sort: z.enum(LIBRARY_SORTS).default('popular'),
	page: z.coerce.number().int().min(0).max(1000).default(0)
});

const reportBody = z.object({ reason: z.enum(REPORT_REASONS) });

const handleBody = z.object({ handle: z.string().max(40) });

const handleQuery = z.object({ handle: z.string().max(40) });

/** What the user is told for each refusal of a handle. */
const HANDLE_MESSAGES = {
	format: 'Use 3 to 20 lower-case letters, digits or underscores, starting with a letter',
	reserved: 'That name is kept for the team',
	profanity: 'Pick a name that is fine to put on a dashboard in front of everyone'
} as const;

/**
 * The fan library under `/api`: browsing is public; publishing, a handle, adding (counted) and
 * reports need an account, and publishing needs Pro. Moderation settings are the owner's, from the
 * environment (accounts/config.ts).
 */
export function registerLibrary(
	scope: FastifyInstance,
	accounts: Accounts,
	signedIn: (request: FastifyRequest) => Promise<User>,
	viewerOf: (request: FastifyRequest) => Promise<User | null>
): void {
	const { db, now } = accounts;

	const policy: LibraryPolicy = {
		reservedHandles: accounts.config.moderation.reservedHandles,
		blockedWords: accounts.config.moderation.blockedWords,
		reportsToHide: accounts.config.moderation.reportsToHide,
		maxPublished: accounts.config.moderation.maxPublished
	};

	scope.get('/api/library', async (request, reply) => {
		const viewer = await viewerOf(request);
		const query = listQuery.parse(request.query);

		return reply.send({
			...(await listEntries(db, query, viewer?.id ?? null)),
			tags: query.page === 0 ? await listTags(db) : []
		});
	});

	scope.get('/api/library/:id', async (request, reply) => {
		const viewer = await viewerOf(request);
		const { id } = idParams.parse(request.params);
		const entry = await getEntry(db, id, viewer?.id ?? null);

		if (!entry) {
			throw new HttpError(404, 'not_found', 'There is no such dashboard in the library');
		}

		return reply.send({ entry });
	});

	scope.get('/api/me/library', async (request, reply) => {
		const user = await signedIn(request);

		return reply.send({ entries: await listMine(db, user.id) });
	});

	scope.post('/api/library', { bodyLimit: PUBLISH_BODY_LIMIT }, async (request, reply) => {
		const user = await signedIn(request);
		const body = publishBodySchema.parse(request.body);
		const { entitlements } = planFor(await subscriptionsOf(db, user.id), now());

		if (!entitlements.publish) {
			throw new HttpError(403, 'publish_needs_pro', 'Publishing to the library is part of Pro');
		}

		const outcome = await publish(db, user.id, body, policy);

		switch (outcome.kind) {
			case 'needs-handle':
				throw new HttpError(409, 'handle_required', 'Choose a handle to sign your dashboards');
			case 'rejected':
				throw new HttpError(
					422,
					'not_allowed',
					`The ${outcome.field === 'name' ? 'dashboard name' : outcome.field} cannot be published as written`,
					{ field: outcome.field }
				);
			case 'too-many':
				throw new HttpError(
					403,
					'too_many_published',
					`At most ${outcome.limit} dashboards can be published at once`,
					{ limit: outcome.limit }
				);
			case 'published':
				return reply.code(outcome.created ? 201 : 200).send({ entry: outcome.entry });
		}
	});

	scope.delete('/api/library/:id', async (request, reply) => {
		const user = await signedIn(request);
		const { id } = idParams.parse(request.params);

		// Someone else's entry looks the same as none: no hint what exists.
		if (!(await unpublish(db, user.id, id))) {
			throw new HttpError(404, 'not_found', 'You have not published that dashboard');
		}

		return reply.send({ removed: true });
	});

	scope.post('/api/library/:id/add', async (request, reply) => {
		const user = await signedIn(request);
		const { id } = idParams.parse(request.params);
		const adds = await recordAdd(db, user.id, id);

		if (adds === null) {
			throw new HttpError(404, 'not_found', 'There is no such dashboard in the library');
		}

		return reply.send({ adds });
	});

	scope.post('/api/library/:id/report', async (request, reply) => {
		const user = await signedIn(request);
		const { id } = idParams.parse(request.params);
		const { reason } = reportBody.parse(request.body);
		const outcome = await report(db, user.id, id, reason, policy);

		switch (outcome.kind) {
			case 'not-found':
				throw new HttpError(404, 'not_found', 'There is no such dashboard in the library');
			case 'own':
				throw new HttpError(400, 'own_entry', 'Unpublish your own dashboard instead');
			case 'already':
				return reply.send({ reported: true, already: true });
			case 'reported':
				accounts.log('library-report', { entry: id, hidden: outcome.hidden ? 1 : 0 });

				return reply.send({ reported: true, already: false });
		}
	});

	scope.get('/api/me/handle', async (request, reply) => {
		const user = await signedIn(request);

		return reply.send({ handle: await handleOf(db, user.id) });
	});

	scope.get('/api/me/handle/check', async (request, reply) => {
		await signedIn(request);

		const { handle } = handleQuery.parse(request.query);

		return reply.send({ result: await handleAvailability(db, handle, policy) });
	});

	scope.put('/api/me/handle', async (request, reply) => {
		const user = await signedIn(request);
		const { handle } = handleBody.parse(request.body);
		const outcome = await claimHandle(db, user.id, handle, policy);

		switch (outcome.kind) {
			case 'claimed':
				return reply.send({ handle: outcome.handle });
			case 'rejected':
				throw new HttpError(422, `handle_${outcome.reason}`, HANDLE_MESSAGES[outcome.reason]);
			case 'taken':
				throw new HttpError(409, 'handle_taken', 'Someone already has that handle');
			case 'already-set':
				throw new HttpError(409, 'handle_set', 'Your handle is already chosen and stays as it is', {
					handle: outcome.handle
				});
		}
	});
}
