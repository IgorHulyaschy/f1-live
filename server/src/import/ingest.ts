import { rm } from 'node:fs/promises';

import { EMPTY_SNAPSHOT, applyEvent } from '@f1-live/shared';
import type { RaceEvent } from '@f1-live/shared';

import { readArchive } from '../sources/f1/archive.js';
import { F1Decoder } from '../sources/f1/decode.js';
import type { TopicFrame } from '../sources/f1/decode.js';
import { ManualCorrections } from '../sources/manual/corrections.js';
import { OpenF1Corrections } from '../sources/openf1/session-result.js';
import { folderBytes, writeErrors, writeEvents, writeSnapshot } from '../sinks/files.js';
import type { TopicFailure } from '../sinks/files.js';
import { buildTelemetry } from '../telemetry/build.js';
import { sessionTelemetryDir } from '../telemetry/files.js';
import { mergeCorrections } from './corrections.js';
import type { CorrectionSource } from './corrections.js';

const SAMPLES_PER_TOPIC = 5;

export interface IngestInput {
	/** The session's `<Topic>.jsonStream` files: an archive folder or a live recording. */
	rawDir: string;
	/** The archive key, e.g. 9858. */
	key: number;
	dataDir: string;
	/** Later sources win a conflict; the default is OpenF1, then the committed manual file. */
	corrections?: readonly CorrectionSource[];
	/** Build the telemetry too, for a session whose raw files have Position.z. Default: yes. */
	telemetry?: boolean;
}

/** What building a session's telemetry came to; it never fails the session's other outputs. */
export type TelemetryOutcome =
	| { status: 'built'; bytes: number }
	| { status: 'skipped'; reason: string }
	| { status: 'failed'; reason: string }
	| { status: 'off' };

export interface IngestResult {
	key: number;
	events: number;
	corrections: number;
	eventsBytes: number;
	snapshotBytes: number;
	/** Topics with a frame the decoder rejected; the rest of the session still decoded. */
	failures: TopicFailure[];
	telemetry: TelemetryOutcome;
}

interface DecodedFrames {
	events: RaceEvent[];
	failures: TopicFailure[];
}

function decodeFrames(frames: readonly TopicFrame[]): DecodedFrames {
	const decoder = new F1Decoder();
	const events: RaceEvent[] = [];
	const failures = new Map<string, TopicFailure>();

	for (const frame of frames) {
		try {
			events.push(...decoder.decode(frame));
		} catch (error) {
			const failure = failures.get(frame.topic) ?? { topic: frame.topic, frames: 0, samples: [] };

			failure.frames += 1;

			if (failure.samples.length < SAMPLES_PER_TOPIC) {
				failure.samples.push({
					at: new Date(frame.timestamp).toISOString(),
					message: error instanceof Error ? error.message : String(error)
				});
			}

			failures.set(frame.topic, failure);
		}
	}

	return {
		events,
		failures: [...failures.values()].toSorted((a, b) => a.topic.localeCompare(b.topic))
	};
}

/**
 * A session without telemetry in its raw files has none in the outputs either, so a folder left by
 * an earlier build is removed; a build that fails does not touch what is there.
 */
async function ingestTelemetry(input: IngestInput): Promise<TelemetryOutcome> {
	const { rawDir, key, dataDir } = input;

	try {
		const report = await buildTelemetry({ rawDir, key, dataDir });

		if (report.status === 'skipped') {
			await rm(sessionTelemetryDir(dataDir, key), { recursive: true, force: true });

			return { status: 'skipped', reason: report.reason };
		}

		return { status: 'built', bytes: await folderBytes(sessionTelemetryDir(dataDir, key)) };
	} catch (error) {
		return { status: 'failed', reason: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Raw files to outputs: decodes the session, appends its corrections, folds everything into a
 * snapshot and writes the events, the snapshot and an error report, then the telemetry. The same
 * raw files and corrections give the same bytes. A topic that fails to decode is reported, not
 * fatal, and neither is telemetry that cannot be built.
 */
export async function ingestSession(input: IngestInput): Promise<IngestResult> {
	const { rawDir, key, dataDir } = input;
	const { events, failures } = decodeFrames(await readArchive(rawDir));
	const last = events.at(-1);

	if (last === undefined) {
		throw new Error(`${rawDir} decoded to no events`);
	}

	const sources = input.corrections ?? [new OpenF1Corrections(dataDir), new ManualCorrections()];

	const ended = events.reduce(applyEvent, EMPTY_SNAPSHOT);
	const target = { key, endedAt: last.at, standings: ended.standings ?? [] };

	const corrections = mergeCorrections(
		await Promise.all(sources.map((source) => source.load(target)))
	);

	const all = [...events, ...corrections];
	const snapshot = corrections.reduce(applyEvent, ended);

	await writeErrors(
		dataDir,
		key,
		failures.length === 0
			? null
			: {
					key,
					frames: failures.reduce((sum, failure) => sum + failure.frames, 0),
					topics: failures
				}
	);

	return {
		key,
		events: all.length,
		corrections: corrections.length,
		eventsBytes: await writeEvents(dataDir, key, all),
		snapshotBytes: await writeSnapshot(dataDir, key, snapshot),
		failures,
		telemetry: input.telemetry === false ? { status: 'off' } : await ingestTelemetry(input)
	};
}
