/**
 * Derives the real-data e2e fixtures from an imported data folder: each session's events folded
 * with this repository's reducer, and the catalogue cut to the meetings the tests open.
 *
 *   DATA_DIR=/path/to/data node e2e/real/derive-fixtures.ts
 *
 * Reads only; the outputs are small enough to commit.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

import { applyEvent, EMPTY_SNAPSHOT, type RaceEvent } from '@f1-live/shared';

import { type Catalog, catalogSchema } from '../../src/data/catalog.ts';

/** 2025 Las Vegas (a race with two disqualifications, qualifying with 20 cars) and 2026 Baku (22). */
const MEETINGS = new Map([
	[2025, 1274],
	[2026, 1295]
]);

const SESSIONS = ['9854', '9858', '11373'];

const dataDir = process.env.DATA_DIR;

if (!dataDir) {
	throw new Error('Set DATA_DIR to an imported data folder (its out/ holds catalog.json).');
}

const out = path.join(dataDir, 'out');

const target = path.join(import.meta.dirname, 'data', 'out');

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
