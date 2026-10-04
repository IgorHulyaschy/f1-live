import type { SeasonDecisions } from '@f1-live/shared/decisions';
import type { Facts } from '@f1-live/shared/facts';
import * as React from 'react';

interface Loaders {
	decisions: (season: number) => Promise<SeasonDecisions | null>;
	facts: () => Promise<Facts | null>;
}

const NONE: Loaders = {
	decisions: () => Promise.resolve(null),
	facts: () => Promise.resolve(null)
};

const DecisionsContext = React.createContext<Loaders>(NONE);

/** Stewards' decisions per season and the driver and circuit facts, each fetched once per page load. */
export function DecisionsProvider({
	loadDecisions,
	loadFacts,
	children
}: {
	loadDecisions: Loaders['decisions'];
	loadFacts: Loaders['facts'];
	children: React.ReactNode;
}) {
	const [cache] = React.useState(() => new Map<string, Promise<unknown>>());

	const loaders = React.useMemo<Loaders>(() => {
		function once<T>(key: string, load: () => Promise<T>): Promise<T> {
			const known = cache.get(key);

			if (known) {
				// SAFETY: a key is only ever filled by the loader of its own type.
				return known as Promise<T>;
			}

			const loading = load();

			cache.set(key, loading);
			// A failed load is asked for again next time.
			loading.catch(() => cache.delete(key));

			return loading;
		}

		return {
			decisions: (season) => once(`d${season}`, () => loadDecisions(season)),
			facts: () => once('facts', loadFacts)
		};
	}, [cache, loadDecisions, loadFacts]);

	return <DecisionsContext value={loaders}>{children}</DecisionsContext>;
}

export type Loaded<T> =
	{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; value: T };

function useLoaded<T>(key: string, load: () => Promise<T>): Loaded<T> {
	const [state, setState] = React.useState<{ key: string; value: Loaded<T> }>({
		key: '',
		value: { status: 'loading' }
	});

	React.useEffect(() => {
		let cancelled = false;

		async function run() {
			try {
				const value = await load();

				if (!cancelled) {
					setState({ key, value: { status: 'ready', value } });
				}
			} catch (error) {
				if (!cancelled) {
					setState({
						key,
						value: {
							status: 'error',
							message: error instanceof Error ? error.message : 'Unknown error'
						}
					});
				}
			}
		}

		void run();

		return () => {
			cancelled = true;
		};
		// `load` is rebuilt every render; `key` says when its answer would change.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	return state.key === key ? state.value : { status: 'loading' };
}

/** The decisions of `years`, oldest season first; a year the source has none for is left out. */
export function useSeasonDecisions(years: readonly number[]): Loaded<SeasonDecisions[]> {
	const { decisions } = React.use(DecisionsContext);
	const wanted = years.toSorted((a, b) => a - b);

	return useLoaded(wanted.join(','), async () =>
		(await Promise.all(wanted.map((year) => decisions(year)))).filter((season) => season !== null)
	);
}

/** The Wikidata facts, or null when the source has none. */
export function useFacts(enabled = true): Loaded<Facts | null> {
	const { facts } = React.use(DecisionsContext);

	return useLoaded(enabled ? 'facts' : 'off', enabled ? facts : () => Promise.resolve(null));
}
