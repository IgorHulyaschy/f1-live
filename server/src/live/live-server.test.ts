import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import type { RaceControlEvent } from '@f1-live/shared';
import { WebSocket } from 'ws';

import { RAW_DATA_DIR } from '../sources/f1/archive.js';
import { parseServerMessage } from './replica.js';
import {
	FIXTURE_DIR,
	connectViewer,
	decodeDirectly,
	reduceDirectly,
	startPlayback,
	untilQuiet,
	waitUntil
} from './test-harness.js';
import type { Playback } from './test-harness.js';
import { loadReplayFrames } from './replay.js';

const LAS_VEGAS_DIR = path.join(
	RAW_DATA_DIR,
	'2025/2025-11-22_Las_Vegas_Grand_Prix/2025-11-22_Race'
);

const running: Playback[] = [];

after(async () => {
	await Promise.all(running.map((playback) => playback.stop()));
});

describe('the live path replays a saved session', () => {
	for (const [name, directory, skip] of [
		['the trimmed Las Vegas fixture', FIXTURE_DIR, false],
		[
			'the whole 2025 Las Vegas race',
			LAS_VEGAS_DIR,
			!existsSync(path.join(LAS_VEGAS_DIR, 'TimingData.jsonStream')) &&
				`no raw data in ${LAS_VEGAS_DIR}; run npm run fetch:f1 -w server -- 9858`
		]
	] as const) {
		it(`ends with the state the reducer builds from the archive: ${name}`, { skip }, async () => {
			const expected = await reduceDirectly(directory);
			const frames = await loadReplayFrames(directory);
			const playback = await startPlayback(frames);

			running.push(playback);

			const viewer = await connectViewer(playback.liveUrl);

			await playback.upstream.done;
			await untilQuiet(playback.server);
			await waitUntil(
				() => viewer.replica.seq === playback.server.session.position.seq,
				'the viewer to catch up'
			);

			assert.deepEqual(playback.server.session.current, expected);
			assert.deepEqual(viewer.replica.snapshot, expected);
			assert.equal(viewer.resyncs, 0);
			assert.equal(viewer.replica.snapshot.status, 'ended');

			viewer.socket.close();
		});
	}

	it('keeps going when the upstream drops mid-replay', async () => {
		const expected = await reduceDirectly(FIXTURE_DIR);
		const frames = await loadReplayFrames(FIXTURE_DIR);
		const playback = await startPlayback(frames, { dropAfter: [40, 90] });

		running.push(playback);

		await playback.upstream.done;
		await untilQuiet(playback.server);

		assert.deepEqual(playback.server.session.current, expected);
		assert.equal(playback.upstream.connections, 3);
	});
});

/** A server with no upstream traffic, whose session the test feeds by hand. */
async function startEmpty(env: Record<string, string> = {}) {
	const playback = await startPlayback([], { env });

	running.push(playback);

	return playback;
}

function bigRaceControl(lap: number, size: number): RaceControlEvent {
	return {
		kind: 'race_control',
		at: '2025-11-22T06:00:00.000Z',
		message: { lap, category: 'other', message: 'x'.repeat(size) }
	};
}

describe('viewers', () => {
	it('start with the full state and then follow the events', async () => {
		const events = await decodeDirectly(FIXTURE_DIR);
		const { server, liveUrl } = await startEmpty();

		server.session.push(events.slice(0, 20));

		const viewer = await connectViewer(liveUrl);

		await waitUntil(() => viewer.received.length > 0, 'the state');
		assert.equal(viewer.received[0], 'state');
		assert.equal(viewer.replica.seq, 20);

		server.session.push(events.slice(20));
		await waitUntil(() => viewer.replica.seq === events.length, 'the events');
		assert.equal(viewer.received[1], 'events');
		assert.deepEqual(viewer.replica.snapshot, server.session.current);
		viewer.socket.close();
	});

	it('get exactly the missed events when they reconnect with since', async () => {
		const events = await decodeDirectly(FIXTURE_DIR);
		const { server, liveUrl } = await startEmpty();

		server.session.push(events.slice(0, 30));

		const first = await connectViewer(liveUrl);

		await waitUntil(() => first.replica.seq === 30, 'the first state');
		first.socket.close();
		await first.closed;
		server.session.push(events.slice(30, 80));

		const { epoch, seq } = first.replica;
		const messages: string[] = [];
		const second = new WebSocket(`${liveUrl}?epoch=${epoch}&since=${seq}`);

		second.on('message', (data) => messages.push(data.toString()));
		await waitUntil(() => messages.length > 0, 'the catch-up');

		const catchUp = parseServerMessage(messages[0] ?? '');

		assert.equal(catchUp?.type, 'events');
		assert.equal(catchUp?.type === 'events' && catchUp.from, 31);
		assert.deepEqual(catchUp?.type === 'events' && catchUp.events, events.slice(30, 80));
		second.close();
	});

	it('get a fresh state when the events they missed are gone or from another epoch', async () => {
		const events = await decodeDirectly(FIXTURE_DIR);
		const { server, liveUrl } = await startEmpty({ LIVE_LOG_EVENTS: '10' });

		server.session.push(events.slice(0, 100));

		const { epoch } = server.session.position;

		for (const query of [
			`epoch=${epoch}&since=5`,
			`epoch=${epoch}&since=500`,
			'epoch=other&since=3'
		]) {
			const messages: string[] = [];
			const socket = new WebSocket(`${liveUrl}?${query}`);

			socket.on('message', (data) => messages.push(data.toString()));
			// oxlint-disable-next-line no-await-in-loop -- one connection per query.
			await waitUntil(() => messages.length > 0, `a reply to ${query}`);
			assert.equal(parseServerMessage(messages[0] ?? '')?.type, 'state', query);
			socket.close();
		}
	});

	it('are sent a new state when another session starts', async () => {
		const events = await decodeDirectly(FIXTURE_DIR);
		const { server, liveUrl } = await startEmpty();

		server.session.push(events.slice(0, 40));

		const viewer = await connectViewer(liveUrl);

		await waitUntil(() => viewer.replica.seq === 40, 'the first session');

		const before = viewer.replica.epoch;
		const [info] = events;

		if (info?.kind !== 'session_info') {
			throw new Error('the fixture should open with session_info');
		}

		server.session.push([{ ...info, session: { ...info.session, id: '9999' } }]);
		await waitUntil(() => viewer.replica.epoch !== before, 'the new epoch');
		assert.equal(viewer.replica.seq, 1);
		assert.equal(viewer.replica.snapshot.session.id, '9999');
		assert.equal(viewer.resyncs, 0);
		viewer.socket.close();
	});

	it('ask for a resync and get a fresh state', async () => {
		const { server, liveUrl } = await startEmpty();
		const viewer = await connectViewer(liveUrl);

		await waitUntil(() => viewer.received.includes('state'), 'the first state');
		server.session.push([bigRaceControl(1, 10)]);
		await waitUntil(() => viewer.replica.seq === 1, 'the first event');

		viewer.socket.send(JSON.stringify({ type: 'resync' }));
		await waitUntil(
			() => viewer.received.filter((type) => type === 'state').length === 2,
			'the resync'
		);
		viewer.socket.close();
	});

	it('are cut off when they cannot keep up, without holding the others back', async () => {
		const { server, liveUrl } = await startEmpty({ WS_MAX_BUFFER_BYTES: '262144' });
		const healthy = await connectViewer(liveUrl);
		const slow = await connectViewer(liveUrl);

		await waitUntil(
			() => healthy.replica.epoch !== null && slow.replica.epoch !== null,
			'both states'
		);
		slow.socket.pause();

		const { hub } = server;

		assert.ok(hub);
		let lap = 0;

		while (hub.slowDropped === 0 && lap < 4000) {
			lap += 1;
			server.session.push([bigRaceControl(lap, 20_000)]);
			// oxlint-disable-next-line no-await-in-loop -- lets the hub flush each event.
			await new Promise((resolve) => setImmediate(resolve));
		}

		assert.equal(hub.slowDropped, 1);
		assert.equal(hub.size, 1);
		await waitUntil(
			() => healthy.replica.seq === server.session.position.seq,
			'the healthy viewer'
		);
		assert.equal(healthy.replica.seq, lap);
		healthy.socket.close();
		slow.socket.terminate();
	});

	it('are dropped when they stop answering pings', async () => {
		const { server, liveUrl } = await startEmpty({ WS_PING_SECONDS: '0.05' });
		const quiet = new WebSocket(liveUrl, { autoPong: false });

		await new Promise((resolve) => quiet.once('open', resolve));
		await waitUntil(() => server.hub?.size === 1, 'the viewer to register');
		await waitUntil(() => server.hub?.size === 0, 'the viewer to be dropped');
		quiet.terminate();
	});

	it('are refused from an origin that is not allowed', async () => {
		const { liveUrl } = await startEmpty({ CORS_ORIGINS: 'https://app.example.com' });

		const refused = new WebSocket(liveUrl, { origin: 'https://evil.example.com' });
		const error = await new Promise<Error>((resolve) => refused.once('error', resolve));

		assert.match(error.message, /403/);

		const allowed = new WebSocket(liveUrl, { origin: 'https://app.example.com' });

		await new Promise((resolve) => allowed.once('open', resolve));
		allowed.close();
	});
});
