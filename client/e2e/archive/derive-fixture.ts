/**
 * Derives the archive e2e fixture from the imported 2019 Austrian race and its positions as the
 * archive serves them: the start and the first laps of every stream, small enough to commit.
 *
 *   RACE_DIR=<data>/raw/2019/2019-06-30_Austrian_Grand_Prix/2019-06-30_Race \
 *   POSITIONS=<downloaded Position.z.jsonStream> node e2e/archive/derive-fixture.ts
 *   npm run rebuild -w server -- --data-dir ../client/e2e/archive/data --no-telemetry
 *
 * `data/raw` holds the timing streams the server imported; `archive` the positions it fetches.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RACE_KEY, RACE_PATH } from './race.ts';

/** Lap 3 starts at 00:35:13; the streams run a little past it, so laps 1 and 2 are whole. */
const UNTIL = '00:36:30';

/** The race starts at 00:32:52; positions on the grid before that only weigh. */
const POSITIONS_FROM = '00:32:30';

/** Streams the race screens do not read. */
const LEFT_OUT = new Set(['ChampionshipPrediction.jsonStream', 'TeamRadio.jsonStream']);

const here = path.dirname(fileURLToPath(import.meta.url));

/** Keeps the lines stamped in [from, until); the first, which carries the byte order mark, always. */
function trim(text: string, from: string, until: string): string {
	const lines = text.split('\n').filter((line) => line !== '');

	return `${lines
		.filter((line, index) => {
			const at = line.replace(/^\uFEFF/, '').slice(0, 8);

			return (index === 0 && from === '') || (at >= from && at < until);
		})
		.join('\n')}\n`;
}

const raceDir = process.env.RACE_DIR;

const positions = process.env.POSITIONS;

if (raceDir === undefined || positions === undefined) {
	throw new Error('Set RACE_DIR and POSITIONS, as the header says');
}

const rawOut = path.join(here, 'data/raw', RACE_PATH);

mkdirSync(rawOut, { recursive: true });

for (const file of readdirSync(raceDir).filter((name) => name.endsWith('.jsonStream'))) {
	if (!LEFT_OUT.has(file)) {
		writeFileSync(
			path.join(rawOut, file),
			trim(readFileSync(path.join(raceDir, file), 'utf8'), '', UNTIL)
		);
	}
}

// The season index, cut to this race.
const index = JSON.parse(
	readFileSync(path.join(raceDir, '../../Index.json'), 'utf8').replace(/^\uFEFF/, '')
);

const meeting = index.Meetings.find((candidate: { Sessions: { Key: number }[] }) =>
	candidate.Sessions.some((session) => String(session.Key) === RACE_KEY)
);

meeting.Sessions = meeting.Sessions.filter(
	(session: { Key: number }) => String(session.Key) === RACE_KEY
);

writeFileSync(
	path.join(here, 'data/raw/2019/Index.json'),
	`${JSON.stringify({ Year: index.Year, Meetings: [meeting] }, null, '\t')}\n`
);

const archiveOut = path.join(here, 'archive', RACE_PATH);

mkdirSync(archiveOut, { recursive: true });

writeFileSync(
	path.join(archiveOut, 'Position.z.jsonStream'),
	`\uFEFF${trim(readFileSync(positions, 'utf8'), POSITIONS_FROM, UNTIL)}`
);
