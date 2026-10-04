/**
 * Derives the real-data e2e fixtures from an imported data folder: each session's events folded
 * with this repository's reducer, the catalogue cut to the meetings the tests open, and the
 * telemetry the charts open first.
 *
 *   DATA_DIR=/path/to/data node e2e/real/derive-fixtures.ts
 *
 * Reads only; the outputs are small enough to commit.
 */
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync
} from 'node:fs';
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

/**
 * 2025 Las Vegas (a race with two disqualifications, qualifying with 20 cars), 2026 Baku (22) and
 * 2026 Bahrain, whose qualifying the gap visuals open on and whose race, in which Russell stopped
 * on lap 50, Ask tells the story of.
 */
const MEETINGS = new Map([
	[2025, [1274]],
	[2026, [1295, 1308]]
]);

const SESSIONS = ['9852', '9854', '9858', '11373', '11730', '11731'];

/** Races Ask and the unit tests read, not the charts, so saved without the mini-sector segments and team radio. */
const TRIMMED_SESSIONS = ['11731'];

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

/**
 * The modelled replay of the same race shows these too, at the lap it opens on (30): laps 29 and
 * 30 of the first four there and of the default followed driver.
 */
const MOCK_REPLAY_LAPS = { key: '9858', drivers: ['1', '63', '12', '4', '16'], laps: [29, 30] };

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

	const saved = TRIMMED_SESSIONS.includes(key)
		? {
				...snapshot,
				miniSectors: EMPTY_SNAPSHOT.miniSectors,
				miniSectorLeaders: EMPTY_SNAPSHOT.miniSectorLeaders,
				teamRadio: EMPTY_SNAPSHOT.teamRadio
			}
		: snapshot;

	writeFileSync(
		path.join(target, 'snapshots', `${key}.json.gz`),
		gzipSync(JSON.stringify(saved), { level: 9 })
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

		const mockLaps =
			key === MOCK_REPLAY_LAPS.key && MOCK_REPLAY_LAPS.drivers.includes(driverNumber)
				? MOCK_REPLAY_LAPS.laps
				: [];

		for (const lap of new Set([best?.lap, last?.lap, ...mockLaps])) {
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

// The history pages list the seasons the catalogue has, so every season with a results index
// stays, its meetings cut to the ones the tests open. 2026 keeps its whole calendar.
const resultYears = new Set(
	existsSync(path.join(out, 'results'))
		? readdirSync(path.join(out, 'results')).map((name) => Number.parseInt(name, 10))
		: []
);

const trimmed: Catalog = {
	seasons: catalog.seasons.flatMap((season) => {
		const meetingKeys = MEETINGS.get(season.year) ?? [];

		const meetings = season.meetings.filter(
			(meeting) =>
				meetingKeys.includes(meeting.key) ||
				season.year === 2026 ||
				(resultYears.has(season.year) && meeting.key === season.meetings.at(-1)?.key)
		);

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

// The results index per season, for the history pages (calendar, standings, head to head).
const resultsDir = path.join(out, 'results');

if (existsSync(resultsDir)) {
	mkdirSync(path.join(target, 'results'), { recursive: true });

	for (const file of readdirSync(resultsDir).filter((name) => name.endsWith('.json.gz'))) {
		copyFileSync(path.join(resultsDir, file), path.join(target, 'results', file));
	}
}

// The stewards' decisions per season and the Wikidata facts, for the driver pages and Ask.
const decisionsDir = path.join(out, 'decisions');

if (existsSync(decisionsDir)) {
	mkdirSync(path.join(target, 'decisions'), { recursive: true });

	for (const file of readdirSync(decisionsDir).filter((name) => name.endsWith('.json'))) {
		copyFileSync(path.join(decisionsDir, file), path.join(target, 'decisions', file));
	}
}

if (existsSync(path.join(out, 'facts.json'))) {
	copyFileSync(path.join(out, 'facts.json'), path.join(target, 'facts.json'));
}
