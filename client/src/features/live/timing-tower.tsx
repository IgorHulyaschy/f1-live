import type { Lap } from '@f1-live/shared';
import { motion } from 'motion/react';
import * as React from 'react';

import { Digits } from '@/components/console/digits';
import { KeyGroup } from '@/components/console/keys';
import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { TyreBadge } from '@/components/tyre-badge';
import { useRace } from '@/data/race-context';
import { timePenalties } from '@/insights/penalties';
import { predictRejoin } from '@/insights/pit-window';
import { type StandingRow, standingsAt } from '@/insights/standings';
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

const DRS_WINDOW_MS = 1000;

const FLASH = {
	gain: ['rgba(74, 222, 128, 0.2)', 'rgba(74, 222, 128, 0)'],
	loss: ['rgba(248, 113, 113, 0.2)', 'rgba(248, 113, 113, 0)']
} as const;

function previousPositions(laps: readonly Lap[], lap: number): Map<string, number> {
	return new Map(
		laps.flatMap((entry) =>
			entry.lap === lap - 1 ? [[entry.driverNumber, entry.position] as const] : []
		)
	);
}

function Chip({
	children,
	tone
}: {
	children: React.ReactNode;
	tone: 'flag' | 'danger' | 'outline';
}) {
	return (
		<span
			className={cn(
				'type-label px-1 leading-4 font-bold',
				tone === 'flag' && 'bg-flag text-background',
				tone === 'danger' && 'bg-danger text-background',
				tone === 'outline' && 'text-foreground border'
			)}
		>
			{children}
		</span>
	);
}

function GapReading({ row, mode }: { row: StandingRow; mode: GapMode }) {
	if (row.state === 'out') {
		return <span className="type-label">Out</span>;
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

function LastLap({ row }: { row: StandingRow }) {
	if (!row.lastLap) {
		return <span className="text-muted-foreground">-</span>;
	}

	const isBest = row.lastLap.lap > 1 && row.lastLap.lapTimeMs === row.bestLapMs;

	return (
		<span
			className={cn(
				'font-mono',
				isBest && row.hasFastestLap && 'text-fastest',
				isBest && !row.hasFastestLap && 'text-personal-best'
			)}
		>
			{formatLapTime(row.lastLap.lapTimeMs)}
		</span>
	);
}

function GhostRow({ code, position }: { code: string; position: number }) {
	return (
		<motion.tr
			layout="position"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="border-focus h-9 border-y border-dashed"
			data-testid="ghost-row"
		>
			<td className="pl-4 font-mono text-sm font-bold">{position}</td>
			<td colSpan={7}>
				<span className="type-label text-foreground">{code} if boxing now</span>
			</td>
		</motion.tr>
	);
}

export function TimingTower() {
	const { snapshot, lap, plan, followedDriver, setFollowedDriver } = useRace();
	const [mode, setMode] = React.useState<GapMode>('interval');
	const [view, setView] = React.useState<View>('full');
	const rows = standingsAt(snapshot);
	const before = previousPositions(snapshot.laps, lap);
	const penalties = timePenalties(snapshot);
	const followedIndex = rows.findIndex((row) => row.driver.number === followedDriver);
	const rejoin = plan === 'pro' ? predictRejoin(snapshot, followedDriver) : null;
	const trends = recentLaps(snapshot.laps);

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

	return (
		<Panel aria-label="Timing">
			<PanelHeader
				title="Timing"
				meta={`${rows.filter((row) => row.state !== 'out').length} running`}
			>
				<KeyGroup label="Rows shown" options={VIEW_OPTIONS} value={view} onChange={setView} />
				<KeyGroup label="Gap shown" options={GAP_OPTIONS} value={mode} onChange={setMode} />
			</PanelHeader>
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
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
								className="type-label hidden pr-4 text-right font-normal md:table-cell"
							>
								Last lap
							</th>
							<th
								scope="col"
								className="type-label hidden w-28 pr-4 text-right font-normal md:table-cell xl:w-56"
							>
								S1 S2 S3
							</th>
							<th
								scope="col"
								className="type-label hidden pr-4 text-left font-normal xl:table-cell"
							>
								Last {TREND_LAPS}
							</th>
							<th scope="col" className="type-label pr-4 text-left font-normal">
								Tyre
							</th>
							<th
								scope="col"
								className="type-label hidden pr-4 text-right font-normal sm:table-cell"
							>
								Stops
							</th>
						</tr>
					</thead>
					<tbody>
						{rejoin && ghostAfter === null ? ghost : null}
						{visible.map((row, index) => {
							const followed = row.driver.number === followedDriver;
							const previous = before.get(row.driver.number);

							const moved =
								previous === undefined || row.state === 'out' ? 0 : previous - row.position;

							const penalty = penalties.get(row.driver.number);

							const inDrs =
								mode === 'interval' &&
								row.intervalMs !== null &&
								row.intervalMs < DRS_WINDOW_MS &&
								row.position > 1 &&
								row.state === 'running';

							const ghostHere =
								ghostAfter !== null &&
								(row.driver.number === ghostAfter || (!ghostShown && index === visible.length - 1));

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
											row.state === 'out' && 'text-muted-foreground'
										)}
									>
										<td className="relative pl-4">
											{followed ? (
												<span aria-hidden className="bg-focus absolute inset-y-0 left-0 w-0.75" />
											) : null}
											<span className="flex items-baseline gap-1.5">
												<span className="w-5 text-right font-mono text-sm font-bold">
													{row.position}
												</span>
												{row.state === 'out' || !row.positionsGained ? null : (
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
										<td>
											<span className="flex items-center gap-2">
												<DriverTag driver={row.driver} showName showNumber />
												{row.state === 'pit' ? <Chip tone="flag">Pit</Chip> : null}
												{penalty ? <Chip tone="danger">+{penalty}s</Chip> : null}
											</span>
										</td>
										<td className="pr-4 text-right">
											<span className="flex items-center justify-end gap-2">
												{inDrs ? <Chip tone="outline">DRS</Chip> : null}
												<GapReading row={row} mode={mode} />
											</span>
										</td>
										<td className="hidden pr-4 text-right md:table-cell">
											<LastLap row={row} />
										</td>
										<td className="hidden pr-4 md:table-cell">
											<MiniSectors lap={row.lastLap} marks={row.sectorMarks} />
										</td>
										<td className="hidden pr-4 xl:table-cell">
											<LapTrend
												laps={trends.get(row.driver.number) ?? []}
												bestLapMs={row.bestLapMs}
											/>
										</td>
										<td className="pr-4">
											{row.compound ? (
												<TyreBadge compound={row.compound} age={row.tyreAge} />
											) : null}
										</td>
										<td className="hidden pr-4 text-right font-mono sm:table-cell">
											{row.pitStops}
										</td>
									</motion.tr>
									{ghostHere ? ghost : null}
								</React.Fragment>
							);
						})}
					</tbody>
				</table>
			</div>
		</Panel>
	);
}
