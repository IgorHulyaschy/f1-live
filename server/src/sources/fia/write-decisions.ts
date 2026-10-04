import { readSeasonResults } from '../../results/season.js';
import { decisionsPathOf, writeAtomic } from '../../sinks/files.js';
import { decisionsOf } from './build.js';
import { readDocuments, readListing } from './fetch-decisions.js';
import { FIA_SEASON_PAGES } from './listing.js';

/**
 * Writes `out/decisions/<season>.json` for each season whose document list is saved, from the
 * saved readings and the results index. No network. Returns the seasons written.
 */
export async function writeDecisions(
	dataDir: string,
	seasons: readonly number[] = [...FIA_SEASON_PAGES.keys()]
): Promise<Map<number, number>> {
	const documents = await readDocuments(dataDir);
	const results = await readSeasonResults(dataDir);
	const written = new Map<number, number>();

	for (const season of seasons) {
		// oxlint-disable-next-line no-await-in-loop -- one season at a time.
		const listing = await readListing(dataDir, season);

		if (listing.length === 0) {
			continue;
		}

		const built = decisionsOf(
			season,
			listing,
			documents,
			results.find((entry) => entry.season === season) ?? null
		);

		// oxlint-disable-next-line no-await-in-loop -- see above.
		await writeAtomic(decisionsPathOf(dataDir, season), JSON.stringify(built));
		written.set(season, built.decisions.length);
	}

	return written;
}
