/**
 * The accuracy gate of the results index: final drivers' and constructors' standings computed from
 * `out/results/<season>.json.gz` match the tables formula1.com publishes, per season. The tables
 * were read on the date in `fixtures/official-standings.json`, from the URLs it lists.
 *
 * Reads the results of an imported data directory when `DATA_DIR` names one, else the copy the
 * real-data e2e fixture commits (client/e2e/real/data); a season without its file is skipped.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import {
	driverIdOf,
	driverStandings,
	seasonResultsSchema,
	teamStandings
} from '@f1-live/shared/results';
import { z } from 'zod';

import { resultsPathOf } from './season.js';

const officialSchema = z.object({
	seasons: z.array(
		z.object({
			season: z.int(),
			throughRound: z.int().optional(),
			source: z.url(),
			drivers: z.array(
				z.object({
					position: z.int(),
					firstName: z.string(),
					lastName: z.string(),
					points: z.number()
				})
			),
			teams: z.array(
				z.object({ position: z.int().nullable(), team: z.string(), points: z.number() })
			)
		})
	)
});

const OFFICIAL = officialSchema.parse(
	JSON.parse(readFileSync(new URL('fixtures/official-standings.json', import.meta.url), 'utf8'))
);

const dataDir =
	process.env.DATA_DIR ?? fileURLToPath(new URL('../../../client/e2e/real/data', import.meta.url));

describe('standings from the results index match the official tables', () => {
	for (const table of OFFICIAL.seasons) {
		it(`${table.season} (${table.source})`, async (context) => {
			const bytes = await readFile(resultsPathOf(dataDir, table.season)).catch(() => null);

			if (bytes === null) {
				context.skip(
					`no results for ${table.season} in ${dataDir}: run npm run import -w server -- ${table.season}`
				);

				return;
			}

			const season = seasonResultsSchema.parse(JSON.parse(gunzipSync(bytes).toString('utf8')));
			const drivers = driverStandings(season, table.throughRound);

			assert.deepEqual(
				table.drivers.map((row) => {
					const own = drivers.find((entry) => entry.id === driverIdOf(row.firstName, row.lastName));

					return `${row.position} ${row.lastName} ${own?.position ?? '-'}/${own?.points ?? '-'}`;
				}),
				table.drivers.map((row) => `${row.position} ${row.lastName} ${row.position}/${row.points}`)
			);

			assert.deepEqual(
				teamStandings(season, table.throughRound).map((entry) => entry.points),
				table.teams.map((row) => row.points)
			);
		});
	}
});
