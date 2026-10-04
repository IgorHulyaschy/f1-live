import assert from 'node:assert/strict';
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

import type { Catalog } from '../catalog/catalog.js';
import { RAW_DATA_DIR } from '../sources/f1/archive.js';
import { catalogPathOf, errorsPathOf, rawDirOf } from '../sinks/files.js';
import { sessionTelemetryDir, telemetryDir } from '../telemetry/files.js';
import { hashOutputs } from './report.js';
import { runImport } from './run.js';
import type { ImportOptions } from './run.js';

/** A trimmed copy of the 2025 Las Vegas race (key 9858). */
const FIXTURE = path.join(import.meta.dirname, '../sources/f1/fixtures/2025-las-vegas-race');

const RACE_PATH = '2025/2025-11-22_Las_Vegas_Grand_Prix/2025-11-22_Race';

const SEASON = JSON.stringify({
	Year: 2025,
	Meetings: [
		{
			Key: 1274,
			Name: 'Las Vegas Grand Prix',
			OfficialName: 'FORMULA 1 HEINEKEN SILVER LAS VEGAS GRAND PRIX 2025',
			Location: 'Las Vegas',
			Country: { Code: 'USA', Name: 'United States' },
			Circuit: { ShortName: 'Las Vegas' },
			Sessions: [
				{
					Key: 9858,
					Type: 'Race',
					Name: 'Race',
					StartDate: '2025-11-22T20:00:00',
					EndDate: '2025-11-22T22:00:00',
					GmtOffset: '-08:00:00',
					Path: `${RACE_PATH}/`
				},
				{
					Key: 9999,
					Type: 'Practice',
					Name: 'Practice 9',
					StartDate: '2026-11-22T20:00:00',
					EndDate: '2026-11-22T21:00:00',
					GmtOffset: '-08:00:00',
					Path: '2026/never/'
				}
			]
		}
	]
});

const FULL_RACE = path.join(RAW_DATA_DIR, RACE_PATH);

const skipWithoutFullRace =
	!existsSync(path.join(FULL_RACE, 'Position.z.jsonStream')) &&
	`no raw data in ${FULL_RACE}; run npm run fetch:f1 -w server -- 9858`;

const roots: string[] = [];

after(() => {
	for (const root of roots) {
		rmSync(root, { recursive: true, force: true });
	}
});

/** A data directory holding the season index and the fixture as the saved race, with no network. */
function dataDirWithRace(): ImportOptions {
	const dataDir = mkdtempSync(path.join(tmpdir(), 'run-'));
	const rawDir = rawDirOf(dataDir);

	roots.push(dataDir);
	mkdirSync(path.join(rawDir, '2025'), { recursive: true });
	writeFileSync(path.join(rawDir, '2025/Index.json'), SEASON);
	cpSync(FIXTURE, path.join(rawDir, RACE_PATH), { recursive: true });

	return {
		dataDir,
		offline: true,
		telemetry: true,
		now: new Date('2025-12-01T00:00:00Z'),
		log: () => undefined
	};
}

/** Like `dataDirWithRace`, with the full race: the fixture has no Position.z. */
function dataDirWithFullRace(telemetry: boolean): ImportOptions {
	const options = dataDirWithRace();

	rmSync(path.join(rawDirOf(options.dataDir), RACE_PATH), { recursive: true });
	cpSync(FULL_RACE, path.join(rawDirOf(options.dataDir), RACE_PATH), { recursive: true });

	return { ...options, telemetry };
}

describe('runImport', () => {
	it('imports the saved sessions of a season, skips upcoming ones and lists both in the catalogue', async () => {
		const options = dataDirWithRace();
		const report = await runImport({ kind: 'meeting', years: [2025] }, options);

		assert.deepEqual(
			report.outcomes.map((outcome) => [outcome.key, outcome.failure]),
			[[9858, null]]
		);
		assert.deepEqual(
			report.skipped.map((session) => [session.key, session.reason]),
			[[9999, 'upcoming']]
		);

		const catalog: Catalog = JSON.parse(readFileSync(catalogPathOf(options.dataDir), 'utf8'));
		const sessions = catalog.seasons.find((season) => season.year === 2025)?.meetings[0]?.sessions;

		assert.deepEqual(
			sessions?.map((session) => [session.key, session.status, session.outputs]),
			[
				[9858, 'finished', { raw: true, events: true, snapshot: true, telemetry: false }],
				[9999, 'upcoming', { raw: false, events: false, snapshot: false, telemetry: false }]
			]
		);
	});

	it('keeps the sessions the catalogue lists when the raw folder holds no season index', async () => {
		const options = dataDirWithRace();

		await runImport({ kind: 'meeting', years: [2025] }, options);

		const before: Catalog = JSON.parse(readFileSync(catalogPathOf(options.dataDir), 'utf8'));

		// An ingest host records only the live weekend: its raw folder never held an index.
		rmSync(path.join(rawDirOf(options.dataDir), '2025/Index.json'));
		await runImport({ kind: 'local' }, options);

		const kept: Catalog = JSON.parse(readFileSync(catalogPathOf(options.dataDir), 'utf8'));

		assert.deepEqual(kept, before);
		assert.equal(
			kept.seasons.find((season) => season.year === 2025)?.meetings[0]?.sessions[0]?.outputs
				.snapshot,
			true
		);
	});

	it('reports a session whose raw files are missing and still imports the others', async () => {
		const options = dataDirWithRace();
		const broken = path.join(rawDirOf(options.dataDir), '2025/2025-11-23_Broken');

		mkdirSync(broken, { recursive: true });
		writeFileSync(path.join(broken, 'LapCount.jsonStream'), '﻿00:00:01.000{"TotalLaps":5}\n');

		const report = await runImport({ kind: 'local' }, options);
		const failed = report.outcomes.filter((outcome) => outcome.failure !== null);

		assert.equal(report.outcomes.length, 2);
		assert.deepEqual(
			failed.map((outcome) => outcome.label),
			['2025/2025-11-23_Broken']
		);
		assert.equal(report.outcomes.filter((outcome) => outcome.failure === null).length, 1);
	});

	it('gives byte-identical outputs when it runs again, and when everything is rebuilt from raw', async () => {
		const options = dataDirWithRace();

		await runImport({ kind: 'meeting', years: [2025] }, options);

		const first = await hashOutputs(options.dataDir);

		await runImport({ kind: 'meeting', years: [2025] }, options);
		assert.equal((await hashOutputs(options.dataDir)).sha256, first.sha256);

		rmSync(path.join(options.dataDir, 'out'), { recursive: true });
		await runImport({ kind: 'local' }, options);
		assert.equal((await hashOutputs(options.dataDir)).sha256, first.sha256);
		assert.equal(existsSync(errorsPathOf(options.dataDir, 9858)), false);
	});

	it('fails on a meeting name that matches nothing', async () => {
		await assert.rejects(
			runImport({ kind: 'meeting', years: [2025], meeting: 'Monaco' }, dataDirWithRace()),
			/matches "Monaco"/
		);
	});

	describe('with the whole race and its telemetry', { skip: skipWithoutFullRace }, () => {
		it('gives byte-identical outputs, telemetry included, when everything is rebuilt from raw', async () => {
			const options = dataDirWithFullRace(true);

			await runImport({ kind: 'meeting', years: [2025] }, options);

			const first = await hashOutputs(options.dataDir);

			assert.ok(existsSync(path.join(sessionTelemetryDir(options.dataDir, 9858), 'index.json')));

			rmSync(path.join(options.dataDir, 'out'), { recursive: true });

			const rebuilt = await runImport({ kind: 'local' }, options);

			assert.equal((await hashOutputs(options.dataDir)).sha256, first.sha256);
			assert.equal(rebuilt.outcomes[0]?.result?.telemetry.status, 'built');

			// A rebuild draws the circuits again, whatever outline an earlier run left.
			const outline = path.join(telemetryDir(options.dataDir), 'circuits/152.json');
			const saved = JSON.parse(readFileSync(outline, 'utf8'));

			writeFileSync(outline, JSON.stringify({ ...saved, rotationDeg: saved.rotationDeg + 1 }));
			await runImport({ kind: 'local' }, options);
			assert.equal((await hashOutputs(options.dataDir)).sha256, first.sha256);
		});

		it('says in the catalogue whether a session has telemetry, and builds none with it turned off', async () => {
			const withTelemetry = dataDirWithFullRace(true);
			const without = dataDirWithFullRace(false);

			await runImport({ kind: 'local' }, withTelemetry);
			await runImport({ kind: 'local' }, without);

			for (const [options, expected] of [
				[withTelemetry, true],
				[without, false]
			] as const) {
				const catalog: Catalog = JSON.parse(readFileSync(catalogPathOf(options.dataDir), 'utf8'));

				assert.equal(
					catalog.seasons
						.find((season) => season.year === 2025)
						?.meetings[0]?.sessions.find((session) => session.key === 9858)?.outputs.telemetry,
					expected
				);
			}

			assert.equal(existsSync(sessionTelemetryDir(without.dataDir, 9858)), false);
		});
	});
});
