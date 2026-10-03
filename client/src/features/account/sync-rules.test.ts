import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Dashboard } from '@f1-live/shared/dashboard';

import {
	bindAccount,
	EMPTY_META,
	type PushOp,
	recordDelete,
	recordSave,
	reconcile,
	type RemoteDoc,
	settle,
	type SyncState
} from './sync-rules.ts';

const T1 = '2026-10-03T10:00:00.000Z';

const T2 = '2026-10-03T11:00:00.000Z';

const T3 = '2026-10-03T12:00:00.000Z';

function board(id: string, name = id): Dashboard {
	return {
		id,
		name,
		tiles: [{ id: `${id}-0`, kind: 'timing' }],
		layout: [{ i: `${id}-0`, x: 0, y: 0, w: 12, h: 10 }]
	};
}

function remote(id: string, version: number, name: string | null = id, updatedAt = T2): RemoteDoc {
	return { id, version, updatedAt, dashboard: name === null ? null : board(id, name) };
}

/** A browser signed in to `acct`, holding `boards` exactly as the account confirmed them. */
function synced(boards: [id: string, version: number][]): SyncState {
	return {
		saved: boards.map(([id]) => board(id)),
		meta: {
			accountId: 'acct',
			docs: Object.fromEntries(
				boards.map(([id, version]) => [
					id,
					{ version, updatedAt: T1, pending: null, blocked: false }
				])
			)
		}
	};
}

describe('first sign-in', () => {
	it('offers every dashboard in this browser to the account, keeping its edit time', () => {
		const saved = [board('board-a'), board('live')];
		const meta = bindAccount(recordSave(EMPTY_META, 'live', T1), saved, 'acct');
		const { push } = reconcile({ saved, meta }, []);

		assert.deepEqual(
			push.map((op) => op.kind === 'put' && [op.dashboard.id, op.baseVersion, op.updatedAt]),
			[
				['board-a', 0, '1970-01-01T00:00:00.000Z'],
				['live', 0, T1]
			]
		);
	});

	it('takes in what the account already has and keeps both sides', () => {
		const saved = [board('board-a')];
		const meta = bindAccount(EMPTY_META, saved, 'acct');
		const next = reconcile({ saved, meta }, [remote('board-b', 3)]);

		assert.deepEqual(
			next.saved.map((dashboard) => dashboard.id),
			['board-a', 'board-b']
		);
		assert.deepEqual(next.meta.docs['board-b'], {
			version: 3,
			updatedAt: T2,
			pending: null,
			blocked: false
		});
	});

	it('changes nothing when the same account signs in again', () => {
		const state = synced([['board-a', 2]]);

		assert.equal(bindAccount(state.meta, state.saved, 'acct'), state.meta);
	});
});

describe('pull', () => {
	it('takes a newer version from another device when nothing changed here', () => {
		const next = reconcile(synced([['board-a', 1]]), [remote('board-a', 2, 'Renamed')]);

		assert.equal(next.saved[0]?.name, 'Renamed');
		assert.equal(next.meta.docs['board-a']?.version, 2);
		assert.deepEqual(next.push, []);
	});

	it('removes a dashboard deleted on another device', () => {
		const next = reconcile(synced([['board-a', 1]]), [remote('board-a', 2, null)]);

		assert.deepEqual(next.saved, []);
		assert.equal(next.meta.docs['board-a'], undefined);
	});

	it('sends edits made here, based on the version this device last saw', () => {
		const state = synced([['board-a', 1]]);
		const edited = { ...state, meta: recordSave(state.meta, 'board-a', T3) };
		const next = reconcile(edited, [remote('board-a', 2, 'Elsewhere')]);

		assert.deepEqual(next.push, [
			{ kind: 'put', dashboard: board('board-a'), baseVersion: 1, updatedAt: T3 }
		]);
		assert.equal(next.saved[0]?.name, 'board-a', 'the account decides, not the pull');
	});

	it('sends a deletion made here, and forgets it once the account has none', () => {
		const state = synced([['board-a', 1]]);
		const deleted = { saved: [], meta: recordDelete(state.meta, 'board-a', T3) };

		assert.deepEqual(reconcile(deleted, [remote('board-a', 1)]).push, [
			{ kind: 'delete', id: 'board-a', baseVersion: 1, updatedAt: T3 }
		]);
		assert.deepEqual(reconcile(deleted, [remote('board-a', 2, null)]).meta.docs, {});
	});

	it('does not tell the account about a dashboard it never had', () => {
		const meta = recordDelete(recordSave(EMPTY_META, 'board-a', T1), 'board-a', T2);

		assert.deepEqual(meta.docs, {});
	});
});

describe('settle', () => {
	const edited = (): SyncState => {
		const state = synced([['board-a', 1]]);

		return { ...state, meta: recordSave(state.meta, 'board-a', T3) };
	};

	const put: PushOp = { kind: 'put', dashboard: board('board-a'), baseVersion: 1, updatedAt: T3 };

	it('marks a saved edit as confirmed', () => {
		const next = settle(edited(), put, {
			kind: 'saved',
			document: remote('board-a', 2, 'board-a', T3)
		});

		assert.deepEqual(next.meta.docs['board-a'], {
			version: 2,
			updatedAt: T3,
			pending: null,
			blocked: false
		});
		assert.equal(next.notice, null);
	});

	it('shows the newer edit from another device and says so', () => {
		const next = settle(edited(), put, {
			kind: 'stale',
			document: remote('board-a', 3, 'Laptop', T3)
		});

		assert.equal(next.saved[0]?.name, 'Laptop');
		assert.equal(next.meta.docs['board-a']?.pending, null);
		assert.deepEqual(next.notice, { kind: 'replaced', name: 'Laptop' });
	});

	it('brings back a dashboard deleted here when it was edited later elsewhere', () => {
		const state = synced([['board-a', 1]]);
		const deleted = { saved: [], meta: recordDelete(state.meta, 'board-a', T2) };
		const op: PushOp = { kind: 'delete', id: 'board-a', baseVersion: 1, updatedAt: T2 };
		const next = settle(deleted, op, { kind: 'stale', document: remote('board-a', 2, 'Kept', T3) });

		assert.equal(next.saved[0]?.name, 'Kept');
		assert.deepEqual(next.notice, { kind: 'restored', name: 'Kept' });
	});

	it('keeps an edit made while the push was on its way', () => {
		const state = edited();
		const later = { ...state, meta: recordSave(state.meta, 'board-a', '2026-10-03T12:00:05.000Z') };
		const next = settle(later, put, { kind: 'saved', document: remote('board-a', 2) });

		assert.equal(next.meta.docs['board-a']?.pending, 'save');
		assert.equal(next.meta.docs['board-a']?.version, 2);
	});

	it('keeps a dashboard Free cannot sync on this device, and says so once', () => {
		const first = settle(edited(), put, { kind: 'limit', limit: 3 });

		assert.equal(first.saved.length, 1);
		assert.deepEqual(first.meta.docs['board-a'], {
			version: 1,
			updatedAt: T3,
			pending: 'save',
			blocked: true
		});
		assert.deepEqual(first.notice, { kind: 'limit', limit: 3 });
		assert.equal(settle(first, put, { kind: 'limit', limit: 3 }).notice, null);
	});
});
