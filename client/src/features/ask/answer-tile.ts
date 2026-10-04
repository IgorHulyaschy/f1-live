import type { AskInsight, Query } from '@f1-live/shared/ask';
import type { TileKind } from '@f1-live/shared/dashboard';

import { type AskData, findAskSession, openSession } from './ask-data.ts';

/** The tiles that show an insight for the whole field of the session on screen. */
const INSIGHT_TILES: Partial<Record<AskInsight, TileKind>> = {
	fastest_lap: 'fastest-laps',
	tyres: 'stints',
	pit_stops: 'pit-stops',
	sectors: 'sectors'
};

/**
 * The dashboard tile that keeps showing what a question asked, or null when none does. Tiles
 * follow the session on screen, so only a question about that session, or about its season's
 * standings, has one.
 */
export function answerTile(data: AskData, query: Query): TileKind | null {
	if (query.kind === 'standings' || query.kind === 'gap') {
		const after = query.kind === 'standings' ? query.after : null;

		return after === null && openSession(data)?.season === query.season ? 'season-standings' : null;
	}

	if (query.kind === 'pace') {
		const found = findAskSession(data, query.session);

		return query.mode !== 'long_run' && 'found' in found && found.found.key === data.openKey
			? 'pace'
			: null;
	}

	if (query.kind !== 'insight') {
		return null;
	}

	const lookup = findAskSession(data, query.session);
	const tile = INSIGHT_TILES[query.insight];

	return tile && 'found' in lookup && lookup.found.key === data.openKey ? tile : null;
}
