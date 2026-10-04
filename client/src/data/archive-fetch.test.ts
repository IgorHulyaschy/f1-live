import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TelemetryFetchStatus } from '@f1-live/shared';

import {
	type ArchiveFetchApi,
	ArchiveFetches,
	describeFetch,
	describeStage
} from './archive-fetch.ts';

/** A server that answers each call with the next status in line. */
function scriptedApi(answers: (TelemetryFetchStatus | null)[]) {
	const calls: string[] = [];

	const next = (method: string) => async (sessionKey: string) => {
		calls.push(`${method} ${sessionKey}`);

		return answers.shift() ?? null;
	};

	const api: ArchiveFetchApi = { request: next('POST'), status: next('GET') };

	return { api, calls };
}

function settle(fetches: ArchiveFetches, sessionKey: string, state: string): Promise<void> {
	return new Promise((resolve) => {
		const stop = fetches.subscribe(sessionKey, () => {
			if (fetches.get(sessionKey)?.state === state) {
				stop();
				resolve();
			}
		});
	});
}

describe('ArchiveFetches', () => {
	it('asks once, follows the fetch while it runs and tells who listens when it is ready', async () => {
		const { api, calls } = scriptedApi([
			{ state: 'queued', ahead: 0 },
			{ state: 'fetching', receivedBytes: 5, totalBytes: 10 },
			{ state: 'building' },
			{ state: 'ready' }
		]);

		const fetches = new ArchiveFetches(api, 1);
		const ready: string[] = [];

		fetches.onReady((sessionKey) => ready.push(sessionKey));

		const done = settle(fetches, '5001', 'ready');

		fetches.start('5001');
		fetches.start('5001');
		await done;

		assert.deepEqual(calls, ['POST 5001', 'GET 5001', 'GET 5001', 'GET 5001']);
		assert.deepEqual(ready, ['5001']);
	});

	it('asks again after a failure only when told to retry', async () => {
		const { api, calls } = scriptedApi([
			{ state: 'failed', message: 'Not fetched' },
			{ state: 'unavailable', reason: 'No positions' }
		]);

		const fetches = new ArchiveFetches(api, 1);
		const failed = settle(fetches, '5001', 'failed');

		fetches.start('5001');
		await failed;
		fetches.start('5001');
		assert.deepEqual(calls, ['POST 5001']);

		const unavailable = settle(fetches, '5001', 'unavailable');

		fetches.start('5001', true);
		await unavailable;
		assert.deepEqual(calls, ['POST 5001', 'POST 5001']);
	});

	it('stays quiet on a server that fetches nothing on demand', async () => {
		const { api } = scriptedApi([null]);
		const fetches = new ArchiveFetches(api, 1);
		const heard = new Promise<void>((resolve) => fetches.subscribe('5001', resolve));

		fetches.start('5001');
		await heard;
		assert.equal(fetches.get('5001'), null);
	});
});

describe('describeFetch', () => {
	it('says how far the fetch has come', () => {
		assert.equal(
			describeFetch({ state: 'fetching', receivedBytes: 12.4e6, totalBytes: 26e6 }),
			'Fetching car positions from the archive: 47% (12 MB of 26 MB).'
		);
		assert.equal(
			describeFetch({ state: 'fetching', receivedBytes: 3e6, totalBytes: null }),
			'Fetching car positions from the archive: 3 MB.'
		);
		assert.equal(
			describeFetch({ state: 'fetching', receivedBytes: 0, totalBytes: null }),
			'Fetching car positions from the archive.'
		);
		assert.equal(
			describeFetch({ state: 'queued', ahead: 2 }),
			'Car positions queued behind 2 other sessions.'
		);
		assert.equal(
			describeFetch({ state: 'building' }),
			'Building the replay from the car positions.'
		);
	});

	it('names the stage alone for a screen reader', () => {
		assert.equal(
			describeStage({ state: 'fetching', receivedBytes: 12.4e6, totalBytes: 26e6 }),
			'Fetching car positions from the archive.'
		);
		assert.equal(
			describeStage({ state: 'building' }),
			'Building the replay from the car positions.'
		);
	});

	it('says nothing once there is nothing to wait for', () => {
		assert.equal(describeFetch(null), null);
		assert.equal(describeFetch({ state: 'ready' }), null);
		assert.equal(describeFetch({ state: 'unavailable', reason: 'No positions' }), null);
	});
});
