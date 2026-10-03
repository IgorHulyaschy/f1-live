import type { ResultRow } from '@f1-live/shared/results';
import { SwordsIcon } from 'lucide-react';
import * as React from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { Field, Panel, PanelHeader } from '@/components/console/panel';
import { SeasonSwitch } from '@/components/season-switch';
import { LoadingState } from '@/components/site-frame';
import { useSeasonResults } from '@/data/results-context';
import { driverWeekends, seasonSummaries, teammates } from '@/insights/season-results';

import { sessionLink } from './h2h-sections';
import {
	driverInfo,
	driverName,
	countedSeasons,
	HiddenNote,
	includedKeys,
	PageTitle,
	useHistoryFilter,
	useSearchUpdate,
	useYears
} from './history-data';

function place(row: ResultRow | null): string {
	if (!row) {
		return '–';
	}

	if (row.status === 'dsq' || row.status === 'dns') {
		return row.status.toUpperCase();
	}

	return row.classified ? `P${row.position}` : row.status === 'nc' ? 'NC' : 'DNF';
}

function cell(result: ResultRow | null, key: number | undefined) {
	return result && key !== undefined ? (
		<Link to={sessionLink(key, result.number)} className="hover:underline">
			{place(result)}
		</Link>
	) : (
		'–'
	);
}

function points(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * `/drivers/:id`: a driver across seasons: career numbers, each season summed up, every weekend's
 * qualifying, sprint and race with links into the sessions, and their teammates with a
 * head-to-head a click away.
 */
export function DriverPage() {
	const { id = '' } = useParams();
	const years = useYears();
	const state = useSeasonResults(years);
	const [params] = useSearchParams();
	const set = useSearchUpdate();
	const counts = useHistoryFilter();
	const seasons = React.useMemo(() => (state.status === 'ready' ? state.seasons : []), [state]);
	const include = React.useMemo(() => includedKeys(seasons, counts), [seasons, counts]);
	const info = driverInfo(seasons, id);
	const name = driverName(info, id);
	const summaries = seasonSummaries(seasons, id, include);
	const weekends = driverWeekends(seasons, id, include);
	const ownYears = summaries.map((summary) => summary.season);
	const year = Number(params.get('season')) || (ownYears.at(-1) ?? 0);
	const mates = teammates(countedSeasons(seasons, include), id);

	const hidden = driverWeekends(seasons, id).flatMap((weekend) =>
		Object.values(weekend.sessions).flatMap((session) =>
			session && !include(session.key) ? [session] : []
		)
	);

	const career = summaries.reduce(
		(sum, summary) => ({
			races: sum.races + summary.races,
			wins: sum.wins + summary.wins,
			podiums: sum.podiums + summary.podiums,
			poles: sum.poles + summary.poles,
			points: sum.points + summary.points,
			titles: sum.titles + (summary.position === 1 ? 1 : 0)
		}),
		{ races: 0, wins: 0, podiums: 0, poles: 0, points: 0, titles: 0 }
	);

	if (state.status === 'loading') {
		return <LoadingState label="Loading results" />;
	}

	if (state.status === 'ready' && summaries.length === 0 && hidden.length === 0) {
		return (
			<div className="flex flex-col gap-4" data-testid="driver-page">
				<PageTitle title="Driver not found">
					No driver with the id “{id}” raced or qualified since {years[0] ?? 2018}.
				</PageTitle>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6" data-testid="driver-page">
			<PageTitle title={name}>
				{info?.code ? `${info.code}, every` : 'Every'} weekend since {years[0] ?? 2018} the archive
				holds. Points follow each season’s rules; results you have not seen yet are left out.
			</PageTitle>
			<div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-y py-3">
				<Field label="Seasons">{summaries.length}</Field>
				<Field label="Races">{career.races}</Field>
				<Field label="Wins">{career.wins}</Field>
				<Field label="Podiums">{career.podiums}</Field>
				<Field label="Poles">{career.poles}</Field>
				<Field label="Points">{points(career.points)}</Field>
				<Field label="Titles">{career.titles}</Field>
			</div>
			<HiddenNote sessions={hidden} />
			<div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
				<div className="flex flex-col gap-6">
					<Panel>
						<PanelHeader title="Weekends" meta={`${year}`}>
							{ownYears.length > 1 ? (
								<SeasonSwitch
									years={ownYears}
									value={year}
									onChange={(value) => set({ season: String(value) })}
								/>
							) : null}
						</PanelHeader>
						<div className="overflow-x-auto px-4">
							<table className="w-full text-sm" data-testid="driver-weekends">
								<caption className="sr-only">
									{name}’s weekends in {year}
								</caption>
								<thead>
									<tr className="border-b">
										<th scope="col" className="type-label py-1.5 text-left font-normal">
											Weekend
										</th>
										<th scope="col" className="type-label px-2 text-left font-normal">
											Team
										</th>
										<th scope="col" className="type-label px-2 text-right font-normal">
											Quali
										</th>
										<th scope="col" className="type-label px-2 text-right font-normal">
											Sprint
										</th>
										<th scope="col" className="type-label px-2 text-right font-normal">
											Race
										</th>
										<th scope="col" className="type-label pl-2 text-right font-normal">
											Pts
										</th>
									</tr>
								</thead>
								<tbody>
									{weekends
										.filter((weekend) => weekend.season === year)
										.map((weekend) => {
											const row = weekend.race ?? weekend.qualifying;

											return (
												<tr key={weekend.round.meetingKey} className="h-8 border-b last:border-b-0">
													<td className="whitespace-nowrap">
														<span className="text-muted-foreground mr-2 font-mono text-xs">
															R{weekend.round.round}
														</span>
														{weekend.round.name.replace(/ Grand Prix$/, '')}
													</td>
													<td className="text-muted-foreground truncate px-2 text-xs">
														{row?.team}
													</td>
													<td className="px-2 text-right font-mono">
														{cell(weekend.qualifying, weekend.sessions.qualifying?.key)}
													</td>
													<td className="px-2 text-right font-mono">
														{cell(weekend.sprint, weekend.sessions.sprint?.key)}
													</td>
													<td className="px-2 text-right font-mono font-bold">
														{cell(weekend.race, weekend.sessions.race?.key)}
													</td>
													<td className="pl-2 text-right font-mono">
														{points((weekend.race?.points ?? 0) + (weekend.sprint?.points ?? 0))}
													</td>
												</tr>
											);
										})}
								</tbody>
							</table>
						</div>
					</Panel>
				</div>
				<div className="flex flex-col gap-6">
					<Panel>
						<PanelHeader title="Seasons" />
						<div className="overflow-x-auto px-4">
							<table className="w-full text-sm" data-testid="driver-seasons">
								<caption className="sr-only">{name} season by season</caption>
								<thead>
									<tr className="border-b">
										<th scope="col" className="type-label py-1.5 text-left font-normal">
											Season
										</th>
										<th scope="col" className="type-label px-2 text-right font-normal">
											Races
										</th>
										<th scope="col" className="type-label px-2 text-right font-normal">
											Wins
										</th>
										<th scope="col" className="type-label px-2 text-right font-normal">
											Pod
										</th>
										<th scope="col" className="type-label px-2 text-right font-normal">
											Pts
										</th>
										<th scope="col" className="type-label pl-2 text-right font-normal">
											Pos
										</th>
									</tr>
								</thead>
								<tbody>
									{summaries.toReversed().map((summary) => (
										<tr key={summary.season} className="h-9 border-b last:border-b-0">
											<td>
												<Link
													to={`/standings?season=${summary.season}`}
													className="font-mono hover:underline"
												>
													{summary.season}
												</Link>
												<span className="text-muted-foreground block truncate text-xs">
													{summary.teams.join(', ')}
												</span>
											</td>
											<td className="px-2 text-right font-mono">{summary.races}</td>
											<td className="px-2 text-right font-mono">{summary.wins}</td>
											<td className="px-2 text-right font-mono">{summary.podiums}</td>
											<td className="px-2 text-right font-mono">{points(summary.points)}</td>
											<td className="pl-2 text-right font-mono font-bold">
												{summary.position ?? '–'}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</Panel>
					<Panel>
						<PanelHeader title="Teammates" meta="head to head as teammates" />
						<ul className="px-4" data-testid="driver-teammates">
							{mates.map((mate) => (
								<li
									key={`${mate.driver}-${mate.team}`}
									className="flex items-center gap-3 border-b py-2 last:border-b-0"
								>
									<span className="flex min-w-0 flex-1 flex-col">
										<Link
											to={`/drivers/${mate.driver}`}
											className="truncate text-sm font-medium hover:underline"
										>
											{driverName(driverInfo(seasons, mate.driver), mate.driver)}
										</Link>
										<span className="text-muted-foreground truncate text-xs">
											{mate.team}, {mate.seasons.join(', ')}
										</span>
									</span>
									<Link
										to={`/h2h?a=${id}&b=${mate.driver}&preset=teammates`}
										className="type-label hover:border-rule-strong inline-flex h-9 items-center gap-1.5 border border-b-2 px-2 sm:h-7"
									>
										<SwordsIcon aria-hidden />
										H2H
									</Link>
								</li>
							))}
						</ul>
					</Panel>
				</div>
			</div>
		</div>
	);
}
