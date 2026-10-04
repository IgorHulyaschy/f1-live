import { type SeasonDecisions, seasonDecisionsSchema } from '@f1-live/shared/decisions';

import decisions2025 from './decisions-2025.json';

/**
 * The offline replay's decisions, a few real ones of the 2025 season (stewards' documents from
 * fia.com), so race control, driver pages and Ask have something to link to without a server.
 */
export function sampleDecisions(season: number): SeasonDecisions | null {
	return season === 2025 ? seasonDecisionsSchema.parse(decisions2025) : null;
}
