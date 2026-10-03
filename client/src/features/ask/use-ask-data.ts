import * as React from 'react';

import { useRace } from '@/data/race-context';
import { useSeasonResults } from '@/data/results-context';
import { heldFromHistory } from '@/data/spoilers';
import { useSpoilerSettings } from '@/data/viewer-settings';
import { useNow } from '@/hooks/use-now';

import { buildAskContext } from './ask-context';
import type { AskData } from './ask-data';

/** The first season with a results index. */
const FIRST_SEASON = 2018;

/** The answers' data, null until it loads; when a load fails, why, and a way to try again. */
export type AskDataState = { data: AskData | null; error: string | null; retry: () => void };

/**
 * What answers are computed from: every season's results, loaded when the palette first opens.
 * Results the viewer has not seen follow the history pages' rule (`heldFromHistory`).
 */
export function useAskData(): AskDataState {
	const { catalog, sessionKey, spoilers } = useRace();
	const settings = useSpoilerSettings();
	const now = useNow();

	const years = React.useMemo(
		() =>
			catalog?.seasons.map((season) => season.year).filter((year) => year >= FIRST_SEASON) ?? [],
		[catalog]
	);

	const [attempt, setAttempt] = React.useState(0);
	const results = useSeasonResults(years, attempt);
	const retry = React.useCallback(() => setAttempt((count) => count + 1), []);
	const seasons = results.status === 'ready' ? results.seasons : null;

	const context = React.useMemo(
		() => (seasons ? buildAskContext(seasons, catalog, now) : null),
		[seasons, catalog, now]
	);

	const data = React.useMemo<AskData | null>(
		() =>
			seasons && context
				? {
						seasons,
						context,
						catalog,
						// The open session keeps the console's rule: hidden until revealed, however old.
						held: (key, startsAt) =>
							(key === sessionKey && spoilers.hidden) ||
							heldFromHistory(settings, key, startsAt, now),
						now,
						openKey: sessionKey
					}
				: null,
		[seasons, context, catalog, settings, now, sessionKey, spoilers.hidden]
	);

	return { data, error: results.status === 'error' ? results.message : null, retry };
}
