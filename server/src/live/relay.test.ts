import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { EMPTY_SNAPSHOT, applyEvent } from '@f1-live/shared';
import type { RaceEvent } from '@f1-live/shared';
import { WebSocket } from 'ws';
import { z } from 'zod';

import { createServer } from '../main.js';
import type { LiveServer } from '../main.js';
import type { TopicFrame } from '../sources/f1/decode.js';
import { FakeUpstream } from './fake-upstream.js';
import { loadReplayFrames } from './replay.js';
import {
	FAST_BACKOFF,
	FIXTURE_DIR,
	connectViewer,
	decodeDirectly,
	reduceDirectly,
	telemetryFrames,
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
	/** What the fake feed sends; the Las Vegas race by default. */
	frames?: TopicFrame[];
	speed?: number;
	fetchImpl?: typeof fetch;
}

/** An ingest process reading a fake upstream and pushing to the relay. */
async function startIngest({
	relayUrl,
	frames,
	speed = Number.POSITIVE_INFINITY,
	fetchImpl
}: IngestOptions) {
	const upstream = await FakeUpstream.start(frames ?? (await loadReplayFrames(FIXTURE_DIR)), {
		speed
	});

	const base = testConfig({ MODE: 'ingest', RELAY_URL: relayUrl, RELAY_SECRET: SECRET });

	const server = await createServer(
		{ ...base, live: { ...base.live, url: upstream.url } },
		{
			now: upstream.now,
			feedBackoff: FAST_BACKOFF,
			relayBackoff: FAST_BACKOFF,
			channelProbeMs: FAST_BACKOFF.initialMs,
			fetchImpl
		}
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

const channelMessageSchema = z.object({
	type: z.string(),
	cars: z.record(z.string(), z.array(z.number())).optional(),
	live: z.object({ positions: z.boolean(), car_data: z.boolean() }).optional()
});

/** A viewer that stays connected and records every message it is sent. */
async function listen(url: string) {
	const socket = new WebSocket(url);
	const messages: z.infer<typeof channelMessageSchema>[] = [];

	socket.on('message', (data) => {
		messages.push(channelMessageSchema.parse(JSON.parse(data.toString())));
	});
	await new Promise<void>((resolve, reject) => {
		socket.once('open', () => resolve());
		socket.once('error', reject);
	});

	return { socket, messages };
}

describe('the telemetry channels through the relay', () => {
	it('carry positions to the viewers that opted in, throttled and batched, and nothing to the others', async () => {
		const relay = await startRelay();
		const mapViewer = await listen(relay.liveUrl);
		const dataViewer = await listen(relay.liveUrl);
		const plainViewer = await listen(relay.liveUrl);
		const pushes: string[][] = [];

		const recording: typeof fetch = async (input, init) => {
			const url = new URL(input instanceof Request ? input.url : input);

			if (url.pathname === '/ingest/channels' && z.string().safeParse(init?.body).success) {
				pushes.push(
					z
						.object({ messages: z.array(z.object({ type: z.string() })) })
						.parse(JSON.parse(String(init?.body)))
						.messages.map(({ type }) => type)
				);
			}

			return fetch(input, init);
		};

		mapViewer.socket.send(JSON.stringify({ type: 'subscribe', channel: 'positions' }));
		dataViewer.socket.send(JSON.stringify({ type: 'subscribe', channel: 'car_data' }));

		// Session time runs 5 times faster than the clock, so the ten seconds take two.
		const ingest = await startIngest({
			relayUrl: relay.baseUrl,
			frames: telemetryFrames(),
			speed: 5,
			fetchImpl: recording
		});

		await waitUntil(
			() => mapViewer.messages.some((message) => message.type === 'positions'),
			'positions to reach the viewer through the relay'
		);
		await ingest.upstream.done;
		await waitUntil(() => pushes.length > 0 && ingest.upstream.sent > 0, 'the pushes');

		const positions = mapViewer.messages.filter((message) => message.type === 'positions');

		assert.equal(Object.keys(positions.at(-1)?.cars ?? {}).length, 20);
		assert.equal(ingest.server.hub, undefined, 'an ingest has no viewers of its own');
		assert.deepEqual(
			mapViewer.messages.filter((message) => message.type === 'car_data'),
			[],
			'a channel the viewer did not ask for is not sent'
		);
		assert.deepEqual(
			mapViewer.messages.findLast((message) => message.type === 'channels')?.live?.positions,
			true
		);
		assert.deepEqual(
			plainViewer.messages.map((message) => message.type).filter((type) => type !== 'state'),
			[]
		);

		// 4 a second at most, however many frames the feed sent in that time.
		assert.ok(positions.length <= 12, `${positions.length} positions in two seconds`);
		assert.ok(
			pushes.some((types) => types.includes('positions') && types.includes('car_data')),
			'both channels of a tick go in one push'
		);

		mapViewer.socket.close();
		dataViewer.socket.close();
		plainViewer.socket.close();
	});

	it('are not pushed while no viewer wants them, and only the wanted channel after one does', async () => {
		const relay = await startRelay();
		const viewer = await listen(relay.liveUrl);
		const pushes: string[][] = [];

		const recording: typeof fetch = async (input, init) => {
			const url = new URL(input instanceof Request ? input.url : input);

			if (url.pathname === '/ingest/channels') {
				pushes.push(
					z
						.object({ messages: z.array(z.object({ type: z.string() })) })
						.parse(JSON.parse(String(init?.body)))
						.messages.map(({ type }) => type)
				);
			}

			return fetch(input, init);
		};

		// Session time runs 2 times faster than the clock, so the ten seconds take five.
		const ingest = await startIngest({
			relayUrl: relay.baseUrl,
			frames: telemetryFrames(),
			speed: 2,
			fetchImpl: recording
		});

		await waitUntil(() => ingest.upstream.sent > 0, 'the feed to start');
		await waitUntil(() => pushes.length > 2, 'the relay to be asked who wants what');
		assert.deepEqual(
			pushes.flat(),
			[],
			'with nobody subscribed the ingest sends no telemetry, only empty pushes'
		);

		viewer.socket.send(JSON.stringify({ type: 'subscribe', channel: 'positions' }));
		await waitUntil(
			() => viewer.messages.some((message) => message.type === 'positions'),
			'positions after the subscription'
		);
		await ingest.upstream.done;

		assert.ok(pushes.flat().includes('positions'));
		assert.equal(pushes.flat().includes('car_data'), false, 'nobody asked for car data');
		viewer.socket.close();
	});

	it('mark a channel as not live once the feed stops sending it', async () => {
		const server = await createServer(
			testConfig({ MODE: 'relay', RELAY_SECRET: SECRET, WS_PING_SECONDS: '0.05' }),
			{ channelSilentMs: 100 }
		);

		stoppers.push(() => server.close());

		const baseUrl = await server.listen();
		const viewer = await listen(`${baseUrl.replace(/^http/, 'ws')}/live`);

		viewer.socket.send(JSON.stringify({ type: 'subscribe', channel: 'positions' }));

		const message = { v: 1, type: 'positions', at: 1, cars: { '1': [0, 0, 1] } };

		await post(baseUrl, '/ingest/channels', { messages: [message] }, SECRET);
		await waitUntil(
			() => viewer.messages.some((entry) => entry.live?.positions === true),
			'the channel to be live'
		);
		await waitUntil(
			() =>
				viewer.messages.findLast((entry) => entry.live !== undefined)?.live?.positions === false,
			'the channel to stop being live'
		);

		// A viewer that subscribes now is not told the channel is live, nor sent the stale message.
		const late = await listen(`${baseUrl.replace(/^http/, 'ws')}/live`);

		late.socket.send(JSON.stringify({ type: 'subscribe', channel: 'positions' }));
		await waitUntil(() => late.messages.some((entry) => entry.type === 'channels'), 'the answer');
		assert.equal(late.messages.find((entry) => entry.type === 'channels')?.live?.positions, false);
		assert.equal(
			late.messages.some((entry) => entry.type === 'positions'),
			false
		);
		viewer.socket.close();
		late.socket.close();
	});

	it('keep serving viewers while the relay is unreachable, and resume afterwards', async () => {
		const relay = await startRelay();
		const viewer = await listen(relay.liveUrl);
		let failing = true;
		let failed = 0;

		const flaky: typeof fetch = (input, init) => {
			if (
				failing &&
				new URL(input instanceof Request ? input.url : input).pathname === '/ingest/channels'
			) {
				failed += 1;

				return Promise.reject(new TypeError('fetch failed'));
			}

			return fetch(input, init);
		};

		viewer.socket.send(JSON.stringify({ type: 'subscribe', channel: 'car_data' }));

		const ingest = await startIngest({
			relayUrl: relay.baseUrl,
			frames: telemetryFrames(),
			speed: 2,
			fetchImpl: flaky
		});

		await waitUntil(() => failed > 0, 'a failed push');
		failing = false;
		await waitUntil(
			() => viewer.messages.some((message) => message.type === 'car_data'),
			'car data after the relay is back'
		);
		await ingest.upstream.done;

		viewer.socket.close();
	});
});

/** An event of the right outer shape that the reducer cannot apply. */
type PoisonedEvent = { kind: string; at: string };

type PushBody = {
	epoch?: string | number;
	from?: number;
	events?: readonly (RaceEvent | PoisonedEvent)[];
	messages?: unknown;
};

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

	it('skip an event the reducer cannot apply, number it, and carry on', async () => {
		const events = await decodeDirectly(FIXTURE_DIR);
		const relay = await startRelay();
		const viewer = await connectViewer(relay.liveUrl);
		const { epoch } = relay.server.session.position;

		const unknownKind = { kind: 'bogus', at: events[0]?.at ?? '' };
		const noLap = { kind: 'lap_completed', at: events[0]?.at ?? '', driverNumber: '1' };

		for (const [index, poisoned] of [unknownKind, noLap].entries()) {
			const from = relay.server.session.position.seq + 1;

			// oxlint-disable-next-line no-await-in-loop -- one batch after the other, as the ingest sends them.
			const result = await post(
				relay.baseUrl,
				'/ingest/events',
				{
					epoch,
					from,
					events: [...events.slice(0, 3), poisoned, ...events.slice(3, 6)]
				},
				SECRET
			);

			assert.deepEqual(
				[result.status, result.body],
				[200, { epoch, seq: (index + 1) * 7 }],
				'the poisoned event keeps its number, so the ingest does not resend the batch'
			);
		}

		const valid = events.slice(0, 6);

		assert.deepEqual(
			relay.server.session.current,
			[...valid, ...valid].reduce(applyEvent, EMPTY_SNAPSHOT)
		);
		await waitUntil(
			() => viewer.replica.seq === relay.server.session.position.seq,
			'the viewer to catch up'
		);
		assert.deepEqual(viewer.replica.snapshot, relay.server.session.current);
		viewer.socket.close();
	});

	it('refuse channel messages without the shared secret or in the wrong shape', async () => {
		const relay = await startRelay();
		const message = { v: 1, type: 'positions', at: 1, cars: { '1': [0, 0, 1] } };

		assert.equal(
			(await post(relay.baseUrl, '/ingest/channels', { messages: [message] })).status,
			401
		);

		for (const messages of [
			[{ ...message, type: 'state' }],
			[{ ...message, cars: { '1': 'x' } }],
			'x'
		]) {
			// oxlint-disable-next-line no-await-in-loop -- few requests, in order.
			const result = await post(relay.baseUrl, '/ingest/channels', { messages }, SECRET);

			assert.equal(result.status, 400);
		}
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
