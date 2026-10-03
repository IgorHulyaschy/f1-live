import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { LIBRARY_PAGE_SIZE } from '@f1-live/shared/library';
import { z } from 'zod';

import type { LiveServer } from '../../main.js';
import { board, callerOf, goPro, signInWith, startAccountsServer } from '../test-support.js';

let server: LiveServer;

before(async () => {
	server = await startAccountsServer({
		LIBRARY_REPORTS_TO_HIDE: '3',
		LIBRARY_BLOCKED_WORDS: 'tifosi'
	});
});

after(async () => {
	await server.close();
});

const call = (...args: Parameters<ReturnType<typeof callerOf>>) => callerOf(server)(...args);

const signIn = signInWith(call);

const listing = z.object({
	entries: z.array(z.object({ id: z.string(), author: z.string().nullable(), adds: z.number() })),
	hasMore: z.boolean(),
	tags: z.array(z.string())
});

const entryReply = z.object({
	entry: z.object({
		id: z.string(),
		author: z.string().nullable(),
		mine: z.boolean(),
		hidden: z.boolean(),
		adds: z.number(),
		description: z.string(),
		dashboard: z.object({ id: z.string(), name: z.string() })
	})
});

const errorReply = z.object({ error: z.string() }).loose();

/** An account with a handle and, when asked, Pro. */
async function fan(
	name: string,
	{ pro = true, handle = name }: { pro?: boolean; handle?: string | null } = {}
) {
	const cookie = await signIn(`${name}@example.test`);

	if (pro) {
		await goPro(call, cookie);
	}

	if (handle) {
		const claimed = await call('PUT', '/api/me/handle', { cookie, body: { handle } });

		assert.equal(claimed.status, 200, claimed.body);
	}

	return cookie;
}

const search = async (query: string) =>
	listing.parse((await call('GET', `/api/library?${query}`)).json()).entries;

const publishBody = (id: string, name = `Board ${id}`, description = 'A dashboard.') => ({
	dashboard: board(id, name),
	description,
	tags: ['Race day']
});

async function publishAs(cookie: string, id: string, name?: string): Promise<string> {
	const reply = await call('POST', '/api/library', { cookie, body: publishBody(id, name) });

	assert.ok(reply.status === 200 || reply.status === 201, reply.body);

	return entryReply.parse(reply.json()).entry.id;
}

describe('browsing', () => {
	it('is open to anyone and starts with the examples, marked as such', async () => {
		const reply = await call('GET', '/api/library');

		assert.equal(reply.status, 200);

		const { entries, tags } = listing.parse(reply.json());

		assert.equal(entries.length, 6);
		assert.ok(entries.every((entry) => entry.author === null && entry.id.startsWith('example-')));
		assert.ok(tags.includes('strategy'));
	});

	it('searches names, descriptions, handles and tags, filters by tag and sorts', async () => {
		const cookie = await fan('searcher');

		await publishAs(cookie, 'board-q1', 'Qualifying lab');

		assert.equal((await search('q=qualifying')).length, 1);
		assert.equal((await search('q=searcher')).length, 1, 'by handle');
		assert.equal((await search('q=undercut')).length, 1, 'by description of an example');
		assert.equal((await search('q=minimal')).length, 1, 'by tag of an example');
		assert.equal(
			(await search('q=%25')).length,
			0,
			'a percent sign is searched for, not a wildcard'
		);
		assert.equal((await search('tag=strategy')).length, 1);
		assert.equal((await search('tag=STRATEGY')).length, 1);

		const newest = await search('sort=new');

		assert.equal(newest[0]?.author, 'searcher');
		assert.equal(newest.length <= LIBRARY_PAGE_SIZE, true);
	});

	it('shows one entry, or says there is none', async () => {
		assert.equal((await call('GET', '/api/library/example-tv-wall')).status, 200);
		assert.equal((await call('GET', '/api/library/nope')).status, 404);
	});
});

describe('handles', () => {
	it('are chosen once, unique, and checked against the rules', async () => {
		const cookie = await signIn('chooser@example.test');

		const refused = async (handle: string) => {
			const reply = await call('PUT', '/api/me/handle', { cookie, body: { handle } });

			return [reply.status, errorReply.parse(reply.json()).error] as const;
		};

		assert.deepEqual(await refused('ab'), [422, 'handle_format']);
		assert.deepEqual(await refused('pitwall_news'), [422, 'handle_reserved']);
		assert.deepEqual(await refused('sh1t_lord'), [422, 'handle_profanity']);
		assert.deepEqual(await refused('tifosi_one'), [422, 'handle_profanity'], 'the owner’s list');

		const first = await call('PUT', '/api/me/handle', {
			cookie,
			body: { handle: ' @Chooser_One ' }
		});

		assert.deepEqual(first.json(), { handle: 'chooser_one' });
		assert.deepEqual(await refused('another_one'), [409, 'handle_set']);

		const other = await signIn('chooser2@example.test');

		const taken = await call('PUT', '/api/me/handle', {
			cookie: other,
			body: { handle: 'CHOOSER_ONE' }
		});

		assert.equal(taken.status, 409);
		assert.equal(errorReply.parse(taken.json()).error, 'handle_taken');

		const check = (handle: string) =>
			call('GET', `/api/me/handle/check?handle=${handle}`, { cookie: other });

		assert.deepEqual((await check('chooser_one')).json(), { result: 'taken' });
		assert.deepEqual((await check('free_name')).json(), { result: 'available' });
		assert.deepEqual((await check('admin')).json(), { result: 'reserved' });

		const me = z
			.object({ handle: z.string().nullable() })
			.parse((await call('GET', '/api/me', { cookie })).json());

		assert.equal(me.handle, 'chooser_one');
		assert.equal((await call('PUT', '/api/me/handle', { body: { handle: 'nobody' } })).status, 401);
	});
});

describe('publishing', () => {
	it('needs an account, Pro and a handle', async () => {
		const body = publishBody('board-1');

		assert.equal((await call('POST', '/api/library', { body })).status, 401);

		const free = await fan('freebie', { pro: false });
		const refused = await call('POST', '/api/library', { cookie: free, body });

		assert.equal(refused.status, 403);
		assert.equal(errorReply.parse(refused.json()).error, 'publish_needs_pro');

		const nameless = await fan('nameless', { handle: null });
		const needs = await call('POST', '/api/library', { cookie: nameless, body });

		assert.equal(needs.status, 409);
		assert.equal(errorReply.parse(needs.json()).error, 'handle_required');
	});

	it('lists the dashboard under the author’s handle, and publishing it again replaces it', async () => {
		const cookie = await fan('author');
		const id = await publishAs(cookie, 'board-1', 'First cut');

		const again = await call('POST', '/api/library', {
			cookie,
			body: publishBody('board-1', 'Second cut')
		});

		assert.equal(again.status, 200, 'an update, not a new entry');
		assert.equal(entryReply.parse(again.json()).entry.id, id);

		const shown = entryReply.parse((await call('GET', `/api/library/${id}`, { cookie })).json());

		assert.equal(shown.entry.author, 'author');
		assert.equal(shown.entry.mine, true);
		assert.equal(shown.entry.dashboard.name, 'Second cut');

		const stranger = entryReply.parse((await call('GET', `/api/library/${id}`)).json());

		assert.equal(stranger.entry.mine, false);

		const mine = z
			.object({ entries: z.array(z.object({ id: z.string() })) })
			.parse((await call('GET', '/api/me/library', { cookie })).json());

		assert.deepEqual(
			mine.entries.map((entry) => entry.id),
			[id]
		);
	});

	it('refuses names, descriptions and tags that break the rules, and too many at once', async () => {
		const cookie = await fan('careful');

		const post = (body: ReturnType<typeof publishBody>) =>
			call('POST', '/api/library', { cookie, body });

		const dirty = async (body: ReturnType<typeof publishBody>) => {
			const reply = await post(body);

			return [reply.status, z.object({ field: z.string() }).parse(reply.json()).field] as const;
		};

		assert.deepEqual(await dirty(publishBody('b1', 'Total shit')), [422, 'name']);
		assert.deepEqual(await dirty(publishBody('b1', 'Fine', 'what the fuck')), [422, 'description']);
		assert.deepEqual(await dirty({ ...publishBody('b1'), tags: ['porn'] }), [422, 'tags']);
		assert.equal(
			(await post({ ...publishBody('b1'), tags: ['a', 'b', 'c', 'd', 'e'] })).status,
			400
		);
		assert.equal((await post({ ...publishBody('b1'), description: 'x'.repeat(201) })).status, 400);
	});

	it('takes an entry out for its author only', async () => {
		const owner = await fan('owner');
		const intruder = await fan('intruder');
		const id = await publishAs(owner, 'board-1');

		assert.equal((await call('DELETE', `/api/library/${id}`, { cookie: intruder })).status, 404);
		assert.equal((await call('GET', `/api/library/${id}`)).status, 200);
		assert.equal((await call('DELETE', `/api/library/${id}`, { cookie: owner })).status, 200);
		assert.equal((await call('GET', `/api/library/${id}`)).status, 404);
	});
});

describe('publishing the same dashboard twice at once', () => {
	it('updates one entry instead of failing', async () => {
		const cookie = await fan('racer');

		const replies = await Promise.all([
			call('POST', '/api/library', { cookie, body: publishBody('board-1', 'Race one') }),
			call('POST', '/api/library', { cookie, body: publishBody('board-1', 'Race two') })
		]);

		assert.deepEqual(replies.map((reply) => reply.status).toSorted(), [200, 201]);

		const mine = z
			.object({ entries: z.array(z.object({ id: z.string() })) })
			.parse((await call('GET', '/api/me/library', { cookie })).json());

		assert.equal(mine.entries.length, 1);
	});
});

describe('adding', () => {
	it('counts each signed-in viewer once, and never the author', async () => {
		const owner = await fan('adds_owner');
		const id = await publishAs(owner, 'board-1');
		const first = await fan('adder_one', { pro: false });
		const second = await fan('adder_two', { pro: false });

		const add = async (cookie: string) =>
			z
				.object({ adds: z.number() })
				.parse((await call('POST', `/api/library/${id}/add`, { cookie })).json()).adds;

		assert.equal(await add(first), 1);
		assert.equal(await add(first), 1, 'the same viewer twice');
		assert.equal(await add(second), 2);
		assert.equal(await add(owner), 2, 'the author’s own copy');
		assert.equal((await call('POST', `/api/library/${id}/add`)).status, 401);
		assert.equal((await call('POST', '/api/library/nope/add', { cookie: first })).status, 404);

		const popular = listing.parse((await call('GET', '/api/library?sort=popular')).json()).entries;

		assert.equal(popular[0]?.id, id, 'most added first');
	});
});

describe('reports', () => {
	it('hide a dashboard once enough different viewers report it, but not its author’s view', async () => {
		const owner = await fan('reported_owner');
		const id = await publishAs(owner, 'board-1', 'Dubious');

		const report = (cookie: string, reason = 'spam') =>
			call('POST', `/api/library/${id}/report`, { cookie, body: { reason } });

		assert.equal((await report(owner)).status, 400, 'not your own');
		assert.equal(
			(await call('POST', `/api/library/${id}/report`, { body: { reason: 'spam' } })).status,
			401
		);

		const a = await fan('reporter_a', { pro: false });
		const b = await fan('reporter_b', { pro: false });
		const c = await fan('reporter_c', { pro: false });

		assert.equal((await report(a)).status, 200);
		assert.deepEqual((await report(a, 'offensive')).json(), { reported: true, already: true });
		assert.equal((await report(b)).status, 200);
		assert.equal(
			listing
				.parse((await call('GET', '/api/library')).json())
				.entries.some((entry) => entry.id === id),
			true,
			'two of three reports: still up'
		);

		assert.equal((await report(c)).status, 200);
		assert.equal((await call('GET', `/api/library/${id}`)).status, 404, 'hidden from strangers');
		assert.equal(
			listing
				.parse((await call('GET', '/api/library')).json())
				.entries.some((entry) => entry.id === id),
			false
		);
		assert.equal((await call('POST', `/api/library/${id}/add`, { cookie: a })).status, 404);

		const mine = entryReply.parse(
			(await call('GET', `/api/library/${id}`, { cookie: owner })).json()
		);

		assert.equal(mine.entry.hidden, true, 'its author sees why it is gone');

		// Publishing it again does not bring it back.
		await publishAs(owner, 'board-1', 'Dubious, again');
		assert.equal((await call('GET', `/api/library/${id}`)).status, 404);
		assert.equal((await report(a, 'bogus')).status, 400);
	});
});

describe('reports on an example', () => {
	it('are kept, but never hold an example back', async () => {
		const id = 'example-tv-wall';

		for (const name of ['example_a', 'example_b', 'example_c', 'example_d']) {
			const cookie = await fan(name, { pro: false });

			// eslint-disable-next-line no-await-in-loop -- one reporter after another
			const reply = await call('POST', `/api/library/${id}/report`, {
				cookie,
				body: { reason: 'spam' }
			});

			assert.equal(reply.status, 200);
		}

		assert.equal((await call('GET', `/api/library/${id}`)).status, 200);
	});
});

describe('the account’s library data', () => {
	it('is in the export, and gone with the account', async () => {
		const email = 'leaver@example.test';
		const cookie = await fan('leaver');
		const id = await publishAs(cookie, 'board-1');

		const exported = z
			.object({
				library: z.object({ handle: z.string(), published: z.array(z.object({ id: z.string() })) })
			})
			.parse((await call('GET', '/api/me/export', { cookie })).json());

		assert.equal(exported.library.handle, 'leaver');
		assert.deepEqual(
			exported.library.published.map((entry) => entry.id),
			[id]
		);

		assert.equal(
			(await call('DELETE', '/api/me', { cookie, body: { confirm: email } })).status,
			200
		);
		assert.equal((await call('GET', `/api/library/${id}`)).status, 404);

		const reused = await call('PUT', '/api/me/handle', {
			cookie: await signIn('newcomer@example.test'),
			body: { handle: 'leaver' }
		});

		assert.equal(reused.status, 200, 'the handle is free again');
	});
});
