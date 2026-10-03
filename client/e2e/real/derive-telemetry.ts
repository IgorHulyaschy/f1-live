/**
 * Derives the telemetry fixtures for the real-data e2e from a data folder whose telemetry is
 * built: each session's circuit outline, the replay chunks around the moments the tests and shots
 * open, and the laps the DRS zones, dominance and the speed map read there. Lap indexes stay
 * whole, as derive-fixtures.ts leaves them for the telemetry charts; only the laps read are kept.
 *
 *   DATA_DIR=/path/to/data node e2e/real/derive-telemetry.ts [session key...]
 *
 * With keys, only those sessions are derived, so one built in another data folder can be added.
 * Reads only. Run derive-fixtures.ts first: the moments come from the fixture snapshots.
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

import type { LapIndex, RaceSnapshot, ReplayManifest, TrackOutline } from '@f1-live/shared';

import { replayTimeline, stepTime } from '../../src/data/session-time.ts';
import { snapshotAtLap } from '../../src/data/snapshot-at-lap.ts';
import { snapshotAtTime } from '../../src/data/snapshot-at-time.ts';
import { lapsToRead } from '../../src/features/track/dominance.ts';
import { lapsForZones } from '../../src/features/track/drs-zones.ts';
import { bestLaps } from '../../src/insights/gap-distance.ts';
import { isTimedSession } from '../../src/insights/qualifying.ts';
import { standingsAt } from '../../src/insights/standings.ts';

type Plan = {
	/** Replay steps (laps, or minutes on the clock) whose moments the chunks must cover. */
	steps: readonly number[];
	/** Steps from the end, for sessions opened at their end. */
	lastSteps: number;
	/** Steps where dominance and the speed map are opened; -1 is the last. */
	mapSteps: readonly number[];
	/** Each driver's best lap in each part and overall, for the gap visuals. */
	gaps?: boolean;
};

/** Kept round each moment: the minute before for road gaps, and the next lap or two for playing on. */
const BEFORE_MS = 90_000;

const AFTER_MS = 200_000;

/** LEC, the driver a fresh viewer follows. */
const FOLLOWED = '16';

const PLANS = new Map<string, Plan>([
	// 2025 Las Vegas race: the start, laps 10, 30 and 50; the Track tiles at the start and lap 30.
	['9858', { steps: [1, 10, 30], lastSteps: 1, mapSteps: [1, 30] }],
	// 2026 Baku qualifying, opened at its end: the last minutes.
	['11373', { steps: [], lastSteps: 6, mapSteps: [-1] }],
	// 2026 Bahrain qualifying: the gaps and the ghost lap.
	['11730', { steps: [], lastSteps: 0, mapSteps: [], gaps: true }]
]);

const dataDir = process.env.DATA_DIR;

if (!dataDir) {
	throw new Error('Set DATA_DIR to a data folder whose out/telemetry is built.');
}

const source = path.join(dataDir, 'out', 'telemetry');

const target = path.join(import.meta.dirname, 'data', 'out', 'telemetry');

const fixtureSnapshots = path.join(import.meta.dirname, 'data', 'out', 'snapshots');

function readGzipJson<T>(file: string): T {
	// SAFETY: the telemetry pipeline wrote these files; the client parses them when it reads them.
	return JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')) as T;
}

function readJson<T>(file: string): T {
	// SAFETY: as above.
	return JSON.parse(readFileSync(file, 'utf8')) as T;
}

mkdirSync(path.join(target, 'circuits'), { recursive: true });

const only = process.argv.slice(2);

for (const [key, plan] of PLANS) {
	if (only.length > 0 && !only.includes(key)) {
		continue;
	}

	const from = path.join(source, key);
	const to = path.join(target, key);

	const index = readJson<{ circuitKey: string; laps: string; replay: string }>(
		path.join(from, 'index.json')
	);

	const snapshot = readGzipJson<RaceSnapshot>(path.join(fixtureSnapshots, `${key}.json.gz`));
	const timeline = replayTimeline(snapshot);
	const last = timeline.times.length - 1;

	const steps = [
		...plan.steps,
		...Array.from({ length: plan.lastSteps }, (_, back) => last - back)
	];

	const moments = steps.map((step) => stepTime(timeline, step));

	// The replay is this script's alone; the laps folder is shared with derive-fixtures.ts.
	rmSync(path.join(to, 'replay'), { recursive: true, force: true });
	mkdirSync(path.join(to, 'replay'), { recursive: true });
	mkdirSync(path.join(to, 'laps'), { recursive: true });
	copyFileSync(path.join(from, 'index.json'), path.join(to, 'index.json'));
	copyFileSync(
		path.join(source, 'circuits', `${index.circuitKey}.json`),
		path.join(target, 'circuits', `${index.circuitKey}.json`)
	);

	const circuit = readJson<TrackOutline>(path.join(source, 'circuits', `${index.circuitKey}.json`));

	const manifest = readJson<ReplayManifest>(path.join(from, index.replay));
	const origin = Date.parse(manifest.originAt);

	const chunks = manifest.chunks.filter((chunk) => {
		const start = origin + chunk.t0;
		const end = start + chunk.n * manifest.stepMs;

		return moments.some((moment) => end >= moment - BEFORE_MS && start <= moment + AFTER_MS);
	});

	for (const chunk of chunks) {
		copyFileSync(path.join(from, 'replay', chunk.file), path.join(to, 'replay', chunk.file));
	}

	writeFileSync(path.join(to, index.replay), `${JSON.stringify({ ...manifest, chunks })}\n`);

	const laps = readGzipJson<LapIndex>(path.join(from, index.laps));

	const read = new Set([
		...lapsForZones(laps, snapshot.laps),
		...(plan.gaps ? gapLaps(laps, snapshot) : []),
		...plan.mapSteps
			.map((step) => (step < 0 ? last + 1 + step : step))
			.flatMap((step) => mapLaps(laps, snapshot, step, stepTime(timeline, step), circuit.lengthM))
	]);

	for (const entry of read) {
		copyFileSync(path.join(from, entry.file), path.join(to, entry.file));
	}

	copyFileSync(path.join(from, index.laps), path.join(to, index.laps));
	process.stdout.write(`${key}: ${chunks.length} chunks, ${read.size} laps\n`);
}

/**
 * The laps dominance and the speed map read at a step for a fresh viewer: the followed driver and
 * the two cars at the front they compare by default.
 */
function mapLaps(
	laps: LapIndex,
	snapshot: RaceSnapshot,
	step: number,
	moment: number,
	lengthM: number
): LapIndex['laps'] {
	const shown = isTimedSession(snapshot.session.type)
		? snapshotAtTime(snapshot, moment)
		: snapshotAtLap(snapshot, step);

	const front = standingsAt(shown)
		.filter((row) => row.state !== 'out' && row.driver.number !== FOLLOWED)
		.slice(0, 2)
		.map((row) => row.driver.number);

	return [
		...lapsToRead(laps, [FOLLOWED, ...front], 'best', moment, lengthM),
		...lapsToRead(laps, [FOLLOWED], 'lap', moment, lengthM)
	];
}

/** The index entries of every lap the gap visuals place cars by. */
function gapLaps(laps: LapIndex, snapshot: RaceSnapshot): LapIndex['laps'] {
	const wanted = (['best', 1, 2, 3] as const).flatMap((part) => bestLaps(snapshot, part));

	return laps.laps.filter((entry) =>
		wanted.some((lap) => lap.driverNumber === entry.driverNumber && lap.lap === entry.lap)
	);
}
