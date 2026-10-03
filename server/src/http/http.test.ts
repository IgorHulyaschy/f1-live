import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { gunzipSync, gzipSync } from 'node:zlib';

import { createServer } from '../main.js';
import type { LiveServer } from '../main.js';
import { testConfig } from '../live/test-harness.js';

const SNAPSHOT = { session: { id: '9858' } };

const dataDir = testConfig().dataDir;

let server: LiveServer;

let baseUrl: string;

before(async () => {
	const out = path.join(dataDir, 'out');

	mkdirSync(path.join(out, 'snapshots'), { recursive: true });
	mkdirSync(path.join(out, 'events'), { recursive: true });
	writeFileSync(path.join(out, 'catalog.json'), JSON.stringify({ seasons: [2025] }));
	writeFileSync(path.join(out, 'snapshots', '9858.json.gz'), gzipSync(JSON.stringify(SNAPSHOT)));
	writeFileSync(path.join(out, 'events', '9858.ndjson.gz'), gzipSync('{"kind":"x"}\n'));
	writeFileSync(path.join(dataDir, 'secret.txt'), 'not for the web');

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
