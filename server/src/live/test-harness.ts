import { mkdtempSync, readFileSync } from 'node:fs';
import { cpus, loadavg, tmpdir } from 'node:os';
import path from 'node:path';

import { EMPTY_SNAPSHOT, applyEvent } from '@f1-live/shared';
import type { RaceEvent, RaceSnapshot } from '@f1-live/shared';
import { WebSocket } from 'ws';

import { loadConfig } from '../config.js';
import type { Config } from '../config.js';
import { createServer } from '../main.js';
import type { LiveServer, ServerOptions } from '../main.js';
import { parseJsonStream } from '../sources/f1/archive.js';
import { F1Decoder } from '../sources/f1/decode.js';
import type { TopicFrame } from '../sources/f1/decode.js';
import type { JsonObject } from '../sources/f1/live.js';
import { CAR_DATA_TOPIC, POSITION_TOPIC } from '../sources/f1/telemetry.js';
import { FakeUpstream } from './fake-upstream.js';
import { LiveReplica, parseServerMessage } from './replica.js';
import type { ReplicaStep } from './replica.js';
import { loadReplayFrames } from './replay.js';

export const FIXTURE_DIR = path.join(
	import.meta.dirname,
	'../sources/f1/fixtures/2025-las-vegas-race'
);

const TELEMETRY_FIXTURE_DIR = path.join(
	import.meta.dirname,
	'../sources/f1/fixtures/2025-las-vegas-telemetry'
);

/** Ten seconds of positions and car data of the Las Vegas race, as frames on session time. */
export function telemetryFrames(): TopicFrame[] {
	return [POSITION_TOPIC, CAR_DATA_TOPIC]
		.flatMap((topic) =>
			parseJsonStream(
				topic,
				readFileSync(path.join(TELEMETRY_FIXTURE_DIR, `${topic}.jsonStream`), 'utf8')
			).map((line) => ({ topic, data: line.data, timestamp: 1_763_870_000_000 + line.offsetMs }))
		)
		.toSorted((a, b) => a.timestamp - b.timestamp);
}

/** Longer when the machine is busy, as when several worktrees run their tests at once. */
const WAIT_MS = 20_000 * Math.max(1, (loadavg()[0] ?? 0) / cpus().length);

/** Reconnects and retries in milliseconds, not seconds. */
export const FAST_BACKOFF = { initialMs: 20, maxMs: 40 };

export function tempDir(): string {
	return mkdtempSync(path.join(tmpdir(), 'live-test-'));
}

export function testConfig(env: Record<string, string> = {}): Config {
	return loadConfig({
		PORT: '0',
		LOG_LEVEL: 'silent',
		IMPORT_ON_FINISH: 'false',
		// Nothing listens there: a test never reaches the real archive by accident.
		ARCHIVE_URL: 'http://127.0.0.1:9/static',
		DATA_DIR: tempDir(),
		...env
	});
}

/** A saved session's events, decoded without any live machinery. */
export async function decodeDirectly(directory: string): Promise<RaceEvent[]> {
	const decoder = new F1Decoder();

	return (await loadReplayFrames(directory)).flatMap((frame) => decoder.decode(frame));
}

/** What the archive reader and the reducer make of a session without any live machinery. */
export async function reduceDirectly(directory: string): Promise<RaceSnapshot> {
	return (await decodeDirectly(directory)).reduce(applyEvent, EMPTY_SNAPSHOT);
}

/** Resolves once the session has taken no event for `quietMs`. */
export async function untilQuiet(server: LiveServer, quietMs = 300) {
	let last = -1;
	let since = Date.now();

	await waitUntil(() => {
		const { seq } = server.session.position;

		if (seq !== last) {
			last = seq;
			since = Date.now();
		}

		return seq > 0 && Date.now() - since >= quietMs;
	}, 'the session to settle');
}

export async function waitUntil(condition: () => boolean, what: string, timeoutMs = WAIT_MS) {
	const deadline = Date.now() + timeoutMs;

	while (!condition()) {
		if (Date.now() > deadline) {
			throw new Error(`timed out waiting for ${what}`);
		}

		// oxlint-disable-next-line no-await-in-loop -- polling.
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
}

export interface Playback {
	upstream: FakeUpstream;
	server: LiveServer;
	frames: TopicFrame[];
	/** ws:// URL of the server's /live. */
	liveUrl: string;
	/** http:// base URL of the server. */
	baseUrl: string;
	stop: () => Promise<void>;
}

export interface PlaybackOptions {
	speed?: number;
	env?: Record<string, string>;
	server?: ServerOptions;
	dropAfter?: readonly number[];
	/** Topics the fake hub already holds when the server subscribes. */
	snapshot?: JsonObject;
}

/** A server in mode `all` fed from a fake upstream playing `frames`, unpaced unless told. */
export async function startPlayback(
	frames: TopicFrame[],
	options: PlaybackOptions = {}
): Promise<Playback> {
	const upstream = await FakeUpstream.start(frames, {
		speed: options.speed ?? Number.POSITIVE_INFINITY,
		dropAfter: options.dropAfter,
		snapshot: options.snapshot
	});

	const base = testConfig(options.env);

	const server = await createServer(
		{ ...base, live: { ...base.live, url: upstream.url } },
		{ now: upstream.now, feedBackoff: FAST_BACKOFF, ...options.server }
	);

	const address = await server.listen();

	return {
		upstream,
		server,
		frames,
		baseUrl: address,
		liveUrl: `${address.replace(/^http/, 'ws')}/live`,
		stop: async () => {
			await server.close();
			await upstream.close();
		}
	};
}

export interface Viewer {
	replica: LiveReplica;
	socket: WebSocket;
	/** Message types in arrival order. */
	received: string[];
	resyncs: number;
	closed: Promise<number>;
}

/** Connects like the reference client: applies messages and asks for a resync when told to. */
export async function connectViewer(url: string): Promise<Viewer> {
	const socket = new WebSocket(url);

	const viewer: Viewer = {
		replica: new LiveReplica(),
		socket,
		received: [],
		resyncs: 0,
		closed: new Promise((resolve) => socket.on('close', (code) => resolve(code)))
	};

	socket.on('message', (data) => {
		const message = parseServerMessage(data.toString());

		if (!message) {
			return;
		}

		viewer.received.push(message.type);

		const step: ReplicaStep = viewer.replica.apply(message);

		if (step === 'resync') {
			viewer.resyncs += 1;
			socket.send(JSON.stringify({ type: 'resync' }));
		}
	});

	await new Promise<void>((resolve, reject) => {
		socket.once('open', () => resolve());
		socket.once('error', reject);
	});

	return viewer;
}
