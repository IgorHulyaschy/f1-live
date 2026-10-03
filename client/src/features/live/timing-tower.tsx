import type { Lap } from '@f1-live/shared';
import { motion } from 'motion/react';
import * as React from 'react';

import { Digits } from '@/components/console/digits';
import { EmptyNote } from '@/components/console/empty-note';
import { KeyGroup } from '@/components/console/keys';
import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { TyreBadge } from '@/components/tyre-badge';
import { useRace } from '@/data/race-context';
import { DriverLink } from '@/features/drill/drill-parts';
import { useDrill } from '@/features/drill/use-drill';
import { useScreenTime } from '@/hooks/use-screen-time';
import { gapToCut, improvements, knockout, recentImprovements } from '@/insights/knockout';
import { pitPenalties, timePenalties } from '@/insights/penalties';
import { predictRejoin } from '@/insights/pit-window';
import { type CutLine, cutLines, isKnockout, isTimedSession } from '@/insights/qualifying';
import { ONE_SECOND_MS, oneSecondAid } from '@/insights/rules';
import { lastTimedPart, OUT_LABEL, type StandingRow } from '@/insights/standings';
import { formatGap, formatLapTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import { formatSignedGap } from './knockout-panel';
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

/** A lap that took a car up the order counts as just now for this long. */
const IMPROVED_MS = 60_000;

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
		return (
			<span className="type-label text-danger font-bold" title={row.outReason ?? undefined}>
				{OUT_LABEL[row.out]}
			</span>
		);
	}

	if (timed) {
		if (row.bestLapMs === null) {
			return <span className="type-label">No time</span>;
		}

		// The first car of a part has no interval within it; its gap to the part's fastest stands in.
		const value = mode === 'leader' ? row.gapToLeaderMs : (row.intervalMs ?? row.gapToLeaderMs);

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

/**
 * A lap time, purple when it is the fastest of the session and green when it is the driver's
 * best. In a best-lap column every time is a best, so only purple is shown there; in qualifying
 * the part it was set in leads it.
 */
function LapTime({
	row,
	lap,
	bestColumn = false,
	fastestMs = null,
	part
}: {
	row: StandingRow;
	lap: Lap | null;
	bestColumn?: boolean;
	/** The session's fastest lap, which a best-lap column marks purple. */
	fastestMs?: number | null;
	part?: string;
}) {
	if (!lap || lap.lapTimeMs <= 0) {
		return <span className="text-muted-foreground">-</span>;
	}

	const isBest = lap.lapTimeMs === row.bestLapMs;

	return (
		<span className="inline-flex items-baseline gap-1.5">
			{part ? <span className="type-label">{part}</span> : null}
			<span
				className={cn(
					'font-mono',
					lap.lapTimeMs === fastestMs && 'text-fastest',
					!bestColumn && isBest && lap.lapTimeMs !== fastestMs && 'text-personal-best'
				)}
			>
				{formatLapTime(lap.lapTimeMs)}
			</span>
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
			<td colSpan={9}>
				<span className="type-label text-foreground">{code} if boxing now</span>
			</td>
		</motion.tr>
	);
}

/** A qualifying knockout line, drawn under the last car that goes through. */
function CutRow({ line }: { line: CutLine }) {
	return (
		<tr aria-hidden data-testid="cut-line" className="h-0">
			<td colSpan={10} className="relative p-0">
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
	const { snapshot, lap, plan, followedDriver, standings } = useRace();
	const { open } = useDrill();
	const shownAt = useScreenTime();
	const knockoutState = knockout(snapshot, standings);
	// In qualifying the gap that matters is to the top of the part.
	const [mode, setMode] = React.useState<GapMode>(knockoutState ? 'leader' : 'interval');
	const [view, setView] = React.useState<View>('full');
	const rows = standings;
	const timed = isTimedSession(snapshot.session.type);
	const knockoutSession = isKnockout(snapshot.session.type);
	const partPrefix = snapshot.session.type === 'sprint_qualifying' ? 'SQ' : 'Q';
	// The modelled replay has no speed traps; the column only shows when the data has them.
	const hasTraps = rows.some((row) => row.speedTrapKph !== null);

	const sessionFastestMs = Math.min(
		...rows.flatMap((row) =>
			timed ? row.partBestsMs.flatMap((time) => time ?? []) : (row.bestLapMs ?? [])
		)
	);

	const before = timed ? new Map<string, number>() : previousPositions(snapshot.laps, lap);
	const penalties = timePenalties(snapshot);
	const pitServes = pitPenalties(snapshot);
	const followedIndex = rows.findIndex((row) => row.driver.number === followedDriver);
	const rejoin = plan === 'pro' && !timed ? predictRejoin(snapshot, followedDriver) : null;
	const lines = cutLines(snapshot, rows.length);
	const aid = oneSecondAid(snapshot);
	// Rows flash only for a change the viewer saw happen, not on the lap the tower opened on.
	const [openedOnLap] = React.useState(lap);
	const flashes = lap !== openedOnLap;
	const trends = recentLaps(snapshot.laps);

	const found = React.useMemo(
		() => (knockoutSession ? improvements(snapshot) : []),
		[knockoutSession, snapshot]
	);

	const improved = recentImprovements(found, shownAt, IMPROVED_MS);
	const dropZone = new Set(knockoutState?.dropZone.map((row) => row.driver.number));
	const cutShown = Boolean(knockoutState && knockoutState.cutAfter !== null);

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
				<EmptyNote />
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
								{cutShown ? (
									<th
										scope="col"
										className="type-label hidden pr-4 text-right font-normal @lg:table-cell"
									>
										To cut
									</th>
								) : null}
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
									className={cn(
										'type-label hidden pr-4 text-right font-normal',
										hasTraps && (timed ? '@3xl:table-cell' : '@5xl:table-cell')
									)}
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

								const inDropZone = dropZone.has(row.driver.number);
								const improvement = improved.get(row.driver.number);
								const cutGap = knockoutState && cutShown ? gapToCut(row, knockoutState) : null;

								const withinOneSecond =
									!timed &&
									aid.enabled !== false &&
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
											data-drop-zone={inDropZone || undefined}
											data-testid={`timing-row-${row.driver.code}`}
											onClick={() => open({ kind: 'driver', driverNumber: row.driver.number })}
											className={cn(
												'hover:bg-accent/70 data-[state=selected]:bg-accent relative h-10 cursor-pointer border-b',
												(row.state === 'out' || knockedOut) && 'text-muted-foreground',
												inDropZone && 'bg-danger/6'
											)}
										>
											<td className="relative pl-4">
												{followed ? (
													<span aria-hidden className="bg-focus absolute inset-y-0 left-0 w-0.75" />
												) : null}
												<span className="flex items-baseline gap-1.5">
													<span
														className={cn(
															'w-5 text-right font-mono text-sm font-bold',
															inDropZone && 'text-danger'
														)}
													>
														{row.out === 'disqualified' ? '-' : row.position}
														{inDropZone ? <span className="sr-only"> in the drop zone</span> : null}
													</span>
													{improvement && (improvement.from ?? Infinity) > improvement.to ? (
														<span
															className={cn(
																'text-xs',
																improvement.fastest ? 'text-fastest' : 'text-personal-best'
															)}
															data-testid="improved"
															title={`Up from ${improvement.from === null ? 'no time' : `P${improvement.from}`} in the last minute`}
														>
															▲<span className="sr-only"> improved in the last minute</span>
														</span>
													) : null}
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
											<td>
												<span className="flex items-center gap-2">
													<DriverLink driver={row.driver}>
														<DriverTag driver={row.driver} showName showNumber />
													</DriverLink>
													{row.state === 'pit' ? <Chip tone="flag">Pit</Chip> : null}
													{penalty && !row.out ? <Chip tone="danger">+{penalty}s</Chip> : null}
													{pitServes.has(row.driver.number) && !row.out ? (
														<Chip
															tone="danger"
															title={
																pitServes.get(row.driver.number) === 'DT'
																	? 'Drive-through to serve'
																	: 'Stop-and-go to serve'
															}
														>
															{pitServes.get(row.driver.number)}
														</Chip>
													) : null}
													{row.outReason ? (
														<span className="text-muted-foreground hidden max-w-56 truncate text-xs @4xl:inline">
															{row.outReason}
														</span>
													) : null}
												</span>
											</td>
											<td className="pr-4 text-right whitespace-nowrap">
												<span className="flex items-center justify-end gap-2">
													{withinOneSecond ? (
														<Chip tone="outline" title={`Within a second: ${aid.name}`}>
															{aid.code}
														</Chip>
													) : null}
													<GapReading row={row} mode={mode} timed={timed} />
												</span>
											</td>
											{cutShown ? (
												<td className="hidden pr-4 text-right whitespace-nowrap @lg:table-cell">
													{cutGap === null ? (
														<span className="text-muted-foreground">-</span>
													) : (
														<Digits value={formatSignedGap(cutGap)} />
													)}
												</td>
											) : null}
											<td
												className={cn(
													'hidden pr-4 text-right',
													timed ? '@lg:table-cell' : '@2xl:table-cell'
												)}
											>
												{timed ? (
													<LapTime
														row={row}
														lap={row.bestLap}
														bestColumn
														fastestMs={sessionFastestMs}
														part={
															knockoutSession && row.bestLap
																? `${partPrefix}${lastTimedPart(row) + 1}`
																: undefined
														}
													/>
												) : (
													<LapTime row={row} lap={row.lastLap} fastestMs={sessionFastestMs} />
												)}
											</td>
											<td className="hidden pr-4 @2xl:table-cell">
												<MiniSectors lap={row.lastLap} marks={row.sectorMarks} timed={timed} />
											</td>
											<td className="hidden pr-4 @4xl:table-cell">
												{timed ? (
													<LapTime row={row} lap={row.lastLap} fastestMs={sessionFastestMs} />
												) : (
													<LapTrend
														laps={trends.get(row.driver.number) ?? []}
														bestLapMs={row.bestLapMs}
													/>
												)}
											</td>
											<td
												className={cn(
													'hidden pr-4 text-right font-mono',
													hasTraps && (timed ? '@3xl:table-cell' : '@5xl:table-cell')
												)}
											>
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
