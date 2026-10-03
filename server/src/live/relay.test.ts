import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import type { RaceEvent } from '@f1-live/shared';

import { createServer } from '../main.js';
import type { LiveServer } from '../main.js';
import { FakeUpstream } from './fake-upstream.js';
import { loadReplayFrames } from './replay.js';
import {
	FAST_BACKOFF,
	FIXTURE_DIR,
	connectViewer,
	decodeDirectly,
	reduceDirectly,
	testConfig,
	untilQuiet,
	waitUntil
} from './test-harness.js';

const SECRET = 'a-shared-secret-for-tests';

const stoppers: (() => Promise<void>)[] = [];

after(async () => {
	await Promise.all(stoppers.map((stop) => stop()));
});

async function startRelay(port = 0) {
	const server = await createServer(
		testConfig({ MODE: 'relay', RELAY_SECRET: SECRET, PORT: String(port) })
	);

	const baseUrl = await server.listen();

	stoppers.push(() => server.close());

	return {
		server,
		baseUrl,
		liveUrl: `${baseUrl.replace(/^http/, 'ws')}/live`,
		port: Number(new URL(baseUrl).port)
	};
}

interface IngestOptions {
	relayUrl: string;
	speed?: number;
	fetchImpl?: typeof fetch;
}

/** An ingest process reading a fake upstream and pushing to the relay. */
async function startIngest({
	relayUrl,
	speed = Number.POSITIVE_INFINITY,
	fetchImpl
}: IngestOptions) {
	const frames = await loadReplayFrames(FIXTURE_DIR);
	const upstream = await FakeUpstream.start(frames, { speed });
	const base = testConfig({ MODE: 'ingest', RELAY_URL: relayUrl, RELAY_SECRET: SECRET });

	const server = await createServer(
		{ ...base, live: { ...base.live, url: upstream.url } },
		{ now: upstream.now, feedBackoff: FAST_BACKOFF, relayBackoff: FAST_BACKOFF, fetchImpl }
	);

	stoppers.push(async () => {
		await server.close();
		await upstream.close();
	});

	await server.listen();

	return { server, upstream };
}

async function untilReplicated(relay: LiveServer, ingest: LiveServer) {
	await untilQuiet(ingest);
	await waitUntil(
		() =>
			relay.session.position.epoch === ingest.session.position.epoch &&
			relay.session.position.seq === ingest.session.position.seq,
		'the relay to catch up'
	);
}

describe('ingest and relay', () => {
	it('carry a session from the feed to a viewer', async () => {
		const expected = await reduceDirectly(FIXTURE_DIR);
		const relay = await startRelay();
		const viewer = await connectViewer(relay.liveUrl);
		const ingest = await startIngest({ relayUrl: relay.baseUrl });

		await untilReplicated(relay.server, ingest.server);
		await waitUntil(
			() => viewer.replica.seq === relay.server.session.position.seq,
			'the viewer to catch up'
		);

		assert.deepEqual(relay.server.session.current, expected);
		assert.deepEqual(viewer.replica.snapshot, expected);
		assert.equal(viewer.resyncs, 0);
		viewer.socket.close();
	});

	it('resend what the relay missed after an outage, from the buffered log', async () => {
		const expected = await reduceDirectly(FIXTURE_DIR);
		const relay = await startRelay();
		const routes: string[] = [];
		let calls = 0;
		let failures = 0;

		const flaky: typeof fetch = (input, init) => {
			calls += 1;

			// Calls 4 to 13 find the relay unreachable.
			if (calls >= 4 && calls <= 13) {
				failures += 1;

				return Promise.reject(new TypeError('fetch failed'));
			}

			routes.push(new URL(input instanceof Request ? input.url : input).pathname);

			return fetch(input, init);
		};

		const ingest = await startIngest({ relayUrl: relay.baseUrl, speed: 4000, fetchImpl: flaky });

		await ingest.upstream.done;
		await untilReplicated(relay.server, ingest.server);

		assert.equal(failures, 10);
		assert.deepEqual(relay.server.session.current, expected);
		assert.equal(routes.filter((route) => route === '/ingest/state').length, 1);
	});

	it('send the whole state to a relay that restarted and lost it', async () => {
		const expected = await reduceDirectly(FIXTURE_DIR);
		const first = await startRelay();
		const ingest = await startIngest({ relayUrl: first.baseUrl, speed: 4000 });

		await waitUntil(() => ingest.upstream.sent > 60, 'the replay to get going');
		await first.server.close();

		const second = await startRelay(first.port);
		const viewer = await connectViewer(second.liveUrl);

		await ingest.upstream.done;
		await untilReplicated(second.server, ingest.server);
		await waitUntil(
			() => viewer.replica.seq === second.server.session.position.seq,
			'the viewer to catch up'
		);

		assert.deepEqual(second.server.session.current, expected);
		assert.deepEqual(viewer.replica.snapshot, expected);
		viewer.socket.close();
	});
});

type PushBody = { epoch: string | number; from?: number; events?: readonly RaceEvent[] };

async function post(baseUrl: string, route: string, body: PushBody, secret?: string) {
	const response = await fetch(new URL(route, baseUrl), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(secret && { Authorization: `Bearer ${secret}` })
		},
		body: JSON.stringify(body)
	});

	return { status: response.status, body: await response.json() };
}

describe('the ingest endpoints', () => {
	it('refuse a push without the shared secret', async () => {
		const relay = await startRelay();
		const body = { epoch: relay.server.session.position.epoch, from: 1, events: [] };

		for (const secret of [undefined, 'wrong-secret-of-some-length', SECRET.slice(1)]) {
			// oxlint-disable-next-line no-await-in-loop -- few requests, in order.
			const result = await post(relay.baseUrl, '/ingest/events', body, secret);

			assert.equal(result.status, 401, String(secret));
		}

		assert.equal(relay.server.session.position.seq, 0);
	});

	it('accept events in order, ignore overlap and report a gap', async () => {
		const events = await decodeDirectly(FIXTURE_DIR);
		const relay = await startRelay();
		const { epoch } = relay.server.session.position;

		const first = await post(
			relay.baseUrl,
			'/ingest/events',
			{ epoch, from: 1, events: events.slice(0, 10) },
			SECRET
		);

		assert.deepEqual([first.status, first.body], [200, { epoch, seq: 10 }]);

		const overlap = await post(
			relay.baseUrl,
			'/ingest/events',
			{ epoch, from: 6, events: events.slice(5, 15) },
			SECRET
		);

		assert.deepEqual([overlap.status, overlap.body], [200, { epoch, seq: 15 }]);

		const gap = await post(
			relay.baseUrl,
			'/ingest/events',
			{ epoch, from: 20, events: events.slice(19, 25) },
			SECRET
		);

		assert.deepEqual([gap.status, gap.body], [409, { epoch, seq: 15 }]);

		const otherEpoch = await post(
			relay.baseUrl,
			'/ingest/events',
			{ epoch: 'someone-else', from: 16, events: events.slice(15, 20) },
			SECRET
		);

		assert.deepEqual([otherEpoch.status, otherEpoch.body], [409, { epoch, seq: 15 }]);
	});

	it('refuse a malformed body', async () => {
		const relay = await startRelay();

		const result = await post(relay.baseUrl, '/ingest/events', { epoch: 3 }, SECRET);

		assert.equal(result.status, 400);
	});

	it('are not there outside relay mode', async () => {
		const server = await createServer(testConfig());

		stoppers.push(() => server.close());

		const address = await server.listen();
		const result = await post(address, '/ingest/events', { epoch: 'x' }, SECRET);

		assert.equal(result.status, 404);
	});
});
