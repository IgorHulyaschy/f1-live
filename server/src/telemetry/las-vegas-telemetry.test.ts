/**
 * Builds the telemetry of the whole 2025 Las Vegas race (archive key 9858) and checks it. It needs
 * the raw files, which `npm run fetch:f1 -w server -- 9858` downloads; without them it is skipped.
 *
 * Official circuit length, 6.201 km (3.853 mi), race 50 laps, 309.958 km:
 * https://en.wikipedia.org/wiki/Las_Vegas_Grand_Prix, which takes it from the organiser's circuit
 * facts. A racing line is a little shorter than the middle of the track, so the drawn outline is
 * held to 2%, not to the metre.
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { gunzipSync } from 'node:zlib';

import { alignLaps, expandReplayCar } from '@f1-live/shared';
import type { LapIndex, LapTelemetry, ReplayChunk, ReplayManifest } from '@f1-live/shared';

import { RAW_DATA_DIR } from '../sources/f1/archive.js';
import { buildTelemetry } from './build.js';
import type { BuiltReport } from './build.js';
import { readOutline, telemetryDir } from './files.js';

const SESSION_DIR = path.join(RAW_DATA_DIR, '2025/2025-11-22_Las_Vegas_Grand_Prix/2025-11-22_Race');

const OFFICIAL_LENGTH_M = 6201;

const skip =
	!existsSync(path.join(SESSION_DIR, 'Position.z.jsonStream')) &&
	`no raw data in ${SESSION_DIR}; run npm run fetch:f1 -w server -- 9858`;

const roots: string[] = [];

after(async () => {
	await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function readGzipped<T>(file: string): Promise<T> {
	// SAFETY: the file is this build's own output, written from the shared type `T`.
	return JSON.parse(gunzipSync(await readFile(file)).toString('utf8')) as T;
}

describe('the Las Vegas race telemetry', { skip }, () => {
	let dataDir = '';
	let report: BuiltReport;
	let sessionDir = '';

	before(async () => {
		dataDir = await mkdtemp(path.join(tmpdir(), 'telemetry-lv-'));
		roots.push(dataDir);

		const built = await buildTelemetry({ rawDir: SESSION_DIR, key: 9858, dataDir });

		assert.equal(built.status, 'built');

		if (built.status === 'built') {
			report = built;
		}

		sessionDir = path.join(telemetryDir(dataDir), '9858');
	});

	it('draws a closed outline within 2% of the official length, with 22 mini sectors', async () => {
		const outline = await readOutline(dataDir, '152');

		assert.ok(outline !== null);
		assert.ok(
			Math.abs(outline.lengthM - OFFICIAL_LENGTH_M) / OFFICIAL_LENGTH_M < 0.02,
			`${outline.lengthM} m`
		);

		const step = outline.lengthM / outline.points.length;
		const [first, last] = [outline.points[0], outline.points.at(-1)];

		assert.ok(first !== undefined && last !== undefined);
		assert.ok(Math.hypot(first[0] - last[0], first[1] - last[1]) < 1.5 * step, 'closed');
		assert.deepEqual(outline.miniSectorsPerSector, [6, 7, 9]);
		assert.equal(outline.miniSectorStartsM.length, 22);
		assert.equal(outline.source.miniSectors, 'timing');

		const starts = outline.miniSectorStartsM;

		assert.equal(starts[0], 0);
		assert.ok(starts.every((start, index) => index === 0 || start > (starts[index - 1] ?? 0)));
		assert.ok(Math.abs((starts[6] ?? 0) - (outline.sectorBoundariesM[0] ?? 0)) < 1e-6);
		assert.ok(Math.abs((starts[13] ?? 0) - (outline.sectorBoundariesM[1] ?? 0)) < 1e-6);
		assert.ok(outline.pitLane !== null && outline.pitLane.points.length > 20);
	});

	it('gives every lap monotonic distance, within 2% of the circuit length unless it began or ended in the pits', async () => {
		const outline = await readOutline(dataDir, '152');
		const index = await readGzipped<LapIndex>(path.join(sessionDir, 'laps.json.gz'));

		assert.ok(outline !== null);
		assert.ok(index.laps.length > 800);

		const laps = await Promise.all(
			index.laps.map(async (entry) => ({
				entry,
				lap: await readGzipped<LapTelemetry>(path.join(sessionDir, entry.file))
			}))
		);

		for (const { entry, lap } of laps) {
			for (let row = 1; row < lap.d.length; row += 1) {
				assert.ok((lap.d[row] ?? 0) >= (lap.d[row - 1] ?? 0), `${entry.file} row ${row}`);
			}

			const share: number = Math.abs((lap.d.at(-1) ?? 0) - outline.lengthM) / outline.lengthM;

			if (entry.partial) {
				continue;
			}

			assert.ok(share < (entry.pitIn || entry.pitOut ? 0.03 : 0.02), `${entry.file}: ${share}`);
			assert.ok(entry.bytes < 50_000, `${entry.file}: ${entry.bytes} bytes`);
		}

		assert.equal(report.laps.offLength, 0);
	});

	it('drives the same distance in the same time on a lap, as laps aligned by distance show', async () => {
		const first = await readGzipped<LapTelemetry>(path.join(sessionDir, 'laps/1-20.json.gz'));
		const second = await readGzipped<LapTelemetry>(path.join(sessionDir, 'laps/1-21.json.gz'));

		const delta = alignLaps(
			{ distanceM: first.d, timeMs: first.t },
			{ distanceM: second.d, timeMs: second.t },
			20
		);

		const gap = (delta.deltaMs.at(-1) ?? Number.NaN) - (second.lapTimeMs - first.lapTimeMs);

		// The comparison stops a few metres before the line, where the slower lap is still behind.
		assert.ok(Math.abs(gap) < 250, `${gap} ms`);
		assert.equal(delta.deltaMs[0], 0);
		assert.ok(first.speed !== undefined && Math.max(...first.speed) > 300);
	});

	it('stores the replay so a chunk gives the positions the lap files give', async () => {
		// SAFETY: the file is this build's own output, written from `ReplayManifest`.
		const manifest = JSON.parse(
			await readFile(path.join(sessionDir, 'replay/index.json'), 'utf8')
		) as ReplayManifest;

		const lap = await readGzipped<LapTelemetry>(path.join(sessionDir, 'laps/1-20.json.gz'));
		const row = 100;
		const at = Date.parse(lap.startedAt) + (lap.t[row] ?? 0) - Date.parse(manifest.originAt);
		const chunkRef = manifest.chunks[Math.floor(at / manifest.chunkMs)];

		assert.ok(chunkRef !== undefined);

		const chunk = await readGzipped<ReplayChunk>(path.join(sessionDir, 'replay', chunkRef.file));
		const car = chunk.cars['1'];

		assert.ok(car !== undefined);

		const { x, y } = expandReplayCar(car, chunk.quantM);
		const position = (at - chunk.t0) / chunk.stepMs;
		const [low, share] = [Math.floor(position), position - Math.floor(position)];

		const mix = (values: number[]) =>
			(values[low] ?? 0) * (1 - share) + (values[low + 1] ?? 0) * share;

		assert.ok(Math.hypot(mix(x) - (lap.x[row] ?? 0), mix(y) - (lap.y[row] ?? 0)) < 3);
		assert.equal(manifest.chunks.length, report.replay.chunks);
	});

	it('reuses the saved outline and writes the same laps, give or take a digit', async () => {
		const again = await buildTelemetry({ rawDir: SESSION_DIR, key: 9858, dataDir });

		assert.equal(again.status, 'built');

		if (again.status === 'built') {
			assert.equal(again.outline.reused, true);
			assert.equal(again.laps.files, report.laps.files);
			// The saved outline is rounded to 0.1 m, so a lap may differ by a digit.
			assert.ok(
				Math.abs(again.laps.totalBytes - report.laps.totalBytes) < 0.01 * report.laps.totalBytes
			);
		}
	});

	it('skips a session with no positions', async () => {
		const empty = await mkdtemp(path.join(tmpdir(), 'telemetry-empty-'));

		roots.push(empty);

		const result = await buildTelemetry({
			rawDir: path.join(import.meta.dirname, '../sources/f1/fixtures/2025-las-vegas-race'),
			key: 9858,
			dataDir: empty
		});

		assert.equal(result.status, 'skipped');
	});
});
