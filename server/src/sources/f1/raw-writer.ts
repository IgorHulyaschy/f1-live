import {
	closeSync,
	fstatSync,
	mkdirSync,
	openSync,
	readFileSync,
	writeFileSync,
	writeSync
} from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import type { EventLog, FeedFrame, FeedSnapshot, JsonValue } from './live.js';

const BOM = '﻿';

const SESSION_TOPIC = 'SessionInfo';

// Sidecars start with an underscore so they never collide with a topic's stream.
const RECORDING_FILE = '_recording.json';

const SUBSCRIBE_FILE = '_subscribe.jsonStream';

/** `2025/2025-11-09_São_Paulo_Grand_Prix/2025-11-09_Race/`, never anything that climbs out. */
const ARCHIVE_PATH = /^\d{4}\/[\p{L}\p{N}_-]+\/[\p{L}\p{N}_-]+\/$/u;

const TOPIC_NAME = /^\w[\w.]*$/;

const FAILURE_LOG_EVERY = 1000;

const sessionInfoSchema = z.object({ Key: z.number(), Path: z.string().optional() });

const recordingSchema = z.object({ key: z.number(), path: z.string(), origin: z.iso.datetime() });

type SessionRef = { key: number; path: string };

type OpenSession = SessionRef & {
	dir: string;
	originMs: number;
	streams: Map<string, number>;
};

/**
 * Appends live frames to `<root>/<archive path>/<Topic>.jsonStream` in the archive's line
 * format, so a recording imports exactly like a downloaded session. Files are only ever
 * appended to: a reconnect or a restart continues the same streams and offsets.
 */
export class RawWriter {
	private readonly rootDir: string;
	private readonly log: EventLog;
	private readonly now: () => number;
	private session: OpenSession | null = null;
	private failures = 0;

	constructor(rootDir: string, log: EventLog, now: () => number = Date.now) {
		this.rootDir = rootDir;
		this.log = log;
		this.now = now;
	}

	/** Every subscribe result is kept, so state lost during a reconnect can be rebuilt. */
	writeSnapshot(snapshot: FeedSnapshot): void {
		const at = this.now();

		this.guard('snapshot', () => {
			this.switchTo(readSessionRef(snapshot[SESSION_TOPIC]), at);
			this.append(SUBSCRIBE_FILE, snapshot, at);
		});
	}

	writeFrame(frame: FeedFrame): void {
		const sent = frame.timestamp === null ? Number.NaN : Date.parse(frame.timestamp);
		const at = Number.isNaN(sent) ? this.now() : sent;

		this.guard(frame.topic, () => {
			if (frame.topic === SESSION_TOPIC) {
				// A new session starts its streams at the SessionInfo that announces it.
				this.switchTo(readSessionRef(frame.payload), at);
			}

			if (!TOPIC_NAME.test(frame.topic)) {
				throw new Error(`unsafe topic name ${frame.topic}`);
			}

			this.append(`${frame.topic}.jsonStream`, frame.payload, at);
		});
	}

	close(): void {
		this.closeStreams();
		this.session = null;
	}

	private guard(topic: string, write: () => void) {
		try {
			write();
		} catch (cause) {
			this.failures += 1;

			if (this.failures === 1 || this.failures % FAILURE_LOG_EVERY === 0) {
				this.log('write-failed', {
					topic,
					failures: this.failures,
					error: cause instanceof Error ? cause.message : String(cause)
				});
			}
		}
	}

	private switchTo(ref: SessionRef | null, at: number) {
		if (!ref || ref.key === this.session?.key) {
			return;
		}

		this.closeStreams();

		const dir = join(this.rootDir, ref.path);

		mkdirSync(dir, { recursive: true });

		const { originMs, resumed } = this.origin(dir, ref, at);

		this.session = { ...ref, dir, originMs, streams: new Map() };
		this.log('session', {
			key: ref.key,
			path: ref.path,
			origin: new Date(originMs).toISOString(),
			resumed
		});
	}

	/** The first sight of a session fixes offset zero; a restart reads it back from disk. */
	private origin(dir: string, ref: SessionRef, at: number) {
		const file = join(dir, RECORDING_FILE);
		const recording = { ...ref, origin: new Date(at).toISOString() };

		try {
			writeFileSync(file, `${JSON.stringify(recording)}\n`, { flag: 'wx' });

			return { originMs: at, resumed: false };
		} catch (cause) {
			if (!isErrorCode(cause, 'EEXIST')) {
				throw cause;
			}
		}

		const saved = recordingSchema.parse(JSON.parse(readFileSync(file, 'utf8')));

		return { originMs: Date.parse(saved.origin), resumed: true };
	}

	private append(fileName: string, value: JsonValue, at: number) {
		const session = this.session;

		if (!session) {
			throw new Error('no session yet: the subscribe result had no SessionInfo');
		}

		let fd = session.streams.get(fileName);

		if (fd === undefined) {
			fd = openSync(join(session.dir, fileName), 'a');

			if (fstatSync(fd).size === 0) {
				writeSync(fd, BOM);
			}

			session.streams.set(fileName, fd);
		}

		writeSync(fd, `${formatOffset(at - session.originMs)}${JSON.stringify(value)}\r\n`);
	}

	private closeStreams() {
		for (const fd of this.session?.streams.values() ?? []) {
			closeSync(fd);
		}

		this.session?.streams.clear();
	}
}

/** `HH:MM:SS.mmm`, the archive's offset from the start of the session's streams. */
export function formatOffset(ms: number): string {
	const total = Math.max(0, Math.round(ms));
	const hours = Math.floor(total / 3_600_000);
	const minutes = Math.floor(total / 60_000) % 60;
	const seconds = Math.floor(total / 1000) % 60;

	return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(total % 1000, 3)}`;
}

function pad(value: number, width: number): string {
	return value.toString().padStart(width, '0');
}

function readSessionRef(info: JsonValue | undefined): SessionRef | null {
	const parsed = sessionInfoSchema.safeParse(info);

	if (!parsed.success) {
		return null;
	}

	const { Key: key, Path: path } = parsed.data;

	// A session without a safe archive path still records, under its key.
	return {
		key,
		path: path !== undefined && ARCHIVE_PATH.test(path) ? path : `unindexed/${key.toString()}/`
	};
}

function isErrorCode(cause: unknown, code: string): boolean {
	return cause instanceof Error && 'code' in cause && cause.code === code;
}
