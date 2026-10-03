import { dashboardSchema } from '@f1-live/shared/dashboard';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { registerFakePages } from '../payments/fake-pages.js';
import {
	BILLING_INTERVALS,
	PaymentProviderError,
	WebhookSignatureError
} from '../payments/provider.js';
import { deleteAccount, exportAccount } from './account-data.js';
import { type Accounts, WEBHOOK_PATH } from './accounts.js';
import { applyWebhook } from './billing.js';
import { listDocuments, type WriteOutcome, writeDocument } from './dashboards.js';
import { customerOf, isLive, planFor, subscriptionsOf } from './entitlements.js';

/** A dashboard document is a few kilobytes; this leaves room and stops abuse. */
const DASHBOARD_BODY_LIMIT = 256 * 1024;

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Better Auth checks its own origins (and Apple posts back from its own); webhooks are signed. */
const OWN_ORIGIN_CHECK = ['/api/auth/', WEBHOOK_PATH];

const dashboardParams = z.object({ id: z.string().min(1).max(64) });

const versioned = { baseVersion: z.int().min(0), updatedAt: z.iso.datetime() };

const putBody = z.object({ dashboard: dashboardSchema, ...versioned });

const deleteBody = z.object(versioned);

const checkoutBody = z.object({ interval: z.enum(BILLING_INTERVALS) });

const deleteAccountBody = z.object({ confirm: z.string() });

const mailboxQuery = z.object({ to: z.email() });

/** Raw request bodies, for Better Auth and for webhook signatures. */
const rawBody = z.string().optional();

class HttpError extends Error {
	readonly status: number;
	readonly code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

/**
 * The accounts API under `/api`: Better Auth at `/api/auth/*`, the signed-in viewer at
 * `/api/me`, their dashboards, billing and the payment webhook. Cookies carry the session, so
 * state-changing requests from a browser must come from a trusted origin.
 */
export async function registerAccounts(app: FastifyInstance, accounts: Accounts): Promise<void> {
	const { config, db, auth, payments, log, now } = accounts;

	const signedIn = async (request: FastifyRequest) => {
		const found = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });

		if (!found) {
			throw new HttpError(401, 'unauthorized', 'Sign in first');
		}

		return found.user;
	};

	await app.register(async (scope) => {
		scope.setErrorHandler((error: FastifyError, _request, reply) => {
			if (error instanceof HttpError) {
				return reply.code(error.status).send({ error: error.code, message: error.message });
			}

			if (error instanceof z.ZodError) {
				return reply.code(400).send({ error: 'invalid', message: z.prettifyError(error) });
			}

			if (error instanceof WebhookSignatureError) {
				return reply.code(400).send({ error: 'bad_signature', message: error.message });
			}

			if (error instanceof PaymentProviderError) {
				log('payment-provider-error', { message: error.message });

				return reply
					.code(502)
					.send({ error: 'provider_error', message: 'The payment provider did not answer' });
			}

			if (error.statusCode && error.statusCode < 500) {
				return reply.code(error.statusCode).send({ error: 'invalid', message: error.message });
			}

			log('accounts-error', { message: error.message });

			return reply.code(500).send({ error: 'internal', message: 'Something went wrong' });
		});

		scope.addHook('onRequest', async (request, reply) => {
			const origin = request.headers.origin;

			if (
				STATE_CHANGING.has(request.method) &&
				origin !== undefined &&
				!config.trustedOrigins.includes(origin) &&
				!OWN_ORIGIN_CHECK.some((prefix) => request.url.startsWith(prefix))
			) {
				return reply.code(403).send({ error: 'bad_origin', message: 'Origin not allowed' });
			}
		});

		await scope.register(async (raw) => {
			raw.removeAllContentTypeParsers();
			raw.addContentTypeParser('*', { parseAs: 'string' }, (_request, body, done) =>
				done(null, body)
			);

			raw.route({
				method: ['GET', 'POST'],
				url: '/api/auth/*',
				handler: (request, reply) => forwardToAuth(accounts, request, reply)
			});

			raw.post(WEBHOOK_PATH, async (request, reply) => {
				const notice = await payments.parseWebhook(
					rawBody.parse(request.body) ?? '',
					request.headers
				);

				if (notice) {
					await applyWebhook(db, payments, notice, log);
				}

				return reply.send({ received: true });
			});
		});

		scope.get('/api/config', async (_request, reply) =>
			reply.send({
				brand: config.brand,
				providers: { google: config.social.google !== null, apple: config.social.apple !== null },
				devMailbox: accounts.devMailbox !== null,
				payments: { provider: payments.name, prices: await payments.prices() }
			})
		);

		// Signed out is an answer, not an error: every visitor asks, so it is never a 401.
		scope.get('/api/me', async (request, reply) => {
			const { headers, response: session } = await auth.api.getSession({
				headers: fromNodeHeaders(request.headers),
				returnHeaders: true
			});

			// Using the app slides the session forward; the renewed cookie rides on this answer.
			const renewed = headers.getSetCookie();

			if (renewed.length > 0) {
				reply.header('set-cookie', renewed);
			}

			if (!session) {
				return reply.type('application/json').send('null');
			}

			const { user } = session;
			const records = await subscriptionsOf(db, user.id);
			const { plan, entitlements, subscription } = planFor(records, now());

			return reply.send({
				user: {
					id: user.id,
					email: user.email,
					name: user.name,
					createdAt: user.createdAt.toISOString()
				},
				plan,
				entitlements,
				subscription: subscription && {
					status: subscription.status,
					interval: subscription.interval,
					currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
					cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
				},
				billing: { portal: customerOf(records, payments.name) !== null }
			});
		});

		scope.get('/api/me/dashboards', async (request, reply) => {
			const user = await signedIn(request);

			return reply.send({ documents: await listDocuments(db, user.id) });
		});

		scope.put(
			'/api/me/dashboards/:id',
			{ bodyLimit: DASHBOARD_BODY_LIMIT },
			async (request, reply) => {
				const user = await signedIn(request);
				const { id } = dashboardParams.parse(request.params);
				const body = putBody.parse(request.body);

				if (body.dashboard.id !== id) {
					throw new HttpError(400, 'invalid', 'The dashboard id does not match the address');
				}

				const { entitlements } = planFor(await subscriptionsOf(db, user.id), now());

				const outcome = await writeDocument(
					db,
					user.id,
					entitlements,
					{
						id,
						dashboard: body.dashboard,
						baseVersion: body.baseVersion,
						updatedAt: new Date(body.updatedAt)
					},
					now()
				);

				return sendOutcome(reply, outcome);
			}
		);

		scope.delete('/api/me/dashboards/:id', async (request, reply) => {
			const user = await signedIn(request);
			const { id } = dashboardParams.parse(request.params);
			const body = deleteBody.parse(request.body);
			const { entitlements } = planFor(await subscriptionsOf(db, user.id), now());

			const outcome = await writeDocument(
				db,
				user.id,
				entitlements,
				{ id, dashboard: null, baseVersion: body.baseVersion, updatedAt: new Date(body.updatedAt) },
				now()
			);

			return sendOutcome(reply, outcome);
		});

		scope.get('/api/me/export', async (request, reply) => {
			const user = await signedIn(request);
			const exported = await exportAccount(db, user.id, now());
			const day = now().toISOString().slice(0, 10);
			const slug = config.brand.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');

			return reply
				.header('content-disposition', `attachment; filename="${slug}-account-${day}.json"`)
				.header('cache-control', 'no-store')
				.send(exported);
		});

		scope.delete('/api/me', async (request, reply) => {
			const user = await signedIn(request);
			const { confirm } = deleteAccountBody.parse(request.body);

			if (confirm.trim().toLowerCase() !== user.email.toLowerCase()) {
				throw new HttpError(400, 'confirm_mismatch', 'Type the email address of this account');
			}

			await deleteAccount(db, payments, user.id, now());
			log('account-deleted', { user: user.id });

			// The session went with the account; this only clears the cookie.
			const signedOut = await auth.api.signOut({
				headers: fromNodeHeaders(request.headers),
				asResponse: true
			});

			return reply.header('set-cookie', signedOut.headers.getSetCookie()).send({ deleted: true });
		});

		scope.post('/api/billing/checkout', async (request, reply) => {
			const user = await signedIn(request);
			const { interval } = checkoutBody.parse(request.body);
			const records = await subscriptionsOf(db, user.id);

			if (records.some((record) => isLive(record, now()))) {
				throw new HttpError(409, 'already_pro', 'This account is already on Pro');
			}

			const checkout = await payments.createCheckout({
				userId: user.id,
				email: user.email,
				interval,
				customerId: customerOf(records, payments.name),
				successUrl: `${config.appUrl}/account?checkout=success`,
				cancelUrl: `${config.appUrl}/account?checkout=cancelled`
			});

			return reply.send(checkout);
		});

		scope.post('/api/billing/portal', async (request, reply) => {
			const user = await signedIn(request);
			const customerId = customerOf(await subscriptionsOf(db, user.id), payments.name);

			if (!customerId) {
				throw new HttpError(404, 'no_billing_account', 'This account has never paid');
			}

			return reply.send(
				await payments.createPortal({ customerId, returnUrl: `${config.appUrl}/account` })
			);
		});

		const { fakePayments, devMailbox } = accounts;

		if (fakePayments) {
			await scope.register(async (pages) => registerFakePages(pages, fakePayments, config.brand));
		}

		if (devMailbox) {
			scope.get('/api/dev/mailbox', async (request, reply) => {
				const { to } = mailboxQuery.parse(request.query);
				const link = devMailbox.lastLink(to);

				if (!link) {
					throw new HttpError(404, 'not_found', 'No sign-in link for that address yet');
				}

				return reply.send({ link });
			});
		}
	});
}

function sendOutcome(reply: FastifyReply, outcome: WriteOutcome) {
	switch (outcome.kind) {
		case 'saved':
			return reply.send({ document: outcome.document });
		case 'stale':
			return reply.code(409).send({
				error: 'stale',
				message: 'Another device changed this dashboard more recently',
				document: outcome.document
			});
		case 'limit':
			return reply.code(403).send({
				error: 'dashboard_limit',
				message: `Free keeps ${outcome.limit} dashboards of your own`,
				limit: outcome.limit
			});
		case 'too-many':
			return reply.code(403).send({
				error: 'too_many_dashboards',
				message: `An account keeps at most ${outcome.limit} dashboards`,
				limit: outcome.limit
			});
	}
}

/** Hands a request to Better Auth as a web Request and writes its Response back. */
async function forwardToAuth(accounts: Accounts, request: FastifyRequest, reply: FastifyReply) {
	const body = request.method === 'GET' ? undefined : rawBody.parse(request.body);

	const response = await accounts.auth.handler(
		new Request(new URL(request.url, accounts.config.publicUrl), {
			method: request.method,
			headers: fromNodeHeaders(request.headers),
			body
		})
	);

	reply.code(response.status);

	for (const [name, value] of response.headers) {
		if (name !== 'set-cookie' && name !== 'content-length') {
			reply.header(name, value);
		}
	}

	const cookies = response.headers.getSetCookie();

	if (cookies.length > 0) {
		reply.header('set-cookie', cookies);
	}

	return reply.send(Buffer.from(await response.arrayBuffer()));
}
