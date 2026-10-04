import * as React from 'react';
import { useSearchParams } from 'react-router';

import { KeyGroup } from '@/components/console/keys';
import { Panel, PanelHeader } from '@/components/console/panel';
import { SeasonSwitch } from '@/components/season-switch';
import { LoadingState } from '@/components/site-frame';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select';
import { useSeasonResults } from '@/data/results-context';
import { scoredRounds } from '@/insights/season-results';

import {
	HiddenNote,
	includedKeys,
	PageTitle,
	useHistoryFilter,
	useSearchUpdate,
	useYears
} from './history-data';
import { RoundPodium } from './round-podium';
import { StandingsTable, type StandingsView } from './standings-table';

const VIEWS = [
	{ value: 'drivers', label: 'Drivers' },
	{ value: 'teams', label: 'Constructors' }
] as const satisfies readonly { value: StandingsView; label: string }[];

/** `/standings`: either championship for any season, after any round. */
export function StandingsPage() {
	const years = useYears();
	const [params] = useSearchParams();
	const set = useSearchUpdate();
	const year = Number(params.get('season')) || (years.at(-1) ?? 0);
	const view: StandingsView = params.get('view') === 'teams' ? 'teams' : 'drivers';
	const state = useSeasonResults(year === 0 ? [] : [year]);
	const counts = useHistoryFilter();

	const season = state.status === 'ready' ? (state.seasons[0] ?? null) : null;

	const include = React.useMemo(
		() => includedKeys(season ? [season] : [], counts),
		[season, counts]
	);

	const rounds = season ? scoredRounds(season, include) : [];
	const asked = Number(params.get('round'));
	const round = rounds.find((entry) => entry.round === asked) ?? rounds.at(-1);

	const hidden = season
		? season.rounds
				.filter((entry) => entry.round <= (round?.round ?? Infinity))
				.flatMap((entry) =>
					entry.sessions.filter(
						(session) =>
							(session.type === 'race' || session.type === 'sprint') && !include(session.key)
					)
				)
		: [];

	return (
		<div className="flex flex-col gap-6" data-testid="standings-page">
			<PageTitle title="Standings">
				The drivers’ and constructors’ championships for any season, after any round. Points follow
				each season’s rules, sprints and fastest laps included, with the stewards’ later decisions.
			</PageTitle>
			<div className="flex flex-wrap items-center gap-2">
				{years.length > 0 ? (
					<SeasonSwitch
						years={years}
						value={year}
						onChange={(value) => set({ season: String(value), round: null })}
					/>
				) : null}
				{rounds.length > 0 && round ? (
					<Select value={String(round.round)} onValueChange={(value) => set({ round: value })}>
						<SelectTrigger size="sm" aria-label="After round">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{rounds.toReversed().map((entry) => (
								<SelectItem key={entry.round} value={String(entry.round)}>
									After R{entry.round} {entry.name.replace(/ Grand Prix$/, '')}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : null}
				<KeyGroup
					label="Championship"
					options={VIEWS}
					value={view}
					onChange={(value) => set({ view: value === 'drivers' ? null : value })}
				/>
			</div>
			<HiddenNote sessions={hidden} />
			{state.status === 'loading' ? <LoadingState label="Loading results" /> : null}
			{state.status === 'error' ? (
				<p className="text-muted-foreground text-sm" role="alert">
					The results could not be loaded: {state.message}
				</p>
			) : null}
			{state.status === 'ready' && (!season || !round) ? (
				<p className="text-muted-foreground text-sm">No results for {year} yet.</p>
			) : null}
			{season && round ? (
				<RoundPodium season={season} round={round} include={include} className="max-w-3xl" />
			) : null}
			{season && round ? (
				<Panel className="max-w-3xl">
					<PanelHeader
						title={view === 'drivers' ? 'Drivers' : 'Constructors'}
						meta={`${season.season}, after round ${round.round}: ${round.name}`}
					/>
					<div className="px-4 pb-2">
						<StandingsTable
							season={season}
							view={view}
							throughRound={round.round}
							include={include}
						/>
					</div>
				</Panel>
			) : null}
		</div>
	);
}
