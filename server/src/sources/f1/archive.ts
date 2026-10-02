import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

import { z } from 'zod';

import { F1_TOPICS } from './decode.ts';
import type { TopicFrame } from './decode.ts';

/** Where raw sessions are kept: `data/raw/<archive path>/<Topic>.jsonStream` at the repository root. */
export const RAW_DATA_DIR = path.resolve(import.meta.dirname, '../../../../data/raw');

/** Topics whose lines carry a `Utc` time, which pins a stream's offsets to the clock. */
export const CLOCK_TOPICS = ['ExtrapolatedClock', 'Heartbeat'] as const;

/** One line of a `<Topic>.jsonStream` file. */
export interface StreamLine {
	/** Since the start of the stream. */
	offsetMs: number;
	data: unknown;
}

const LINE = /^(\d+):(\d{2}):(\d{2})\.(\d{3})(.*)$/;

const clockSchema = z.object({ Utc: z.string() });

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
	const suffix = '.jsonStream';

	return (await readdir(directory))
		.filter((file) => file.endsWith(suffix))
		.map((file) => file.slice(0, -suffix.length));
}

/**
 * The JSON text inside a compressed topic's payload (`CarData.z`, `Position.z`): base64 of raw
 * deflate. Parse it with that topic's own schema.
 */
export function inflatePayload(payload: string): string {
	return inflateRawSync(Buffer.from(payload, 'base64')).toString('utf8');
}

/**
 * Reads a session's `<Topic>.jsonStream` files as frames of any topic, the decoder's by default;
 * a topic without a file is skipped.
 */
export async function readArchive(
	directory: string,
	topics: readonly string[] = F1_TOPICS
): Promise<TopicFrame[]> {
	const present = new Set(await archiveTopics(directory));
	const wanted = [...new Set([...topics, ...CLOCK_TOPICS])].filter((topic) => present.has(topic));

	const streams = new Map(
		await Promise.all(
			wanted.map(async (topic) => {
				const text = await readFile(path.join(directory, `${topic}.jsonStream`), 'utf8');

				return [topic, parseJsonStream(topic, text)] as const;
			})
		)
	);

	const startedAt = streamStartedAt(streams);

	return mergeStreams(new Map([...streams].filter(([topic]) => topics.includes(topic))), startedAt);
}
