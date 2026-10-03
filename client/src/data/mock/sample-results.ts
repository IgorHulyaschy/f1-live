import { type SeasonResults, seasonResultsSchema } from '@f1-live/shared/results';

import results2025 from './results-2025.json';

/**
 * The offline replay's season, from the real results index (e2e/real/data), so the calendar,
 * standings, driver pages and head-to-head have something real to show without a server.
 */
export function sampleResults(season: number): SeasonResults | null {
	return season === 2025 ? seasonResultsSchema.parse(results2025) : null;
}
