import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import { WebSocket } from 'ws';
import { z } from 'zod';

import { parseJsonStream } from '../sources/f1/archive.js';
import { CAR_DATA_TOPIC, POSITION_TOPIC } from '../sources/f1/telemetry.js';
import { startPlayback, waitUntil } from './test-harness.js';
import type { Playback } from './test-harness.js';
import { parseServerMessage } from './replica.js';

const FIXTURES = path.join(import.meta.dirname, '../sources/f1/fixtures/2025-las-vegas-telemetry');

/** The ten seconds of positions and car data, spread over ten seconds of session time. */
function telemetryFrames() {
	return [POSITION_TOPIC, CAR_DATA_TOPIC]
		.flatMap((topic) =>
			parseJsonStream(topic, readFileSync(path.join(FIXTURES, `${topic}.jsonStream`), 'utf8')).map(
				(line) => ({ topic, data: line.data, timestamp: 1_763_870_000_000 + line.offsetMs })
			)
		)
		.toSorted((a, b) => a.timestamp - b.timestamp);
}

const messageSchema = z.object({
	v: z.number().optional(),
	type: z.string(),
	subscribed: z.array(z.string()).optional(),
	live: z.object({ positions: z.boolean(), car_data: z.boolean() }).optional(),
	cars: z.record(z.string(), z.array(z.number())).optional()
});

interface Seen {
	socket: WebSocket;
	messages: z.infer<typeof messageSchema>[];
}

async function connect(url: string): Promise<Seen> {
	const socket = new WebSocket(url);
	const seen: Seen = { socket, messages: [] };

	socket.on('message', (data) => {
		seen.messages.push(messageSchema.parse(JSON.parse(data.toString())));
	});
	await new Promise<void>((resolve, reject) => {
		socket.once('open', () => resolve());
		socket.once('error', reject);
	});

	return seen;
}

const running: Playback[] = [];

after(async () => {
	await Promise.all(running.map((playback) => playback.stop()));
});

describe('the opt-in telemetry channels of WS /live', () => {
	it('send positions and car data to a viewer that subscribed, and nothing to one that did not', async () => {
		// Session time runs 5 times faster than the clock, so the ten seconds take two.
		const playback = await startPlayback(telemetryFrames(), { speed: 5 });

		running.push(playback);

		const mapViewer = await connect(playback.liveUrl);
		const plainViewer = await connect(playback.liveUrl);

		mapViewer.socket.send(JSON.stringify({ type: 'subscribe', channel: 'positions' }));
		mapViewer.socket.send(JSON.stringify({ type: 'subscribe', channel: 'car_data' }));

		await waitUntil(
			() =>
				mapViewer.messages.some((message) => message.type === 'positions') &&
				mapViewer.messages.some((message) => message.type === 'car_data'),
			'both channels to arrive'
		);
		await playback.upstream.done;

		const positions = mapViewer.messages.find((message) => message.type === 'positions');

		assert.equal(Object.keys(positions?.cars ?? {}).length, 20);
		assert.equal(positions?.v, 1);

		const channels = mapViewer.messages.filter((message) => message.type === 'channels');

		assert.deepEqual(channels[0]?.subscribed, ['positions']);
		assert.deepEqual(channels.at(-1)?.subscribed, ['positions', 'car_data']);

		assert.deepEqual(
			plainViewer.messages.map((message) => message.type).filter((type) => type !== 'state'),
			[],
			'a viewer that did not subscribe receives only what it did before'
		);

		mapViewer.socket.close();
		plainViewer.socket.close();
	});

	it('answer a subscriber with what the feed has, and give a late one the last message', async () => {
		const playback = await startPlayback(telemetryFrames(), { speed: 5 });

		running.push(playback);

		const early = await connect(playback.liveUrl);

		early.socket.send(JSON.stringify({ type: 'subscribe', channel: 'positions' }));
		await waitUntil(
			() => early.messages.some((message) => message.type === 'positions'),
			'a frame'
		);
		await playback.upstream.done;
		await waitUntil(() => playback.server.hub?.wants('positions') === true, 'the subscription');

		const late = await connect(playback.liveUrl);

		late.socket.send(JSON.stringify({ type: 'subscribe', channel: 'positions' }));
		await waitUntil(
			() => late.messages.some((message) => message.type === 'positions'),
			'the last frame'
		);

		const reply = late.messages.find((message) => message.type === 'channels');

		assert.deepEqual(reply?.live, { positions: true, car_data: true });

		late.socket.send(JSON.stringify({ type: 'unsubscribe', channel: 'positions' }));
		await waitUntil(
			() => late.messages.filter((message) => message.type === 'channels').length === 2,
			'the unsubscribe answer'
		);
		assert.deepEqual(
			late.messages.filter((message) => message.type === 'channels')[1]?.subscribed,
			[]
		);

		early.socket.close();
		late.socket.close();
	});

	it('ignore a subscription to a channel that does not exist, and keep serving resyncs', async () => {
		const playback = await startPlayback([], {});

		running.push(playback);

		const viewer = await connect(playback.liveUrl);

		viewer.socket.send(JSON.stringify({ type: 'subscribe', channel: 'nope' }));
		viewer.socket.send('not json');
		viewer.socket.send(JSON.stringify({ type: 'resync' }));
		await waitUntil(
			() => viewer.messages.filter((message) => message.type === 'state').length === 2,
			'a resync'
		);

		assert.equal(
			viewer.messages.some((message) => message.type === 'channels'),
			false
		);
		assert.equal(parseServerMessage(JSON.stringify({ v: 1, type: 'positions' })), null);

		viewer.socket.close();
	});
});
