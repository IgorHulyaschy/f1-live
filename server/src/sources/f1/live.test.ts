import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, afterEach, describe, it } from 'node:test';

import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';

import { backoffDelay, FEED_TOPICS, LiveFeed } from './live.js';
import type { EventLog, FeedFrame, JsonObject, JsonValue } from './live.js';
import { RawWriter } from './raw-writer.js';

const SEPARATOR = '\x1e';

const T0 = Date.parse('2026-10-03T04:15:00.000Z');

const WAIT_MS = 5000;

const PRACTICE_3 = {
	Key: 11729,
	Name: 'Practice 3',
	Path: '2026/2026-10-04_Bahrain_Grand_Prix/2026-10-03_Practice_3/'
};

type FakeHub = {
	url: string;
	negotiations: number;
	subscriptions: JsonValue[];
	pongs: number;
	nextSubscriber: () => Promise<WebSocket>;
	close: () => Promise<void>;
};

/** A local stand-in for the live timing hub: negotiate, handshake, Subscribe and pings. */
async function startFakeHub(earlyFrames: JsonValue[][] = []): Promise<FakeHub> {
	const subscribers: WebSocket[] = [];
	const waiting: ((socket: WebSocket) => void)[] = [];

	const server = createServer((request, response) => {
		if (!request.url?.startsWith('/signalrcore/negotiate')) {
			response.writeHead(404).end();

			return;
		}

		if (request.method === 'OPTIONS') {
			response.writeHead(204, { 'Set-Cookie': 'AWSALBCORS=fake-node; Path=/' }).end();

			return;
		}

		hub.negotiations += 1;
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.end(
			JSON.stringify({
				connectionId: `c${hub.negotiations}`,
				connectionToken: `t${hub.negotiations}`
			})
		);
	});

	const sockets = new WebSocketServer({ server, path: '/signalrcore' });

	sockets.on('connection', (socket) => {
		socket.on('message', (data) => {
			for (const text of data.toString().split(SEPARATOR).filter(Boolean)) {
				const message = JSON.parse(text);

				if (message.protocol === 'json') {
					socket.send(`{}${SEPARATOR}`);
				} else if (message.type === 6) {
					hub.pongs += 1;
				} else if (message.target === 'Subscribe') {
					hub.subscriptions.push(message.arguments[0]);

					for (const args of earlyFrames) {
						sendFeed(socket, args);
					}

					send(socket, {
						type: 3,
						invocationId: message.invocationId,
						result: { SessionInfo: PRACTICE_3, Heartbeat: { Utc: at(T0) } }
					});

					const resolve = waiting.shift();

					if (resolve) {
						resolve(socket);
					} else {
						subscribers.push(socket);
					}
				}
			}
		});
	});

	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

	// SAFETY: a server listening on a TCP port reports an AddressInfo.
	const { port } = server.address() as AddressInfo;

	const hub: FakeHub = {
		url: `http://127.0.0.1:${port.toString()}/signalrcore`,
		negotiations: 0,
		subscriptions: [],
		pongs: 0,
		nextSubscriber: () => {
			const ready = subscribers.shift();

			if (ready) {
				return Promise.resolve(ready);
			}

			return new Promise((resolve, reject) => {
				const timer = setTimeout(() => reject(new Error('no subscriber came')), WAIT_MS);

				waiting.push((socket) => {
					clearTimeout(timer);
					resolve(socket);
				});
			});
		},
		close: async () => {
			for (const client of sockets.clients) {
				client.terminate();
			}

			sockets.close();
			// A second close reports that the server is already stopped, which is fine here.
			await new Promise((resolve) => server.close(resolve));
		}
	};

	cleanups.push(hub.close);

	return hub;
}

function send(socket: WebSocket, message: JsonObject) {
	socket.send(`${JSON.stringify(message)}${SEPARATOR}`);
}

function sendFeed(socket: WebSocket, args: JsonValue[]) {
	send(socket, { type: 1, target: 'feed', arguments: args });
}

function at(ms: number): string {
	return new Date(ms).toISOString();
}

type Recorder = {
	frames: FeedFrame[];
	events: { event: string; reason?: string }[];
	untilFrames: (count: number) => Promise<void>;
	stop: () => Promise<void>;
};

const roots: string[] = [];

// A failed assertion must not leave a socket or server open and hang the run.
const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
	await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

after(() => {
	for (const root of roots) {
		rmSync(root, { recursive: true, force: true });
	}
});

/** The record CLI's wiring, pointed at the fake hub with a fixed writer clock. */
function startRecorder(url: string, root: string, stallMs: number): Recorder {
	const frames: FeedFrame[] = [];
	const events: Recorder['events'] = [];

	const log: EventLog = (event, fields) => {
		events.push({ event, reason: fields?.reason?.toString() });
	};

	const writer = new RawWriter(root, log, () => T0);

	const feed = new LiveFeed(
		{
			url,
			topics: FEED_TOPICS,
			stallMs,
			backoff: { initialMs: 10, maxMs: 50 },
			statsIntervalMs: 60_000,
			log
		},
		{
			onSnapshot: (snapshot) => writer.writeSnapshot(snapshot),
			onFrame: (frame) => {
				writer.writeFrame(frame);
				frames.push(frame);
			}
		}
	);

	const stopper = new AbortController();
	const running = feed.run(stopper.signal);

	const stop = async () => {
		stopper.abort();
		await running;
		writer.close();
	};

	cleanups.push(stop);

	return {
		frames,
		events,
		untilFrames: (count) => until(() => frames.length >= count),
		stop
	};
}

async function until(condition: () => boolean): Promise<void> {
	const deadline = Date.now() + WAIT_MS;

	while (!condition()) {
		assert.ok(Date.now() < deadline, 'timed out waiting for the recorder');
		// oxlint-disable-next-line no-await-in-loop -- polling a condition is sequential.
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
}

/** Parses an archive-format stream back into its offsets and JSON payloads. */
function readStream(file: string): { offset: string; payload: JsonValue }[] {
	const text = readFileSync(file, 'utf8');

	assert.ok(text.startsWith('﻿'), `${file} starts with a BOM`);
	assert.ok(text.endsWith('\r\n'), `${file} ends with CRLF`);

	return text
		.slice(1)
		.split('\r\n')
		.slice(0, -1)
		.map((line) => {
			const match = /^(\d{2}:\d{2}:\d{2}\.\d{3})(.+)$/.exec(line);

			assert.ok(match, `"${line}" is an archive line`);

			const [, offset = '', json = ''] = match;

			return { offset, payload: JSON.parse(json) };
		});
}

function tempRoot(): string {
	const root = mkdtempSync(join(tmpdir(), 'pitwall-live-'));

	roots.push(root);

	return root;
}

describe('backoffDelay', () => {
	it('doubles from the initial delay up to the cap, with half of it jittered', () => {
		const backoff = { initialMs: 1000, maxMs: 30_000 };

		assert.equal(
			backoffDelay(0, backoff, () => 0),
			500
		);
		assert.equal(
			backoffDelay(0, backoff, () => 1),
			1000
		);
		assert.equal(
			backoffDelay(3, backoff, () => 0.5),
			6000
		);
		assert.equal(
			backoffDelay(20, backoff, () => 1),
			30_000
		);
	});
});

describe('LiveFeed against a fake hub', () => {
	it('records every frame in archive format with topics and offsets', async () => {
		const hub = await startFakeHub([['TimingData', { Lines: {} }, at(T0 + 100)]]);
		const root = tempRoot();
		const recorder = startRecorder(hub.url, root, 5000);
		const socket = await hub.nextSubscriber();

		sendFeed(socket, ['CarData.z', 'eJyLjgUAARUAuQ==', at(T0 + 1500)]);
		send(socket, { type: 6 });
		sendFeed(socket, ['TimingData', { Lines: { 44: { Position: '1' } } }, at(T0 + 62_345)]);
		await recorder.untilFrames(3);
		await until(() => hub.pongs === 1);
		await recorder.stop();
		await hub.close();

		const dir = join(root, PRACTICE_3.Path);

		assert.deepEqual(hub.subscriptions, [[...FEED_TOPICS]]);
		assert.deepEqual(readStream(join(dir, 'TimingData.jsonStream')), [
			{ offset: '00:00:00.100', payload: { Lines: {} } },
			{ offset: '00:01:02.345', payload: { Lines: { 44: { Position: '1' } } } }
		]);
		assert.deepEqual(readStream(join(dir, 'CarData.z.jsonStream')), [
			{ offset: '00:00:01.500', payload: 'eJyLjgUAARUAuQ==' }
		]);
		assert.deepEqual(readStream(join(dir, '_subscribe.jsonStream')), [
			{ offset: '00:00:00.000', payload: { SessionInfo: PRACTICE_3, Heartbeat: { Utc: at(T0) } } }
		]);
	});

	it('reconnects after the hub drops the socket, resubscribes and keeps appending', async () => {
		const hub = await startFakeHub();
		const root = tempRoot();
		const recorder = startRecorder(hub.url, root, 5000);
		const first = await hub.nextSubscriber();

		sendFeed(first, ['LapCount', { CurrentLap: 1 }, at(T0 + 1000)]);
		sendFeed(first, ['LapCount', { CurrentLap: 2 }, at(T0 + 2000)]);
		await recorder.untilFrames(2);
		first.terminate();

		const second = await hub.nextSubscriber();

		sendFeed(second, ['LapCount', { CurrentLap: 3 }, at(T0 + 3000)]);
		await recorder.untilFrames(3);
		await recorder.stop();
		await hub.close();

		const dir = join(root, PRACTICE_3.Path);

		assert.equal(hub.negotiations, 2);
		assert.deepEqual(hub.subscriptions, [[...FEED_TOPICS], [...FEED_TOPICS]]);
		assert.ok(recorder.events.some((entry) => entry.event === 'reconnect'));
		assert.deepEqual(readStream(join(dir, 'LapCount.jsonStream')), [
			{ offset: '00:00:01.000', payload: { CurrentLap: 1 } },
			{ offset: '00:00:02.000', payload: { CurrentLap: 2 } },
			{ offset: '00:00:03.000', payload: { CurrentLap: 3 } }
		]);
		assert.equal(readStream(join(dir, '_subscribe.jsonStream')).length, 2);
	});

	it('reconnects when the hub goes silent, without even pings', async () => {
		const hub = await startFakeHub();
		const root = tempRoot();
		const recorder = startRecorder(hub.url, root, 200);

		await hub.nextSubscriber();

		const second = await hub.nextSubscriber();

		sendFeed(second, ['TrackStatus', { Status: '2' }, at(T0 + 500)]);
		await recorder.untilFrames(1);
		await recorder.stop();
		await hub.close();

		const stall = recorder.events.findIndex((entry) => entry.event === 'stall');

		assert.ok(stall >= 0, 'the watchdog logged a stall');
		assert.ok(
			recorder.events
				.slice(stall)
				.some((entry) => entry.event === 'reconnect' && entry.reason === 'stall')
		);
		assert.equal(hub.negotiations >= 2, true);
		assert.deepEqual(readStream(join(root, PRACTICE_3.Path, 'TrackStatus.jsonStream')), [
			{ offset: '00:00:00.500', payload: { Status: '2' } }
		]);
	});
});
