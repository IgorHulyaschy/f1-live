/**
 * Derives the telemetry fixtures for the real-data e2e from a data folder whose telemetry is
 * built: each session's circuit outline, the replay chunks around the moments the tests and shots
 * open, and a few laps for DRS zones, dominance and the speed map. Indexes are cut to what is kept.
 *
 *   DATA_DIR=/path/to/data node e2e/real/derive-telemetry.ts
 *
 * Reads only. Run derive-fixtures.ts first: the moments come from the fixture snapshots.
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

import type { LapIndex, RaceSnapshot, ReplayManifest } from '@f1-live/shared';

import { replayTimeline, stepTime } from '../../src/data/session-time.ts';
import { lapsForZones } from '../../src/features/track/drs-zones.ts';

type Plan = {
	/** Replay steps (laps, or minutes on the clock) whose moments the chunks must cover. */
	steps: readonly number[];
	/** Steps from the end, for sessions opened at their end. */
	lastSteps: number;
	/** Laps kept, as driver and lap numbers. */
	laps: readonly (readonly [driverNumber: string, lap: number])[];
};

/** Kept round each moment: the minute before for road gaps, and the next lap or two for playing on. */
const BEFORE_MS = 90_000;

const AFTER_MS = 200_000;

function lapsOf(drivers: readonly string[], laps: readonly number[]): [string, number][] {
	return drivers.flatMap((driver) => laps.map((lap): [string, number] => [driver, lap]));
}

const PLANS = new Map<string, Plan>([
	[
		// 2025 Las Vegas race: the start, laps 10, 30 and 50; dominance and the speed map for VER,
		// RUS and LEC. The laps the map reads DRS zones from are added to every session.
		'9858',
		{
			steps: [1, 10, 30],
			lastSteps: 1,
			laps: lapsOf(['1', '63', '16'], [19, 20, 21, 22, 28, 29])
		}
	],
	[
		// 2026 Baku qualifying, opened at its end: the last minutes, with the fastest laps of the top four and LEC.
		'11373',
		{ steps: [], lastSteps: 6, laps: [] }
	]
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

rmSync(target, { recursive: true, force: true });

mkdirSync(path.join(target, 'circuits'), { recursive: true });

for (const [key, plan] of PLANS) {
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

	mkdirSync(path.join(to, 'replay'), { recursive: true });
	mkdirSync(path.join(to, 'laps'), { recursive: true });
	copyFileSync(path.join(from, 'index.json'), path.join(to, 'index.json'));
	copyFileSync(
		path.join(source, 'circuits', `${index.circuitKey}.json`),
		path.join(target, 'circuits', `${index.circuitKey}.json`)
	);

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

	const wanted = [
		...(plan.laps.length > 0 ? plan.laps : fastestLaps(laps, snapshot)),
		...lapsForZones(laps, snapshot.laps).map((entry): [string, number] => [
			entry.driverNumber,
			entry.lap
		])
	];

	const kept = laps.laps.filter((entry) =>
		wanted.some(([driver, lap]) => entry.driverNumber === driver && entry.lap === lap)
	);

	for (const entry of kept) {
		copyFileSync(path.join(from, entry.file), path.join(to, entry.file));
	}

	writeFileSync(
		path.join(to, index.laps),
		gzipSync(JSON.stringify({ ...laps, laps: kept }), { level: 9 })
	);
	process.stdout.write(`${key}: ${chunks.length} chunks, ${kept.length} laps\n`);
}

/** In qualifying, the three fastest laps of the top four and of LEC, the driver followed by default. */
function fastestLaps(laps: LapIndex, snapshot: RaceSnapshot): [string, number][] {
	const order = (snapshot.standings ?? []).slice(0, 4).map((standing) => standing.driverNumber);

	return [...new Set([...order, '16'])].flatMap((driver) =>
		laps.laps
			.filter(
				(entry) => entry.driverNumber === driver && !entry.pitIn && !entry.pitOut && !entry.partial
			)
			.toSorted((a, b) => a.lapTimeMs - b.lapTimeMs)
			.slice(0, 3)
			.map((entry): [string, number] => [entry.driverNumber, entry.lap])
	);
}
