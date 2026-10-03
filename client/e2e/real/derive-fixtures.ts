/**
 * Derives the real-data e2e fixtures from an imported data folder: each session's events folded
 * with this repository's reducer, the catalogue cut to the meetings the tests open, and the
 * telemetry the charts open first.
 *
 *   DATA_DIR=/path/to/data node e2e/real/derive-fixtures.ts
 *
 * Reads only; the outputs are small enough to commit.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

import {
	applyEvent,
	EMPTY_SNAPSHOT,
	type LapIndex,
	type RaceEvent,
	type RaceSnapshot,
	type TrackOutline
} from '@f1-live/shared';

import { type Catalog, catalogSchema } from '../../src/data/catalog.ts';
import { comparableLaps, fastestComparableLap } from '../../src/insights/telemetry-traces.ts';

/** 2025 Las Vegas (a race with two disqualifications, qualifying with 20 cars) and 2026 Baku (22). */
const MEETINGS = new Map([
	[2025, 1274],
	[2026, 1295]
]);

const SESSIONS = ['9852', '9854', '9858', '11373'];

/**
 * Drivers whose laps the telemetry charts open on, per session: the first three at the end and
 * the default followed driver (16), with the McLarens in the race. Each gets its best lap and its
 * last lap that ran line to line.
 */
const TELEMETRY_DRIVERS = new Map([
	['9852', ['4', '12', '16', '27']],
	['9854', ['4', '1', '55', '16']],
	['9858', ['1', '63', '12', '16', '4', '81']]
]);

const dataDir = process.env.DATA_DIR;

if (!dataDir) {
	throw new Error('Set DATA_DIR to an imported data folder (its out/ holds catalog.json).');
}

const out = path.join(dataDir, 'out');

const target = path.join(import.meta.dirname, 'data', 'out');

const snapshots = new Map<string, RaceSnapshot>();

for (const key of SESSIONS) {
	const lines = gunzipSync(readFileSync(path.join(out, 'events', `${key}.jsonl.gz`)))
		.toString('utf8')
		.split('\n')
		.filter((line) => line.trim() !== '');

	// SAFETY: the importer wrote these events for the same reducer.
	const snapshot = lines.reduce(
		(state, line) => applyEvent(state, JSON.parse(line) as RaceEvent),
		EMPTY_SNAPSHOT
	);

	writeFileSync(
		path.join(target, 'snapshots', `${key}.json.gz`),
		gzipSync(JSON.stringify(snapshot), { level: 9 })
	);
	snapshots.set(key, snapshot);
}

const telemetry = path.join(out, 'telemetry');

function copyTelemetry(file: string): void {
	mkdirSync(path.dirname(path.join(target, 'telemetry', file)), { recursive: true });
	copyFileSync(path.join(telemetry, file), path.join(target, 'telemetry', file));
}

for (const [key, drivers] of TELEMETRY_DRIVERS) {
	// SAFETY: written by the telemetry build for the shared types.
	const index = JSON.parse(
		gunzipSync(readFileSync(path.join(telemetry, key, 'laps.json.gz'))).toString('utf8')
	) as LapIndex;

	// SAFETY: as above.
	const circuit = JSON.parse(
		readFileSync(path.join(telemetry, 'circuits', `${index.circuitKey}.json`), 'utf8')
	) as TrackOutline;

	copyTelemetry(`${key}/index.json`);
	copyTelemetry(`${key}/laps.json.gz`);
	copyTelemetry(`circuits/${index.circuitKey}.json`);

	for (const driverNumber of drivers) {
		const comparable = comparableLaps(index.laps, driverNumber, circuit.lengthM);
		const own = (snapshots.get(key)?.laps ?? []).filter((lap) => lap.driverNumber === driverNumber);
		const best = fastestComparableLap(own, comparable);
		const last = own.findLast((lap) => comparable.has(lap.lap));

		for (const lap of new Set([best?.lap, last?.lap])) {
			const entry = lap === undefined ? undefined : comparable.get(lap);

			if (entry) {
				copyTelemetry(`${key}/${entry.file}`);
			}
		}
	}
}

const catalog = catalogSchema.parse(
	JSON.parse(readFileSync(path.join(out, 'catalog.json'), 'utf8'))
);

const trimmed: Catalog = {
	seasons: catalog.seasons.flatMap((season) => {
		const meetingKey = MEETINGS.get(season.year);
		const meetings = season.meetings.filter((meeting) => meeting.key === meetingKey);

		return meetings.length === 0
			? []
			: [
					{
						year: season.year,
						meetings: meetings.map((meeting) => ({
							...meeting,
							sessions: meeting.sessions.map((session) => {
								const saved = SESSIONS.includes(String(session.key));

								return {
									...session,
									outputs: { raw: false, events: false, snapshot: saved }
								};
							})
						}))
					}
				];
	})
};

writeFileSync(path.join(target, 'catalog.json'), `${JSON.stringify(trimmed, null, '\t')}\n`);
