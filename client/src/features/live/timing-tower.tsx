import type { Lap } from '@f1-live/shared';
import { motion } from 'motion/react';
import * as React from 'react';

import { Digits } from '@/components/console/digits';
import { KeyGroup } from '@/components/console/keys';
import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { TyreBadge } from '@/components/tyre-badge';
import { useRace } from '@/data/race-context';
import { useNow } from '@/hooks/use-now';
import { timePenalties } from '@/insights/penalties';
import { predictRejoin } from '@/insights/pit-window';
import { type CutLine, cutLines, isTimedSession } from '@/insights/qualifying';
import { hasDrs } from '@/insights/rules';
import type { StandingRow } from '@/insights/standings';
import { formatGap, formatLapTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import { LapTrend, recentLaps, TREND_LAPS } from './lap-trend';
import { MiniSectors } from './mini-sectors';

type GapMode = 'interval' | 'leader';

type View = 'full' | 'near';

const GAP_OPTIONS = [
	{ value: 'interval', label: 'Int' },
	{ value: 'leader', label: 'Leader' }
] as const;

const VIEW_OPTIONS = [
	{ value: 'full', label: 'Field' },
	{ value: 'near', label: 'Near' }
] as const;

/** Cars shown either side of the followed driver in the near view. */
const NEAR_CARS = 3;

/** Within a second of the car ahead: DRS until 2025, overtake mode from 2026. */
const ONE_SECOND_MS = 1000;

const FLASH = {
	gain: ['rgba(74, 222, 128, 0.2)', 'rgba(74, 222, 128, 0)'],
	loss: ['rgba(248, 113, 113, 0.2)', 'rgba(248, 113, 113, 0)']
} as const;

const OUT_LABEL = { retired: 'DNF', disqualified: 'DSQ' } as const;

function previousPositions(laps: readonly Lap[], lap: number): Map<string, number> {
	return new Map(
		laps.flatMap((entry) =>
			entry.lap === lap - 1 ? [[entry.driverNumber, entry.position] as const] : []
		)
	);
}

function Chip({
	children,
	tone,
	title
}: {
	children: React.ReactNode;
	tone: 'flag' | 'danger' | 'outline';
	title?: string;
}) {
	return (
		<span
			title={title}
			className={cn(
				'type-label shrink-0 px-1 leading-4 font-bold',
				tone === 'flag' && 'bg-flag text-background',
				tone === 'danger' && 'bg-danger text-background',
				tone === 'outline' && 'text-foreground border'
			)}
		>
			{children}
		</span>
	);
}

function GapReading({ row, mode, timed }: { row: StandingRow; mode: GapMode; timed: boolean }) {
	if (row.out) {
		return <span className="type-label">{OUT_LABEL[row.out]}</span>;
	}

	if (timed) {
		if (row.bestLapMs === null) {
			return <span className="type-label">No time</span>;
		}

		const value = mode === 'leader' ? row.gapToLeaderMs : row.intervalMs;

		return value === null || value === 0 ? (
			<span className="type-label">{row.gapToLeaderMs === 0 ? 'Fastest' : '-'}</span>
		) : (
			<Digits value={formatGap(value)} />
		);
	}

	if (row.position === 1) {
		return <span className="type-label">Leader</span>;
	}

	if (row.lapsDown > 0) {
		return <span className="font-mono">+{row.lapsDown}L</span>;
	}

	const value = mode === 'leader' ? row.gapToLeaderMs : row.intervalMs;

	return value === null ? <span>-</span> : <Digits value={formatGap(value)} />;
}

function LapTime({ row, lap }: { row: StandingRow; lap: Lap | null }) {
	if (!lap || lap.lapTimeMs <= 0) {
		return <span className="text-muted-foreground">-</span>;
	}

	const isBest = lap.lapTimeMs === row.bestLapMs;

	return (
		<span
			className={cn(
				'font-mono',
				isBest && row.hasFastestLap && 'text-fastest',
				isBest && !row.hasFastestLap && 'text-personal-best'
			)}
		>
			{formatLapTime(lap.lapTimeMs)}
		</span>
	);
}

function GhostRow({ code, position }: { code: string; position: number }) {
	return (
		<motion.tr
			layout="position"
			className="border-focus h-9 border-y border-dashed"
			data-testid="ghost-row"
		>
			<td className="pl-4 font-mono text-sm font-bold">{position}</td>
			<td colSpan={8}>
				<span className="type-label text-foreground">{code} if boxing now</span>
			</td>
		</motion.tr>
	);
}

/** A qualifying knockout line, drawn under the last car that goes through. */
function CutRow({ line }: { line: CutLine }) {
	return (
		<tr aria-hidden data-testid="cut-line" className="h-0">
			<td colSpan={9} className="relative p-0">
				<span
					className={cn(
						'border-rule-strong absolute inset-x-0 -top-px border-t-2',
						!line.settled && 'border-dashed'
					)}
				/>
				<span className="type-label bg-panel absolute -top-2 right-4 px-1 leading-4">
					{line.label}
				</span>
			</td>
		</tr>
	);
}

export function TimingTower() {
	const { race, snapshot, lap, plan, followedDriver, setFollowedDriver, standings } = useRace();
	const [mode, setMode] = React.useState<GapMode>('interval');
	const [view, setView] = React.useState<View>('full');
	const rows = standings;
	const timed = isTimedSession(snapshot.session.type);
	const before = timed ? new Map<string, number>() : previousPositions(snapshot.laps, lap);
	const penalties = timePenalties(snapshot);
	const followedIndex = rows.findIndex((row) => row.driver.number === followedDriver);
	const rejoin = plan === 'pro' && !timed ? predictRejoin(snapshot, followedDriver) : null;
	const lines = cutLines(snapshot, rows.length);
	const oneSecondChip = hasDrs(race.session) ? 'DRS' : 'OVT';
	// Rows flash only for a change the viewer saw happen, not on the lap the tower opened on.
	const [openedOnLap] = React.useState(lap);
	const flashes = lap !== openedOnLap;
	const trends = recentLaps(snapshot.laps);
	const now = useNow();

	const visible =
		view === 'near' && followedIndex >= 0
			? rows.slice(Math.max(followedIndex - NEAR_CARS, 0), followedIndex + NEAR_CARS + 1)
			: rows;

	// The ghost row sits after the car the driver would rejoin behind. With no car ahead it leads
	// the table; when that car is outside the near view it closes the slice instead.
	const ghostAfter = rejoin?.carAhead?.driver.number ?? null;
	const ghostShown = visible.some((row) => row.driver.number === ghostAfter);

	const ghost = rejoin ? (
		<GhostRow code={rejoin.driver.code} position={rejoin.rejoinPosition} />
	) : null;

	const running = rows.filter((row) => row.state !== 'out').length;

	return (
		<Panel aria-label="Timing">
			<PanelHeader
				title="Timing"
				meta={
					rows.length === 0
						? 'No cars yet'
						: timed
							? `${rows.filter((row) => row.bestLapMs !== null).length} timed`
							: `${running} running`
				}
			>
				<KeyGroup label="Rows shown" options={VIEW_OPTIONS} value={view} onChange={setView} />
				<KeyGroup label="Gap shown" options={GAP_OPTIONS} value={mode} onChange={setMode} />
			</PanelHeader>
			{rows.length === 0 ? (
				<p className="text-muted-foreground px-4 py-6 text-sm" data-testid="timing-empty">
					{Date.parse(race.session.startsAt) > now
						? 'The timing fills in when the cars go out.'
						: 'No timing in this session’s data.'}
				</p>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full text-sm" data-testid="timing-table">
						<thead>
							<tr className="h-8 border-b">
								<th scope="col" className="type-label pl-4 text-left font-normal">
									Pos
								</th>
								<th scope="col" className="type-label text-left font-normal">
									Driver
								</th>
								<th scope="col" className="type-label pr-4 text-right font-normal">
									{mode === 'interval' ? 'Interval' : 'Gap'}
								</th>
								<th
									scope="col"
									className={cn(
										'type-label hidden pr-4 text-right font-normal',
										timed ? '@lg:table-cell' : '@2xl:table-cell'
									)}
								>
									{timed ? 'Best lap' : 'Last lap'}
								</th>
								<th
									scope="col"
									className="type-label hidden w-28 pr-4 text-right font-normal @2xl:table-cell xl:w-56"
								>
									S1 S2 S3
								</th>
								<th
									scope="col"
									className="type-label hidden pr-4 text-left font-normal @4xl:table-cell"
								>
									{timed ? 'Last lap' : `Last ${TREND_LAPS}`}
								</th>
								<th
									scope="col"
									className="type-label hidden pr-4 text-right font-normal @5xl:table-cell"
								>
									Trap
								</th>
								<th scope="col" className="type-label pr-4 text-left font-normal">
									Tyre
								</th>
								<th
									scope="col"
									className="type-label hidden pr-4 text-right font-normal @lg:table-cell"
								>
									{timed ? 'Laps' : 'Stops'}
								</th>
							</tr>
						</thead>
						<tbody>
							{rejoin && ghostAfter === null ? ghost : null}
							{visible.map((row, index) => {
								const followed = row.driver.number === followedDriver;
								const previous = before.get(row.driver.number);

								const moved =
									!flashes || previous === undefined || row.state === 'out'
										? 0
										: previous - row.position;

								const penalty = penalties.get(row.driver.number);
								const line = lines.find((entry) => entry.after === row.position);

								const knockedOut = lines.some(
									(entry) => entry.settled && row.position > entry.after
								);

								const withinOneSecond =
									!timed &&
									mode === 'interval' &&
									row.intervalMs !== null &&
									row.intervalMs < ONE_SECOND_MS &&
									row.position > 1 &&
									row.state === 'running';

								const ghostHere =
									ghostAfter !== null &&
									(row.driver.number === ghostAfter ||
										(!ghostShown && index === visible.length - 1));

								return (
									<React.Fragment key={row.driver.number}>
										<motion.tr
											layout="position"
											transition={{ type: 'tween', duration: 0.18, ease: 'easeOut' }}
											initial={false}
											animate={{
												backgroundColor:
													moved > 0 ? [...FLASH.gain] : moved < 0 ? [...FLASH.loss] : FLASH.gain[1]
											}}
											data-state={followed ? 'selected' : undefined}
											data-testid={`timing-row-${row.driver.code}`}
											onClick={() => setFollowedDriver(row.driver.number)}
											className={cn(
												'hover:bg-accent/70 data-[state=selected]:bg-accent relative h-10 cursor-pointer border-b',
												(row.state === 'out' || knockedOut) && 'text-muted-foreground'
											)}
										>
											<td className="relative pl-4">
												{followed ? (
													<span aria-hidden className="bg-focus absolute inset-y-0 left-0 w-0.75" />
												) : null}
												<span className="flex items-baseline gap-1.5">
													<span className="w-5 text-right font-mono text-sm font-bold">
														{row.out === 'disqualified' ? '-' : row.position}
													</span>
													{timed || row.state === 'out' || !row.positionsGained ? null : (
														<span
															className={cn(
																'font-mono text-xs',
																row.positionsGained > 0 ? 'text-personal-best' : 'text-danger'
															)}
														>
															{row.positionsGained > 0
																? `+${row.positionsGained}`
																: row.positionsGained}
															<span className="sr-only"> places since the start</span>
														</span>
													)}
												</span>
											</td>
											<td className="max-w-0 min-w-24">
												<span className="flex items-center gap-2">
													<DriverTag driver={row.driver} showName showNumber />
													{row.state === 'pit' ? <Chip tone="flag">Pit</Chip> : null}
													{row.out ? (
														<Chip tone="danger" title={row.outReason ?? undefined}>
															{OUT_LABEL[row.out]}
														</Chip>
													) : null}
													{penalty && !row.out ? <Chip tone="danger">+{penalty}s</Chip> : null}
													{row.outReason ? (
														<span className="text-muted-foreground hidden truncate text-xs @4xl:inline">
															{row.outReason}
														</span>
													) : null}
												</span>
											</td>
											<td className="pr-4 text-right whitespace-nowrap">
												<span className="flex items-center justify-end gap-2">
													{withinOneSecond ? (
														<Chip
															tone="outline"
															title={
																oneSecondChip === 'DRS'
																	? 'Within a second: DRS'
																	: 'Within a second: overtake mode'
															}
														>
															{oneSecondChip}
														</Chip>
													) : null}
													<GapReading row={row} mode={mode} timed={timed} />
												</span>
											</td>
											<td
												className={cn(
													'hidden pr-4 text-right',
													timed ? '@lg:table-cell' : '@2xl:table-cell'
												)}
											>
												<LapTime row={row} lap={timed ? row.bestLap : row.lastLap} />
											</td>
											<td className="hidden pr-4 @2xl:table-cell">
												<MiniSectors lap={row.lastLap} marks={row.sectorMarks} timed={timed} />
											</td>
											<td className="hidden pr-4 @4xl:table-cell">
												{timed ? (
													<LapTime row={row} lap={row.lastLap} />
												) : (
													<LapTrend
														laps={trends.get(row.driver.number) ?? []}
														bestLapMs={row.bestLapMs}
													/>
												)}
											</td>
											<td className="hidden pr-4 text-right font-mono @5xl:table-cell">
												{row.speedTrapKph ?? '-'}
											</td>
											<td className="pr-4">
												{row.compound ? (
													<TyreBadge compound={row.compound} age={row.tyreAge} />
												) : null}
											</td>
											<td className="hidden pr-4 text-right font-mono @lg:table-cell">
												{timed ? row.lapsCompleted : row.pitStops}
											</td>
										</motion.tr>
										{ghostHere ? ghost : null}
										{line && view === 'full' ? <CutRow line={line} /> : null}
									</React.Fragment>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</Panel>
	);
}
