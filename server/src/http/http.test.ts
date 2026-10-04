import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { gunzipSync, gzipSync } from 'node:zlib';

import { createServer } from '../main.js';
import type { LiveServer } from '../main.js';
import { testConfig } from '../live/test-harness.js';

const SNAPSHOT = { session: { id: '9858' } };

const CACHED = {
	key: 7001,
	path: '2019/2019-06-30_Austrian_Grand_Prix/2019-06-30_Race',
	bytes: 1000,
	openedAt: '2026-01-01T00:00:00.000Z'
};

const dataDir = testConfig().dataDir;

let server: LiveServer;

let baseUrl: string;

before(async () => {
	const out = path.join(dataDir, 'out');

	mkdirSync(path.join(out, 'snapshots'), { recursive: true });
	mkdirSync(path.join(out, 'events'), { recursive: true });
	mkdirSync(path.join(out, 'telemetry', '9858', 'laps'), { recursive: true });
	writeFileSync(
		path.join(out, 'telemetry', '9858', 'laps', '1-2.json.gz'),
		gzipSync(JSON.stringify({ lap: 2 }))
	);
	mkdirSync(path.join(out, 'results'), { recursive: true });
	writeFileSync(path.join(out, 'results', '2018.json.gz'), gzipSync('{"season":2018}'));
	writeFileSync(path.join(out, 'catalog.json'), JSON.stringify({ seasons: [2025] }));
	writeFileSync(path.join(out, 'snapshots', '9858.json.gz'), gzipSync(JSON.stringify(SNAPSHOT)));
	writeFileSync(path.join(out, 'events', '9858.ndjson.gz'), gzipSync('{"kind":"x"}\n'));
	writeFileSync(path.join(dataDir, 'secret.txt'), 'not for the web');
	mkdirSync(path.join(out, 'telemetry', '7001'), { recursive: true });
	writeFileSync(path.join(out, 'telemetry', '7001', 'index.json'), '{}');
	mkdirSync(path.join(dataDir, 'cache'), { recursive: true });
	writeFileSync(
		path.join(dataDir, 'cache', 'sessions.json'),
		JSON.stringify({ sessions: [CACHED] })
	);

	server = await createServer(
		testConfig({ DATA_DIR: dataDir, CORS_ORIGINS: 'https://app.example.com' })
	);
	baseUrl = await server.listen();
});

after(async () => {
	await server.close();
});

interface RawResponse {
	status: number;
	headers: Record<string, string | string[] | undefined>;
	body: Buffer;
}

/** Plain http, so the body arrives as sent: fetch would unpack gzip before the test sees it. */
function get(route: string, headers: Record<string, string> = {}): Promise<RawResponse> {
	return new Promise((resolve, reject) => {
		request(new URL(route, baseUrl), { headers }, (response) => {
			const chunks: Buffer[] = [];

			response.on('data', (chunk: Buffer) => chunks.push(chunk));
			response.on('end', () =>
				resolve({
					status: response.statusCode ?? 0,
					headers: response.headers,
					body: Buffer.concat(chunks)
				})
			);
		})
			.on('error', reject)
			.end();
	});
}

describe('GET /health', () => {
	it('answers without a database or a live session', async () => {
		const response = await get('/health');
		const body = JSON.parse(response.body.toString());

		assert.equal(response.status, 200);
		assert.equal(body.status, 'ok');
		assert.equal(body.mode, 'all');
		assert.equal(body.sessionId, null);
	});
});

describe('GET /ready', () => {
	it('is ready when nothing it depends on is down', async () => {
		const response = await get('/ready');

		assert.equal(response.status, 200);
		assert.equal(JSON.parse(response.body.toString()).status, 'ready');
	});
});

describe('CORS', () => {
	it('answers only the configured origins', async () => {
		const allowed = await get('/health', { Origin: 'https://app.example.com' });
		const other = await get('/health', { Origin: 'https://evil.example.com' });

		assert.equal(allowed.headers['access-control-allow-origin'], 'https://app.example.com');
		assert.equal(other.headers['access-control-allow-origin'], undefined);
	});
});

describe('saved sessions', () => {
	it('send a gzip file as gzip to a client that accepts it, with revalidating cache headers', async () => {
		const response = await get('/snapshots/9858.json.gz', { 'Accept-Encoding': 'gzip' });

		assert.equal(response.status, 200);
		assert.equal(response.headers['content-encoding'], 'gzip');
		assert.equal(response.headers['content-type'], 'application/json; charset=utf-8');
		assert.match(String(response.headers['cache-control']), /must-revalidate/);
		assert.deepEqual(JSON.parse(gunzipSync(response.body).toString()), SNAPSHOT);
	});

	it('unpack it for a client that does not', async () => {
		const response = await get('/snapshots/9858.json.gz', { 'Accept-Encoding': 'identity' });

		assert.equal(response.headers['content-encoding'], undefined);
		assert.deepEqual(JSON.parse(response.body.toString()), SNAPSHOT);
	});

	it('answer a repeat request with 304', async () => {
		const first = await get('/snapshots/9858.json.gz');

		const second = await get('/snapshots/9858.json.gz', {
			'If-None-Match': String(first.headers.etag)
		});

		assert.equal(second.status, 304);
		assert.equal(second.body.length, 0);
	});

	it('serve the catalog uncached and the events as newline-delimited JSON', async () => {
		const catalog = await get('/catalog.json');
		const events = await get('/events/9858.ndjson.gz', { 'Accept-Encoding': 'gzip' });

		assert.equal(catalog.headers['cache-control'], 'no-cache');
		assert.deepEqual(JSON.parse(catalog.body.toString()), { seasons: [2025] });
		assert.equal(events.headers['content-type'], 'application/x-ndjson; charset=utf-8');
	});

	it('serve a session telemetry file in its folder', async () => {
		const response = await get('/telemetry/9858/laps/1-2.json.gz', { 'Accept-Encoding': 'gzip' });

		assert.equal(response.status, 200);
		assert.equal(response.headers['content-encoding'], 'gzip');
		assert.deepEqual(JSON.parse(gunzipSync(response.body).toString()), { lap: 2 });
	});

	it('serve a season results index', async () => {
		const response = await get('/results/2018.json.gz', { 'Accept-Encoding': 'gzip' });

		assert.equal(response.status, 200);
		assert.deepEqual(JSON.parse(gunzipSync(response.body).toString()), { season: 2018 });
	});

	it('serve nothing else, nor anything outside out/', async () => {
		for (const route of [
			'/snapshots/missing.json.gz',
			'/snapshots/..%2F..%2Fsecret.txt',
			'/snapshots/%2e%2e/secret.txt',
			'/snapshots/.hidden',
			'/secret.txt',
			'/out/catalog.json'
		]) {
			// oxlint-disable-next-line no-await-in-loop -- few requests.
			const response = await get(route);

			assert.equal(response.status, 404, route);
		}
	});
});

function openedAt(): number {
	return Date.parse(
		JSON.parse(readFileSync(path.join(dataDir, 'cache', 'sessions.json'), 'utf8')).sessions[0]
			.openedAt
	);
}

describe('telemetry on demand', () => {
	it('says a session with telemetry is ready and one without is idle', async () => {
		for (const [key, state] of [
			['7001', 'ready'],
			['9858', 'idle']
		]) {
			// oxlint-disable-next-line no-await-in-loop -- two requests.
			const response = await get(`/telemetry-fetch/${key}`);

			assert.equal(response.status, 200);
			assert.equal(response.headers['cache-control'], 'no-store');
			assert.deepEqual(JSON.parse(response.body.toString()), { state });
		}

		assert.equal((await get('/telemetry-fetch/abc')).status, 404);
	});

	it('refuses to fetch a session nothing imported', async () => {
		const response = await fetch(new URL('/telemetry-fetch/12345', baseUrl), { method: 'POST' });

		assert.deepEqual(await response.json(), {
			state: 'unavailable',
			reason: 'No imported session has this key.'
		});
	});

	it('marks a cached session as opened when a viewer reads its manifest', async () => {
		assert.equal((await get('/telemetry/7001/index.json')).status, 200);

		const deadline = Date.now() + 2000;

		// The mark is written once the answer has gone.
		while (openedAt() === Date.parse(CACHED.openedAt) && Date.now() < deadline) {
			// oxlint-disable-next-line no-await-in-loop -- polls a file.
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		assert.ok(openedAt() > Date.parse(CACHED.openedAt));
	});
});
