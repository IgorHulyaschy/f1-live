import * as React from 'react';
import { Link } from 'react-router';

import { KeyGroup } from '@/components/console/keys';
import { Panel, PanelHeader } from '@/components/console/panel';
import { sessionEntries } from '@/data/catalog';
import { useRace } from '@/data/race-context';
import { useSeasonResults } from '@/data/results-context';
import { scoredRounds } from '@/insights/season-results';

import { includedKeys, useHistoryFilter } from './history-data';
import { StandingsTable, type StandingsView } from './standings-table';

const VIEWS = [
	{ value: 'drivers', label: 'Drivers' },
	{ value: 'teams', label: 'Teams' }
] as const satisfies readonly { value: StandingsView; label: string }[];

/** Dashboard tile: the championship of the open session's season after its latest revealed round. */
export function SeasonStandingsTile() {
	const { catalog, sessionKey } = useRace();
	const [view, setView] = React.useState<StandingsView>('drivers');
	const counts = useHistoryFilter();

	const year = catalog
		? sessionEntries(catalog).find((entry) => entry.key === sessionKey)?.year
		: undefined;

	const state = useSeasonResults(year ? [year] : []);
	const season = state.status === 'ready' ? (state.seasons[0] ?? null) : null;

	const include = React.useMemo(
		() => includedKeys(season ? [season] : [], counts),
		[season, counts]
	);

	const round = season ? scoredRounds(season, include).at(-1) : undefined;

	return (
		<Panel data-testid="standings-tile">
			<PanelHeader
				title="Season standings"
				meta={season && round ? `${season.season}, after R${round.round}` : undefined}
			>
				<KeyGroup label="Championship" options={VIEWS} value={view} onChange={setView} />
			</PanelHeader>
			<div className="@container overflow-x-auto px-4 pb-2">
				{season && round ? (
					<>
						<StandingsTable
							season={season}
							view={view}
							throughRound={round.round}
							include={include}
							limit={10}
						/>
						<Link
							to={`/standings?season=${season.season}&view=${view}`}
							className="type-label hover:text-foreground block py-2"
						>
							Full standings
						</Link>
					</>
				) : (
					<p className="text-muted-foreground py-3 text-sm">
						{state.status === 'loading' ? 'Loading results' : 'No results for this season yet.'}
					</p>
				)}
			</div>
		</Panel>
	);
}
