import { EyeOffIcon } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router';

import { Key } from '@/components/console/keys';
import { Panel, PanelHeader } from '@/components/console/panel';
import { useRace } from '@/data/race-context';
import { useSeasonResults } from '@/data/results-context';
import { revealSession } from '@/data/viewer-settings';
import { includedKeys, useHistoryFilter, useYears } from '@/features/history/history-data';
import { StandingsTable } from '@/features/history/standings-table';
import { scoredRounds } from '@/insights/season-results';

import { heldRounds } from './held-rounds';

const SHOWN_DRIVERS = 5;

const SHOWN_TEAMS = 3;

/**
 * The home's championship: the season's standings after its latest round the viewer may see, and
 * how many recent rounds are held back, one click from showing. Without a results index for the
 * season, `fallback` (the open session's own table) stands in.
 */
export function HomeStandings({
	className,
	linkClassName,
	fallback
}: {
	className?: string;
	linkClassName: string;
	fallback: React.ReactNode;
}) {
	const { catalog } = useRace();
	const year = useYears().at(-1);
	const state = useSeasonResults(year === undefined ? [] : [year]);
	const counts = useHistoryFilter();
	const season = state.status === 'ready' ? (state.seasons[0] ?? null) : null;

	const include = React.useMemo(
		() => includedKeys(season ? [season] : [], counts),
		[season, counts]
	);

	const round = season ? scoredRounds(season, include).at(-1) : undefined;
	const held = season ? heldRounds(season, include) : null;

	// Until the catalog names the seasons nothing is known to be missing, so the standings load
	// rather than flash the fallback first.
	if (
		catalog &&
		state.status !== 'loading' &&
		(!season || !held || (!round && held.rounds.length === 0))
	) {
		return fallback;
	}

	return (
		<Panel aria-labelledby="home-championship-title" className={className}>
			<PanelHeader
				title={<span id="home-championship-title">Championship</span>}
				meta={season ? `${season.season}${round ? `, after R${round.round}` : ''}` : undefined}
			>
				<Link
					to={season ? `/standings?season=${season.season}` : '/standings'}
					className={linkClassName}
				>
					Full standings
				</Link>
			</PanelHeader>
			{season && held ? (
				<div className="@container flex flex-col gap-3 px-4 py-3" data-testid="home-championship">
					{held.rounds.length > 0 ? (
						<p
							className="bg-card flex flex-wrap items-center gap-x-3 gap-y-2 border border-l-4 px-3 py-2 text-sm"
							data-testid="home-held-rounds"
						>
							<EyeOffIcon aria-hidden className="size-4 shrink-0" />
							<span>
								{held.rounds.length === 1
									? `R${held.rounds[0]?.round} is held back`
									: `${held.rounds.length} recent rounds are held back`}
								: results you have not seen yet are left out.
							</span>
							<Key
								pressed
								className="ml-auto"
								onClick={() => {
									for (const session of held.sessions) {
										revealSession(String(session.key));
									}
								}}
							>
								Show {held.rounds.length === 1 ? 'it' : 'them'}
							</Key>
						</p>
					) : null}
					{round ? (
						<div className="grid gap-x-6 gap-y-2 @2xl:grid-cols-2">
							<StandingsTable
								season={season}
								view="drivers"
								throughRound={round.round}
								include={include}
								limit={SHOWN_DRIVERS}
							/>
							<StandingsTable
								season={season}
								view="teams"
								throughRound={round.round}
								include={include}
								limit={SHOWN_TEAMS}
							/>
						</div>
					) : null}
				</div>
			) : (
				<p className="text-muted-foreground px-4 py-4 text-sm">Loading the standings</p>
			)}
		</Panel>
	);
}
