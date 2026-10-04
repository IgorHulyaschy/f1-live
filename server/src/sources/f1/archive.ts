import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

import { z } from 'zod';

import { F1_TOPICS } from './decode.js';
import type { TopicFrame } from './decode.js';

/** Where raw sessions are kept: `data/raw/<archive path>/<Topic>.jsonStream` at the repository root. */
export const RAW_DATA_DIR = path.resolve(import.meta.dirname, '../../../../data/raw');

/** Topics whose lines carry a `Utc` time, which pins a stream's offsets to the clock. */
export const CLOCK_TOPICS = ['ExtrapolatedClock', 'Heartbeat'] as const;

const STREAM_SUFFIX = '.jsonStream';

/** A live recording's sidecars (raw-writer.ts): when its offsets start, and each subscribe result. */
const RECORDING_FILE = '_recording.json';

const SUBSCRIBE_STREAM = '_subscribe';

/** One line of a `<Topic>.jsonStream` file. */
export interface StreamLine {
	/** Since the start of the stream. */
	offsetMs: number;
	data: unknown;
}

const LINE = /^(\d+):(\d{2}):(\d{2})\.(\d{3})(.*)$/;

const clockSchema = z.object({ Utc: z.string() });

const recordingSchema = z.object({ origin: z.iso.datetime() });

const subscribeSchema = z.record(z.string(), z.unknown());

/** Parses a `<Topic>.jsonStream` file: a UTF-8 BOM, then lines of `HH:MM:SS.mmm{json}`. */
export function parseJsonStream(topic: string, text: string): StreamLine[] {
	return text
		.replace(/^\uFEFF/, '')
		.split(/\r?\n/)
		.flatMap((line, index) => {
			if (line.trim() === '') {
				return [];
			}

			const match = LINE.exec(line);

			if (!match) {
				throw new Error(`${topic}.jsonStream line ${index + 1}: expected HH:MM:SS.mmm and JSON`);
			}

			const [, hours, minutes, seconds, millis, json = ''] = match;

			const offsetMs =
				((Number(hours) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000 + Number(millis);

			return [{ offsetMs, data: JSON.parse(json) }];
		});
}

/**
 * When a stream started, in milliseconds since the Unix epoch, from the first clock line.
 * ExtrapolatedClock matches the session's own clock; Heartbeat runs about two seconds late.
 */
export function streamStartedAt(streams: ReadonlyMap<string, readonly StreamLine[]>): number {
	for (const topic of CLOCK_TOPICS) {
		for (const line of streams.get(topic) ?? []) {
			const clock = clockSchema.safeParse(line.data);
			const utc = clock.success ? Date.parse(clock.data.Utc) : Number.NaN;

			if (Number.isFinite(utc)) {
				return utc - line.offsetMs;
			}
		}
	}

	throw new Error(`No ${CLOCK_TOPICS.join(' or ')} line with a Utc time to place the stream`);
}

/** Every topic in one stream, in time order; frames at the same instant keep the topic order. */
export function mergeStreams(
	streams: ReadonlyMap<string, readonly StreamLine[]>,
	startedAt: number
): TopicFrame[] {
	return [...streams]
		.flatMap(([topic, lines]) =>
			lines.map((line) => ({ topic, data: line.data, timestamp: startedAt + line.offsetMs }))
		)
		.toSorted((a, b) => a.timestamp - b.timestamp);
}

/** The topics a session directory holds, including compressed ones such as `CarData.z`. */
export async function archiveTopics(directory: string): Promise<string[]> {
	return (await readdir(directory))
		.filter((file) => file.endsWith(STREAM_SUFFIX) && !file.startsWith('_'))
		.map((file) => file.slice(0, -STREAM_SUFFIX.length));
}

/**
 * The JSON text inside a compressed topic's payload (`CarData.z`, `Position.z`): base64 of raw
 * deflate. Parse it with that topic's own schema.
 */
export function inflatePayload(payload: string): string {
	return inflateRawSync(Buffer.from(payload, 'base64')).toString('utf8');
}

async function readStream(directory: string, name: string): Promise<StreamLine[]> {
	const text = await readFile(path.join(directory, `${name}${STREAM_SUFFIX}`), 'utf8');

	return parseJsonStream(name, text);
}

/**
 * Each topic's lines from a live recording's subscribe results: the full state of every topic
 * at that moment, which the topic's own stream only updates.
 */
function subscribedLines(lines: readonly StreamLine[]): Map<string, StreamLine[]> {
	const byTopic = new Map<string, StreamLine[]>();

	for (const { offsetMs, data } of lines) {
		for (const [topic, state] of Object.entries(subscribeSchema.parse(data))) {
			byTopic.set(topic, [...(byTopic.get(topic) ?? []), { offsetMs, data: state }]);
		}
	}

	return byTopic;
}

/**
 * Reads a session's `<Topic>.jsonStream` files as frames of any topic, the decoder's by default;
 * a topic without a file is skipped. A live recording's subscribe results come first at their
 * offset, and its own origin places it in time. A stream in `overlay`, another download of the
 * same session, stands in for the directory's.
 */
export async function readArchive(
	directory: string,
	topics: readonly string[] = F1_TOPICS,
	overlay?: string
): Promise<TopicFrame[]> {
	const files = new Set(await readdir(directory));
	const overlaid = new Set(overlay === undefined ? [] : await readdir(overlay));

	const folderOf = (topic: string): string | null => {
		const file = `${topic}${STREAM_SUFFIX}`;

		if (overlay !== undefined && overlaid.has(file)) {
			return overlay;
		}

		return files.has(file) ? directory : null;
	};

	const subscribed = files.has(`${SUBSCRIBE_STREAM}${STREAM_SUFFIX}`)
		? subscribedLines(await readStream(directory, SUBSCRIBE_STREAM))
		: new Map<string, StreamLine[]>();

	const wanted = [...new Set([...topics, ...CLOCK_TOPICS])].filter(
		(topic) => folderOf(topic) !== null || subscribed.has(topic)
	);

	const streams = new Map(
		await Promise.all(
			wanted.map(async (topic) => {
				const folder = folderOf(topic);
				const own = folder === null ? [] : await readStream(folder, topic);
				const lines = [...(subscribed.get(topic) ?? []), ...own];

				return [topic, lines.toSorted((a, b) => a.offsetMs - b.offsetMs)] as const;
			})
		)
	);

	const startedAt = files.has(RECORDING_FILE)
		? await recordingOrigin(directory)
		: streamStartedAt(streams);

	return mergeStreams(new Map([...streams].filter(([topic]) => topics.includes(topic))), startedAt);
}

async function recordingOrigin(directory: string): Promise<number> {
	const text = await readFile(path.join(directory, RECORDING_FILE), 'utf8');

	return Date.parse(recordingSchema.parse(JSON.parse(text)).origin);
}
