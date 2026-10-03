/**
 * The 2025 Las Vegas race (archive key 9858) through the whole import, corrections included. It
 * needs the raw files, which `npm run import -w server -- --key 9858` downloads; without them it
 * is skipped.
 *
 * Sources for the expected values:
 * - official classification, Norris (car 4) and Piastri (car 81) disqualified for excessive wear
 *   of the plank assembly: https://www.formula1.com/en/results/2025/races/1274/las-vegas/race-result
 *   and https://en.wikipedia.org/wiki/2025_Las_Vegas_Grand_Prix
 * - the FIA decisions: https://www.fia.com/system/files/decision-document/2025_las_vegas_grand_prix_-_infringement_-_car_4_-_technical_non-conformity_plank_assembly.pdf
 *   and the same for car 81 (server/corrections/9858.json)
 * - OpenF1 session result, dsq true for cars 4 and 81: https://api.openf1.org/v1/session_result?session_key=9858
 */

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { gunzipSync } from 'node:zlib';

import type { RaceSnapshot } from '@f1-live/shared';

import type { CorrectionSource } from '../../import/corrections.js';
import { ingestSession } from '../../import/ingest.js';
import { snapshotPathOf } from '../../sinks/files.js';
import { correctionsFromResult, parseSessionResult } from '../openf1/session-result.js';
import { RAW_DATA_DIR } from './archive.js';

const SESSION_DIR = path.join(RAW_DATA_DIR, '2025/2025-11-22_Las_Vegas_Grand_Prix/2025-11-22_Race');

const skip =
	!existsSync(path.join(SESSION_DIR, 'TimingData.jsonStream')) &&
	`no raw data in ${SESSION_DIR}; run npm run import -w server -- --key 9858`;

const roots: string[] = [];

after(() => {
	for (const root of roots) {
		rmSync(root, { recursive: true, force: true });
	}
});

async function importRace(corrections?: readonly CorrectionSource[]): Promise<RaceSnapshot> {
	const dataDir = mkdtempSync(path.join(tmpdir(), 'vegas-'));

	roots.push(dataDir);
	await ingestSession({ rawDir: SESSION_DIR, key: 9858, dataDir, corrections });

	return JSON.parse(gunzipSync(readFileSync(snapshotPathOf(dataDir, 9858))).toString('utf8'));
}

function order(snapshot: RaceSnapshot): string[] {
	return (snapshot.standings ?? []).map((standing) => standing.driverNumber);
}

describe('2025 Las Vegas race import', { skip }, () => {
	it('matches the official result with both McLarens disqualified, using the committed corrections', async () => {
		const snapshot = await importRace([]);
		const withFile = await importRace();

		assert.deepEqual(order(snapshot).slice(0, 4), ['1', '4', '63', '81']);

		// Verstappen, Russell, Antonelli, then the rest, and Norris and Piastri last, disqualified.
		assert.deepEqual(order(withFile).slice(0, 3), ['1', '63', '12']);
		assert.deepEqual(order(withFile).slice(-2), ['4', '81']);
		assert.deepEqual(
			withFile.standings?.filter((standing) => standing.disqualified).map((s) => s.driverNumber),
			['4', '81']
		);
		assert.equal(withFile.corrections?.length, 2);
	});

	it('reaches the same classification from the OpenF1 session result alone', async () => {
		const result = parseSessionResult(
			JSON.stringify([
				{ session_key: 9858, driver_number: 1, dsq: false },
				{ session_key: 9858, driver_number: 4, dsq: true },
				{ session_key: 9858, driver_number: 81, dsq: true }
			])
		);

		const openF1: CorrectionSource = {
			load: ({ endedAt }) => Promise.resolve(correctionsFromResult(result, endedAt))
		};

		const snapshot = await importRace([openF1]);

		assert.deepEqual(order(snapshot).slice(0, 3), ['1', '63', '12']);
		assert.deepEqual(order(snapshot).slice(-2), ['4', '81']);
	});
});
