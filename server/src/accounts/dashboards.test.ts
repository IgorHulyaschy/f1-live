import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { Dashboard } from '@f1-live/shared/dashboard';
import { PLAN_ENTITLEMENTS } from '@f1-live/shared/plans';

import { decideWrite, listDocuments, writeDocument } from './dashboards.js';
import { type OpenDatabase, openDatabase } from './db/database.js';
import { user } from './db/schema.js';

const NOW = new Date('2026-10-03T12:00:00.000Z');

const minutes = (count: number) => new Date(NOW.getTime() + count * 60_000);

function board(id: string, name = id): Dashboard {
	return {
		id,
		name,
		tiles: [{ id: `${id}-0`, kind: 'timing' }],
		layout: [{ i: `${id}-0`, x: 0, y: 0, w: 12, h: 10 }]
	};
}

describe('decideWrite', () => {
	const stored = { version: 4, updatedAt: minutes(-10) };

	it('accepts a first write and a write based on the latest version', () => {
		assert.equal(decideWrite(null, { baseVersion: 0, updatedAt: minutes(-60) }), 'accept');
		assert.equal(decideWrite(stored, { baseVersion: 4, updatedAt: minutes(-60) }), 'accept');
	});

	it('lets the newer edit win when another device wrote in between', () => {
		assert.equal(decideWrite(stored, { baseVersion: 3, updatedAt: minutes(-5) }), 'accept');
		assert.equal(decideWrite(stored, { baseVersion: 3, updatedAt: minutes(-20) }), 'stale');
	});

	it('keeps what is stored on a tie', () => {
		assert.equal(decideWrite(stored, { baseVersion: 2, updatedAt: minutes(-10) }), 'stale');
	});
});

describe('writeDocument', () => {
	let database: OpenDatabase;
	let userCount = 0;

	before(async () => {
		database = await openDatabase({ kind: 'pglite', dataDir: null });
	});

	after(async () => {
		await database.close();
	});

	async function newUser(): Promise<string> {
		userCount += 1;
		const id = `user-${userCount}`;

		await database.db.insert(user).values({ id, name: '', email: `fan${userCount}@example.test` });

		return id;
	}

	const save = (userId: string, dashboard: Dashboard, baseVersion = 0, at = minutes(-1)) =>
		writeDocument(
			database.db,
			userId,
			PLAN_ENTITLEMENTS.free,
			{ id: dashboard.id, dashboard, baseVersion, updatedAt: at },
			NOW
		);

	it('keeps three dashboards of your own on Free and refuses the fourth with a typed outcome', async () => {
		const userId = await newUser();

		for (const id of ['board-a', 'board-b', 'board-c']) {
			assert.equal((await save(userId, board(id))).kind, 'saved');
		}

		assert.deepEqual(await save(userId, board('board-d')), { kind: 'limit', limit: 3 });

		const pro = await writeDocument(
			database.db,
			userId,
			PLAN_ENTITLEMENTS.pro,
			{ id: 'board-d', dashboard: board('board-d'), baseVersion: 0, updatedAt: minutes(-1) },
			NOW
		);

		assert.equal(pro.kind, 'saved');
	});

	it('does not count edited ready-made dashboards, and still lets Free edit what it has', async () => {
		const userId = await newUser();

		for (const id of ['board-a', 'board-b', 'board-c', 'live', 'analysis']) {
			assert.equal((await save(userId, board(id))).kind, 'saved');
		}

		const edited = await save(userId, board('board-a', 'Renamed'), 1);

		assert.equal(edited.kind, 'saved');
		assert.equal(edited.kind === 'saved' && edited.document.version, 2);
	});

	it('frees a slot when a dashboard is deleted, and tells other devices with a tombstone', async () => {
		const userId = await newUser();

		for (const id of ['board-a', 'board-b', 'board-c']) {
			await save(userId, board(id));
		}

		const deleted = await writeDocument(
			database.db,
			userId,
			PLAN_ENTITLEMENTS.free,
			{ id: 'board-b', dashboard: null, baseVersion: 1, updatedAt: minutes(-1) },
			NOW
		);

		assert.equal(deleted.kind === 'saved' && deleted.document.dashboard, null);
		assert.equal((await save(userId, board('board-d'))).kind, 'saved');

		const documents = await listDocuments(database.db, userId);
		const tombstone = documents.find((document) => document.id === 'board-b');

		assert.deepEqual(tombstone && { version: tombstone.version, dashboard: tombstone.dashboard }, {
			version: 2,
			dashboard: null
		});
	});

	it('forgets deletion markers after 90 days', async () => {
		const userId = await newUser();

		await save(userId, board('board-a'), 0, minutes(-200 * 24 * 60));
		await writeDocument(
			database.db,
			userId,
			PLAN_ENTITLEMENTS.free,
			{ id: 'board-a', dashboard: null, baseVersion: 1, updatedAt: minutes(-100 * 24 * 60) },
			NOW
		);
		await save(userId, board('board-b'));

		const ids = (await listDocuments(database.db, userId)).map((document) => document.id);

		assert.deepEqual(ids, ['board-b']);
	});

	it('returns the newer copy when an older edit arrives from another device', async () => {
		const userId = await newUser();

		await save(userId, board('board-a', 'First'), 0, minutes(-30));
		await save(userId, board('board-a', 'Laptop'), 1, minutes(-5));

		const phone = await save(userId, board('board-a', 'Phone'), 1, minutes(-20));

		assert.equal(phone.kind, 'stale');
		assert.equal(phone.kind === 'stale' && phone.document.dashboard?.name, 'Laptop');

		const later = await save(userId, board('board-a', 'Phone later'), 1, minutes(-2));

		assert.equal(later.kind === 'saved' && later.document.version, 3);
	});

	it('does not move the version for a save that changes nothing', async () => {
		const userId = await newUser();

		await save(userId, board('board-a'));

		const again = await save(userId, board('board-a'), 1);

		assert.equal(again.kind === 'saved' && again.document.version, 1);
	});

	it('never stores an edit time from the future', async () => {
		const userId = await newUser();
		const ahead = await save(userId, board('board-a'), 0, minutes(60 * 24));

		assert.equal(ahead.kind === 'saved' && ahead.document.updatedAt, NOW.toISOString());
	});
});
