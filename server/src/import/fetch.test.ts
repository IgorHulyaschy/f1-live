import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { fetchPolitely, mapLimited } from '../pkg/http.js';
import { ArchiveMissing, fetchSession } from './fetch.js';
import type { ImportTarget } from './select.js';

const TARGET: ImportTarget = {
	key: 1,
	label: 'Test GP 2025, Race',
	path: '2025/2025-01-01_Test_Grand_Prix/2025-01-01_Race',
	startsAt: '2025-01-01T12:00:00.000Z',
	endsAt: '2025-01-01T14:00:00.000Z',
	meetingKey: 1,
	type: 'race'
};

const SESSION_INDEX = `﻿${JSON.stringify({
	Feeds: {
		SessionInfo: { KeyFramePath: 'SessionInfo.json', StreamPath: 'SessionInfo.jsonStream' },
		TimingData: { KeyFramePath: 'TimingData.json', StreamPath: 'TimingData.jsonStream' },
		'Position.z': { KeyFramePath: 'Position.z.json', StreamPath: 'Position.z.jsonStream' }
	}
})}`;

/** A 2018 session: the archive has its streams but no Index.json. */
const UNLISTED: ImportTarget = {
	...TARGET,
	key: 2,
	path: '2018/2018-03-25_Test_Grand_Prix/2018-03-25_Race'
};

const FILES = new Map([
	[`/${TARGET.path}/Index.json`, SESSION_INDEX],
	[`/${TARGET.path}/SessionInfo.jsonStream`, '﻿00:00:01.000{"Key":1}\n'],
	[`/${TARGET.path}/TimingData.jsonStream`, '﻿00:00:02.000{"Lines":{}}\n'],
	[`/${TARGET.path}/Position.z.jsonStream`, '﻿00:00:02.000"7ZTBb"\n'],
	[`/${UNLISTED.path}/SessionInfo.jsonStream`, '﻿00:00:01.000{"Key":2}\n'],
	[`/${UNLISTED.path}/TimingData.jsonStream`, '﻿00:00:02.000{"Lines":{}}\n'],
	[`/${UNLISTED.path}/CarData.z.jsonStream`, '﻿00:00:02.000"7ZTBb"\n']
]);

const SETTLED = new Date('2025-01-02T12:00:00Z');

const roots: string[] = [];

let server: Server;

let baseUrl = '';

let requests: string[] = [];

before(async () => {
	server = createServer((request, response) => {
		const url = request.url ?? '';
		const body = FILES.get(url);

		requests.push(url);

		if (body === undefined) {
			response.writeHead(403).end();
		} else {
			response.writeHead(200).end(body);
		}
	});

	baseUrl = await listen(server);
});

after(() => {
	server.close();

	for (const root of roots) {
		rmSync(root, { recursive: true, force: true });
	}
});

async function listen(target: Server): Promise<string> {
	await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));

	// SAFETY: listening on a TCP port makes address() an AddressInfo.
	const { port } = target.address() as AddressInfo;

	return `http://127.0.0.1:${port}`;
}

function newRoot(): string {
	const root = mkdtempSync(path.join(tmpdir(), 'fetch-'));

	roots.push(root);
	requests = [];

	return root;
}

describe('fetchSession', () => {
	it('saves Index.json and every stream it lists, bytes as served', async () => {
		const root = newRoot();
		const stats = await fetchSession(TARGET, root, SETTLED, { baseUrl });

		assert.deepEqual([stats.files, stats.downloaded], [4, 4]);
		assert.equal(
			readFileSync(path.join(root, TARGET.path, 'SessionInfo.jsonStream'), 'utf8'),
			'﻿00:00:01.000{"Key":1}\n'
		);
		assert.equal(existsSync(path.join(root, TARGET.path, 'SessionInfo.jsonStream.part')), false);
	});

	it('skips a settled session that is complete, without a request', async () => {
		const root = newRoot();

		await fetchSession(TARGET, root, SETTLED, { baseUrl });
		requests = [];

		const stats = await fetchSession(TARGET, root, SETTLED, { baseUrl });

		assert.equal(stats.downloaded, 0);
		assert.deepEqual(requests, []);
	});

	it('resumes a half-finished session by fetching only the files it lacks', async () => {
		const root = newRoot();

		await fetchSession(TARGET, root, SETTLED, { baseUrl });
		rmSync(path.join(root, TARGET.path, 'TimingData.jsonStream'));
		requests = [];

		const stats = await fetchSession(TARGET, root, SETTLED, { baseUrl });

		assert.equal(stats.downloaded, 2);
		assert.deepEqual(requests.toSorted(), [
			`/${TARGET.path}/Index.json`,
			`/${TARGET.path}/TimingData.jsonStream`
		]);
	});

	it('keeps only the streams results need, leaving positions and car data out', async () => {
		const root = newRoot();
		const stats = await fetchSession(TARGET, root, SETTLED, { baseUrl, topics: 'results' });

		assert.equal(stats.downloaded, 3);
		assert.equal(existsSync(path.join(root, TARGET.path, 'Position.z.jsonStream')), false);

		requests = [];

		assert.equal(
			(await fetchSession(TARGET, root, SETTLED, { baseUrl, topics: 'results' })).downloaded,
			0
		);
		assert.deepEqual(requests, []);
		assert.equal((await fetchSession(TARGET, root, SETTLED, { baseUrl })).downloaded, 2);
	});

	it('asks for each stream of a session without Index.json and notes the ones refused', async () => {
		const root = newRoot();
		const stats = await fetchSession(UNLISTED, root, SETTLED, { baseUrl, topics: 'results' });

		assert.deepEqual([stats.files, stats.downloaded], [2, 2]);
		assert.equal(existsSync(path.join(root, UNLISTED.path, 'CarData.z.jsonStream')), false);
		assert.ok(
			JSON.parse(
				readFileSync(path.join(root, UNLISTED.path, '_archive.json'), 'utf8')
			).absent.includes('LapCount.jsonStream')
		);

		requests = [];

		assert.equal(
			(await fetchSession(UNLISTED, root, SETTLED, { baseUrl, topics: 'results' })).downloaded,
			0
		);
		assert.deepEqual(requests, []);
		assert.equal((await fetchSession(UNLISTED, root, SETTLED, { baseUrl })).downloaded, 1);
	});

	it('fetches a session that ended minutes ago whole again, because its files still grow', async () => {
		const root = newRoot();
		const justAfter = new Date('2025-01-01T14:10:00Z');

		await fetchSession(TARGET, root, justAfter, { baseUrl });
		requests = [];

		assert.equal((await fetchSession(TARGET, root, justAfter, { baseUrl })).downloaded, 4);
	});

	it('fetches again a file saved while the session ran, once the session has settled', async () => {
		const root = newRoot();

		await fetchSession(TARGET, root, SETTLED, { baseUrl });

		const cutShort = new Date('2025-01-01T15:00:00Z');

		utimesSync(path.join(root, TARGET.path, 'TimingData.jsonStream'), cutShort, cutShort);
		requests = [];

		const stats = await fetchSession(TARGET, root, SETTLED, { baseUrl });

		assert.equal(stats.downloaded, 2);
		assert.deepEqual(requests.toSorted(), [
			`/${TARGET.path}/Index.json`,
			`/${TARGET.path}/TimingData.jsonStream`
		]);
	});

	it('says the archive has nothing for a session it answers 403 for', async () => {
		await assert.rejects(
			fetchSession({ ...TARGET, path: '2025/missing' }, newRoot(), SETTLED, { baseUrl }),
			ArchiveMissing
		);
	});

	it('refuses a folder that holds a live recording', async () => {
		const root = newRoot();

		await fetchSession(TARGET, root, SETTLED, { baseUrl });
		rmSync(path.join(root, TARGET.path, 'Index.json'));
		writeFileSync(path.join(root, TARGET.path, '_recording.json'), '{}');

		await assert.rejects(fetchSession(TARGET, root, SETTLED, { baseUrl }), /live recording/);
	});
});

describe('fetchPolitely', () => {
	it('waits and tries again on a busy answer, longer each time, as Retry-After asks', async () => {
		let calls = 0;

		const busy = createServer((_, response) => {
			calls += 1;

			if (calls === 1) {
				response.writeHead(503).end();
			} else if (calls === 2) {
				response.writeHead(429, { 'retry-after': '7' }).end();
			} else {
				response.writeHead(200).end('ok');
			}
		});

		const url = await listen(busy);
		const waits: number[] = [];

		const response = await fetchPolitely(`${url}/`, { attempts: 4, baseDelayMs: 100 }, (ms) => {
			waits.push(ms);

			return Promise.resolve();
		});

		busy.close();
		assert.equal(await response.text(), 'ok');
		assert.deepEqual(waits, [100, 7000]);
	});

	it('gives up with the last failure after the tries are spent', async () => {
		const down = createServer((_, response) => response.writeHead(500).end());

		const url = await listen(down);

		await assert.rejects(
			fetchPolitely(`${url}/`, { attempts: 2, baseDelayMs: 1 }, () => Promise.resolve()),
			/failed after 2 tries: status 500/
		);
		down.close();
	});
});

describe('mapLimited', () => {
	it('never runs more than the limit at once and keeps the order of the items', async () => {
		let running = 0;
		let peak = 0;

		const results = await mapLimited([1, 2, 3, 4, 5, 6], 2, async (item) => {
			running += 1;
			peak = Math.max(peak, running);
			await new Promise((resolve) => setTimeout(resolve, 5));
			running -= 1;

			return item * 10;
		});

		assert.equal(peak, 2);
		assert.deepEqual(results, [10, 20, 30, 40, 50, 60]);
	});
});
