import type { SeasonResults } from '@f1-live/shared/results';
import * as React from 'react';

type LoadResults = (season: number) => Promise<SeasonResults | null>;

const ResultsContext = React.createContext<LoadResults>(() => Promise.resolve(null));

/** Season results indexes for the history pages, each fetched once per page load. */
export function ResultsProvider({
	load,
	children
}: {
	load: LoadResults;
	children: React.ReactNode;
}) {
	const [cache] = React.useState(() => new Map<number, Promise<SeasonResults | null>>());

	const cached = React.useCallback<LoadResults>(
		(season) => {
			const known = cache.get(season);

			if (known) {
				return known;
			}

			const loading = load(season);

			cache.set(season, loading);
			// A failed load is asked for again next time.
			loading.catch(() => cache.delete(season));

			return loading;
		},
		[cache, load]
	);

	return <ResultsContext value={cached}>{children}</ResultsContext>;
}

export type SeasonsState =
	| { status: 'loading' }
	| { status: 'error'; message: string }
	/** The seasons that have an index, oldest first. */
	| { status: 'ready'; seasons: readonly SeasonResults[] };

/** The results indexes of `years`; a year the source has none for is left out. */
export function useSeasonResults(years: readonly number[]): SeasonsState {
	const load = React.use(ResultsContext);
	const wanted = years.toSorted((a, b) => a - b).join(',');

	const [state, setState] = React.useState<{ wanted: string; value: SeasonsState }>({
		wanted: '',
		value: { status: 'loading' }
	});

	React.useEffect(() => {
		let cancelled = false;
		const list = wanted === '' ? [] : wanted.split(',').map(Number);

		async function run() {
			try {
				const seasons = await Promise.all(list.map((year) => load(year)));

				if (!cancelled) {
					setState({
						wanted,
						value: { status: 'ready', seasons: seasons.filter((season) => season !== null) }
					});
				}
			} catch (error) {
				if (!cancelled) {
					setState({
						wanted,
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
	}, [load, wanted]);

	return state.wanted === wanted ? state.value : { status: 'loading' };
}
