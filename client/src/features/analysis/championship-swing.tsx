import type { SessionType } from '@f1-live/shared';
import * as React from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';

import { DataTable, TableKey } from '@/components/console/data-table';
import { Digits } from '@/components/console/digits';
import { KeyGroup } from '@/components/console/keys';
import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag, TeamStripe } from '@/components/driver-tag';
import { RaceOnly } from '@/components/race-only';
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent
} from '@/components/ui/chart';
import { type Catalog, sessionEntries } from '@/data/catalog';
import { useRaceView } from '@/data/race-context';
import { isTimedSession } from '@/insights/qualifying';
import {
	championshipSwing,
	contenders,
	placeValues,
	pointsStillOnOffer,
	positionAt,
	type ProjectedPlace,
	projectedDrivers,
	projectedTeams
} from '@/insights/championship';
import { cn } from '@/lib/utils';

import { useTileFill } from '../dashboard/tile-fill';

import { isSecondTeamCar } from './chart-drivers';
import { flagBands } from './chart-marks';
import { flagRanges } from './lap-series';

const VIEWS = [
	{ value: 'drivers', label: 'Drivers' },
	{ value: 'teams', label: 'Teams' }
] as const;

type View = (typeof VIEWS)[number]['value'];

/** The table lists the top of the championship. */
const SHOWN_PLACES = 10;

/** The swing always follows the top three, and anyone else who can still win it. */
const ALWAYS_FOLLOWED = 3;

const MOST_FOLLOWED = 5;

/** Races and sprints left in the season after this session, from the catalogue. */
function upcomingScoring(catalog: Catalog | null, sessionKey: string): SessionType[] {
	const entries = catalog ? sessionEntries(catalog) : [];
	const current = entries.find((entry) => entry.key === sessionKey);

	return current
		? entries
				.filter(
					(entry) =>
						entry.year === current.year &&
						entry.session.startsAt > current.session.startsAt &&
						(entry.session.type === 'race' || entry.session.type === 'sprint')
				)
				.map((entry) => entry.session.type)
		: [];
}

function movement(place: ProjectedPlace, priorPosition: number | undefined): string {
	const moved = (priorPosition ?? place.projectedPosition) - place.projectedPosition;

	return moved > 0 ? `▲${moved}` : moved < 0 ? `▼${-moved}` : '';
}

function signedPoints(points: number): string {
	return points > 0 ? `+${points}` : points < 0 ? `−${-points}` : '0';
}

/**
 * The championship as the session runs: where it would stand if it ended now, how far each
 * contender sat from the lead lap by lap, and what every finishing place is worth to them.
 */
export function ChampionshipSwing() {
	const { snapshot, catalog, sessionKey, live } = useRaceView();
	const fill = useTileFill();
	const [view, setView] = React.useState<View>('drivers');
	const [table, setTable] = React.useState(false);
	const standings = snapshot.championship;
	const lap = snapshot.currentLap;

	const followed = React.useMemo(() => {
		if (!standings) {
			return [];
		}

		const alive = contenders(
			snapshot,
			pointsStillOnOffer(
				upcomingScoring(catalog, sessionKey),
				new Date(snapshot.session.startsAt).getUTCFullYear()
			)
		);

		const top = standings.drivers
			.toSorted((a, b) => a.position - b.position)
			.slice(0, ALWAYS_FOLLOWED)
			.map((place) => place.driverNumber);

		return [...new Set([...top, ...alive])].slice(0, MOST_FOLLOWED);
	}, [standings, snapshot, catalog, sessionKey]);

	const swing = React.useMemo(() => championshipSwing(snapshot, followed), [snapshot, followed]);

	// Each row asks what every place pays that driver, others as they run now.
	const worth = React.useMemo(
		() =>
			followed.map((driverNumber) => ({
				driverNumber,
				position: positionAt(snapshot, driverNumber, lap),
				values: placeValues(snapshot, driverNumber, lap)
			})),
		[snapshot, followed, lap]
	);

	const drivers = new Map(snapshot.drivers.map((driver) => [driver.number, driver]));
	const followedDrivers = followed.flatMap((number) => drivers.get(number) ?? []);

	const places =
		view === 'drivers' ? projectedDrivers(snapshot, lap) : projectedTeams(snapshot, lap);

	const prior = new Map(
		view === 'drivers'
			? (standings?.drivers ?? []).map((place) => [place.driverNumber, place.position])
			: (standings?.teams ?? []).map((place) => [place.team, place.position])
	);

	const teamDriver = (team: string) => snapshot.drivers.find((driver) => driver.team === team);

	const config: ChartConfig = Object.fromEntries(
		followedDrivers.map((driver) => [
			driver.number,
			{ label: driver.code, color: `#${driver.teamColour}` }
		])
	);

	return (
		<Panel
			aria-label="Championship"
			data-testid="championship"
			className={cn('min-h-0', fill && 'h-full')}
		>
			<PanelHeader
				title="Championship"
				meta={
					lap > 0 && !isTimedSession(snapshot.session.type)
						? `as it stands after L${lap}`
						: undefined
				}
			>
				<KeyGroup label="Championship" options={VIEWS} value={view} onChange={setView} />
				<TableKey table={table} onTableChange={setTable} />
			</PanelHeader>
			<div className={cn('flex flex-col gap-4 p-4', fill && 'min-h-0 flex-1 overflow-y-auto')}>
				<RaceOnly what="The championship projection">
					{!standings ? (
						<p className="text-muted-foreground text-sm" data-testid="championship-unavailable">
							{live.isLive
								? 'The live feed sends no championship standings; they fill in after the session from the archive.'
								: 'This session was saved without the championship standings.'}
						</p>
					) : (
						<>
							<ol className="flex flex-col" aria-label="Projected standings">
								{places.slice(0, SHOWN_PLACES).map((place) => {
									const driver = view === 'drivers' ? drivers.get(place.id) : teamDriver(place.id);

									return (
										<li
											key={place.id}
											className="grid h-8 grid-cols-[1.5rem_2rem_minmax(0,1fr)_3.5rem_3rem_3.5rem] items-center gap-2 border-b text-sm last:border-b-0"
										>
											<span className="text-right font-mono text-xs">
												{place.projectedPosition}
											</span>
											<span className="text-muted-foreground font-mono text-xs">
												{movement(place, prior.get(place.id))}
											</span>
											<span className="flex min-w-0 items-center gap-2">
												{view === 'drivers' && driver ? (
													<DriverTag driver={driver} showName />
												) : (
													<>
														{driver ? <TeamStripe driver={driver} /> : null}
														<span className="truncate">{place.id}</span>
													</>
												)}
											</span>
											<Digits
												className="text-muted-foreground text-right"
												value={`${place.points}`}
											/>
											<Digits
												className="text-right"
												value={place.gained > 0 ? `+${place.gained}` : ''}
											/>
											<Digits className="text-right font-bold" value={`${place.projectedPoints}`} />
										</li>
									);
								})}
							</ol>
							{view === 'drivers' && followedDrivers.length > 0 ? (
								<>
									<section
										className="flex flex-col gap-2"
										aria-label="Points behind the leader, lap by lap"
									>
										<span className="type-label">Points behind the projected leader</span>
										{table ? (
											<DataTable
												caption="Points behind the projected leader after each lap"
												columns={[
													{ key: 'lap', label: 'Lap' },
													...followedDrivers.map((driver) => ({
														key: driver.number,
														label: driver.code,
														numeric: true
													}))
												]}
												rows={swing.map((point) => ({
													id: String(point.lap),
													lap: `L${point.lap}`,
													...Object.fromEntries(
														followedDrivers.map((driver) => [
															driver.number,
															point[driver.number]?.toString() ?? null
														])
													)
												}))}
											/>
										) : (
											<ChartContainer config={config} className="aspect-auto h-48 w-full @4xl:h-64">
												<LineChart data={swing} margin={{ left: 4, right: 12, top: 18 }}>
													<CartesianGrid vertical={false} />
													<XAxis
														dataKey="lap"
														type="number"
														domain={[1, 'dataMax']}
														tickLine={false}
														axisLine={false}
														tickFormatter={(value: number) => `L${value}`}
													/>
													<YAxis
														reversed
														tickLine={false}
														axisLine={false}
														width={36}
														allowDecimals={false}
													/>
													{flagBands(flagRanges(snapshot))}
													<ReferenceLine y={0} stroke="var(--rule-strong)" />
													<ChartTooltip
														content={
															<ChartTooltipContent
																labelFormatter={(value) => `After lap ${String(value)}`}
																valueFormatter={(value) =>
																	value === 0 ? 'Leads' : `${value} behind`
																}
															/>
														}
													/>
													{followedDrivers.map((driver) => (
														<Line
															key={driver.number}
															dataKey={driver.number}
															type="stepAfter"
															stroke={`var(--color-${driver.number})`}
															strokeWidth={2}
															strokeDasharray={
																isSecondTeamCar(driver, followedDrivers) ? '5 3' : undefined
															}
															dot={false}
															isAnimationActive={false}
														/>
													))}
												</LineChart>
											</ChartContainer>
										)}
									</section>
									<section className="flex flex-col gap-2" aria-label="What each place is worth">
										<span className="type-label">
											What each finishing place is worth, others as they run
										</span>
										<div className="overflow-x-auto">
											<table className="w-full text-sm" data-testid="place-values">
												<caption className="sr-only">
													Points ahead of the best rival for each finishing place; negative is
													behind
												</caption>
												<thead>
													<tr className="border-b">
														<th scope="col" className="type-label pb-1 text-left font-normal">
															Driver
														</th>
														{(worth[0]?.values ?? []).map((value) => (
															<th
																key={value.finish ?? 'none'}
																scope="col"
																className="type-label px-1 pb-1 text-right font-normal"
															>
																{value.finish === null ? 'None' : `P${value.finish}`}
															</th>
														))}
													</tr>
												</thead>
												<tbody>
													{followedDrivers.map((driver) => {
														const row = worth.find((entry) => entry.driverNumber === driver.number);

														return (
															<tr key={driver.number} className="h-8 border-b last:border-b-0">
																<th scope="row" className="pr-2 text-left font-normal">
																	<DriverTag driver={driver} />
																</th>
																{(row?.values ?? []).map((value) => (
																	<td
																		key={value.finish ?? 'none'}
																		className={cn(
																			'px-1 text-right font-mono whitespace-nowrap',
																			value.finish === row?.position &&
																				'outline-foreground outline -outline-offset-2',
																			value.marginPoints < 0 && 'text-muted-foreground'
																		)}
																	>
																		{signedPoints(value.marginPoints)}
																	</td>
																))}
															</tr>
														);
													})}
												</tbody>
											</table>
										</div>
									</section>
								</>
							) : null}
							<p className="text-muted-foreground text-xs">
								Points before the session plus what each place pays now; the last lap counts the
								stewards’ decisions. The swing follows the top three and anyone still able to win
								the title with the races left in the season. In the place table, each cell is the
								margin over the best of the others if the driver finished there; the outlined one is
								where they run.
							</p>
						</>
					)}
				</RaceOnly>
			</div>
		</Panel>
	);
}
