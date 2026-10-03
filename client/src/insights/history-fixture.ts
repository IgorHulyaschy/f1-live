import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

import { type SeasonResults, seasonResultsSchema } from '@f1-live/shared/results';

/** The seasons the real-data e2e fixture holds, for tests of the history views. */
export const FIXTURE_SEASONS = [2018, 2019, 2020, 2021, 2023, 2024, 2025, 2026] as const;

/** The real results index, as the importer wrote it into the e2e fixture. */
export function fixtureSeasons(): SeasonResults[] {
	return FIXTURE_SEASONS.map((year) =>
		seasonResultsSchema.parse(
			JSON.parse(
				gunzipSync(
					readFileSync(new URL(`../../e2e/real/data/out/results/${year}.json.gz`, import.meta.url))
				).toString('utf8')
			)
		)
	);
}
