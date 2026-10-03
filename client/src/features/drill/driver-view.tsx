import type { Driver, RaceSnapshot } from '@f1-live/shared';
import * as React from 'react';
import { CartesianGrid, Line, LineChart, type MouseHandlerDataParam, XAxis, YAxis } from 'recharts';

import { Digits } from '@/components/console/digits';
import { EmptyNote } from '@/components/console/empty-note';
import { KeyGroup } from '@/components/console/keys';
import { Field } from '@/components/console/panel';
import { TRACK_STATUS_LABEL } from '@/components/track-status-badge';
import { TyreBadge, compoundName } from '@/components/tyre-badge';
import { type ChartConfig, ChartContainer } from '@/components/ui/chart';
import { useRace, useRaceView } from '@/data/race-context';
import { stepShowing } from '@/data/session-time';
import { useSessionTelemetry } from '@/data/telemetry-context';
import { LapTraces } from '@/features/analysis/telemetry-panel';
import { type LapChoice, lapChoices } from '@/features/analysis/telemetry-selection';
import {
	bestDriverLap,
	type DriverLap,
	driverLaps,
	qualifyingRuns
} from '@/insights/driver-session';
import { isKnockout, isTimedSession } from '@/insights/qualifying';
import { bestSectors } from '@/insights/sectors';
import { OUT_LABEL, type StandingRow } from '@/insights/standings';
import { formatGap, formatLapTime, formatSectorTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import { ACTIONABLE, MARK_TEXT, Section, useDrillSession, useJumpTo } from './drill-parts';
import { useDrill } from './use-drill';

const SECTORS = [0, 1, 2] as const;

function partLabel(snapshot: RaceSnapshot, part: number): string {
	return `${snapshot.session.type === 'sprint_qualifying' ? 'SQ' : 'Q'}${part}`;
}

/** A lap time in its mark's colour, struck through when the stewards deleted it. */
export function LapTimeText({ entry }: { entry: DriverLap }) {
	if (entry.lap.lapTimeMs <= 0) {
		return <span className="text-muted-foreground">-</span>;
	}

	return (
		<span
			className={cn('font-mono', MARK_TEXT[entry.lapMark], entry.deleted && 'line-through')}
			title={entry.deleted ? 'Deleted by the stewards' : undefined}
		>
			{formatLapTime(entry.lap.lapTimeMs)}
		</span>
	);
}

/** What else happened on a lap: the pit lane, a flag unless shown apart, a ruling or a penalty. */
export function LapNotes({ entry, flag = true }: { entry: DriverLap; flag?: boolean }) {
	const { lap } = entry;

	const notes = [
		lap.pitIn ? { text: 'In', tone: 'flag' } : null,
		lap.pitOut ? { text: 'Out', tone: 'flag' } : null,
		!flag || lap.trackStatus === 'green'
			? null
			: { text: TRACK_STATUS_LABEL[lap.trackStatus], tone: 'flag' },
		entry.deleted ? { text: 'Deleted', tone: 'danger' } : null,
		...entry.penalties.map((penalty) => ({
			text: penalty.seconds ? `+${penalty.seconds}s` : penalty.kind.replace('_', ' '),
			tone: 'danger'
		}))
	].filter((note) => note !== null);

	return (
		<span className="flex flex-wrap gap-1">
			{notes.map((note) => (
				<span
					key={note.text}
					className={cn(
						'type-label px-1 leading-4 font-bold',
						note.tone === 'danger'
							? 'text-danger border-danger border'
							: 'text-flag-ink border-flag border'
					)}
				>
					{note.text}
				</span>
			))}
		</span>
	);
}

function Headline({
	row,
	best,
	timed
}: {
	row: StandingRow | undefined;
	best: DriverLap | null;
	timed: boolean;
}) {
	if (!row) {
		return null;
	}

	const gap =
		row.out !== null
			? OUT_LABEL[row.out]
			: row.gapToLeaderMs === null
				? '-'
				: row.gapToLeaderMs === 0
					? timed
						? 'Fastest'
						: 'Leader'
					: formatGap(row.gapToLeaderMs);

	return (
		<div className="flex flex-wrap gap-y-3 divide-x" data-testid="drill-headline">
			<Field label="Position" className="pr-4">
				<span className="font-mono text-lg font-bold">
					{row.out === 'disqualified' ? '-' : `P${row.position}`}
				</span>
			</Field>
			<Field label={timed ? 'To fastest' : 'Gap'} className="px-4">
				<span className="font-mono">{gap}</span>
			</Field>
			<Field label="Best lap" className="px-4">
				{best ? <LapTimeText entry={best} /> : '-'}
			</Field>
			<Field label="Tyre" className="px-4">
				{row.compound ? <TyreBadge compound={row.compound} age={row.tyreAge} /> : '-'}
			</Field>
			<Field label={timed ? 'Laps' : 'Stops'} className="px-4">
				<span className="font-mono">{timed ? row.lapsCompleted : row.pitStops}</span>
			</Field>
		</div>
	);
}

function Runs({ laps, snapshot }: { laps: readonly DriverLap[]; snapshot: RaceSnapshot }) {
	const { open } = useDrill();
	const runs = qualifyingRuns(laps);

	return (
		<Section title="Runs" meta="Push laps only" testId="drill-runs">
			{runs.length === 0 ? (
				<EmptyNote className="px-0">No push lap yet.</EmptyNote>
			) : (
				<ol className="flex flex-col">
					{runs.map((run) => (
						<li
							key={`${run.part}-${run.number}`}
							className="grid grid-cols-[4.5rem_2.5rem_minmax(0,1fr)] items-center gap-x-3 border-b py-1.5 text-sm"
						>
							<span className="type-label text-foreground">
								{partLabel(snapshot, run.part)} run {run.number}
							</span>
							<TyreBadge compound={run.compound} age={run.tyreAge} />
							<span className="flex flex-wrap gap-x-3 gap-y-1">
								{run.pushLaps.map((entry) => (
									<button
										key={entry.lap.lap}
										type="button"
										onClick={() =>
											open({
												kind: 'lap',
												driverNumber: entry.lap.driverNumber,
												lap: entry.lap.lap,
												vs: null
											})
										}
										aria-label={`Open lap ${entry.lap.lap}`}
										className={cn(ACTIONABLE, '-mx-1 px-1', entry === run.best && 'border-b-2')}
									>
										<LapTimeText entry={entry} />
									</button>
								))}
							</span>
						</li>
					))}
				</ol>
			)}
		</Section>
	);
}

function LapTable({
	laps,
	snapshot,
	driver
}: {
	laps: readonly DriverLap[];
	snapshot: RaceSnapshot;
	driver: Driver;
}) {
	const { open } = useDrill();
	const { lap: step, stepUnit } = useRaceView();
	const timed = isTimedSession(snapshot.session.type);
	const knockoutSession = isKnockout(snapshot.session.type);

	const openLap = (lap: number) =>
		open({ kind: 'lap', driverNumber: driver.number, lap, vs: null });

	if (laps.length === 0) {
		return <EmptyNote className="px-0">No lap completed yet.</EmptyNote>;
	}

	return (
		<div className="max-h-[28rem] overflow-auto" data-testid="drill-laps">
			<table className="w-full text-sm">
				<thead className="bg-background sticky top-0">
					<tr className="h-8 border-b">
						<th scope="col" className="type-label pr-3 text-left font-normal">
							Lap
						</th>
						<th scope="col" className="type-label pr-3 text-right font-normal">
							Time
						</th>
						{SECTORS.map((index) => (
							<th
								key={index}
								scope="col"
								className="type-label hidden pr-3 text-right font-normal @xl:table-cell"
							>
								S{index + 1}
							</th>
						))}
						<th scope="col" className="type-label pr-3 text-left font-normal">
							Tyre
						</th>
						<th scope="col" className="type-label pr-3 text-right font-normal">
							Pos
						</th>
						{timed ? null : (
							<>
								<th
									scope="col"
									className="type-label hidden pr-3 text-right font-normal @lg:table-cell"
								>
									Gap
								</th>
								<th
									scope="col"
									className="type-label hidden pr-3 text-right font-normal @2xl:table-cell"
								>
									Int
								</th>
							</>
						)}
						<th scope="col" className="type-label text-left font-normal">
							<span className="sr-only">Notes</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{laps.map((entry) => {
						const { lap } = entry;
						const current = stepUnit === 'lap' && lap.lap === step;

						return (
							<tr
								key={lap.lap}
								onClick={() => openLap(lap.lap)}
								data-testid={`drill-lap-${lap.lap}`}
								data-state={current ? 'selected' : undefined}
								className={cn(
									'hover:bg-accent/70 data-[state=selected]:bg-accent h-8 cursor-pointer border-b',
									timed && !entry.push && 'text-muted-foreground'
								)}
							>
								<td className="pr-3">
									<button
										type="button"
										onClick={(event) => {
											event.stopPropagation();
											openLap(lap.lap);
										}}
										aria-label={`Open lap ${lap.lap}`}
										className="focus-visible:ring-ring font-mono font-bold focus-visible:ring-2 focus-visible:outline-none"
									>
										{knockoutSession ? (
											<span className="type-label mr-1.5">{partLabel(snapshot, entry.part)}</span>
										) : null}
										{lap.lap}
									</button>
								</td>
								<td className="pr-3 text-right">
									<LapTimeText entry={entry} />
								</td>
								{SECTORS.map((index) => (
									<td
										key={index}
										className={cn(
											'hidden pr-3 text-right font-mono @xl:table-cell',
											MARK_TEXT[entry.sectorMarks[index]]
										)}
									>
										{lap.sectorTimesMs[index] > 0
											? formatSectorTime(lap.sectorTimesMs[index])
											: '-'}
									</td>
								))}
								<td className="pr-3">
									<TyreBadge compound={lap.compound} age={lap.tyreAge} />
								</td>
								<td className="pr-3 text-right font-mono">
									{lap.position > 0 ? lap.position : '-'}
								</td>
								{timed ? null : (
									<>
										<td className="hidden pr-3 text-right @lg:table-cell">
											{lap.position === 1 ? (
												<span className="type-label">Leader</span>
											) : (
												<Digits value={formatGap(lap.gapToLeaderMs)} />
											)}
										</td>
										<td className="hidden pr-3 text-right @2xl:table-cell">
											{lap.position === 1 ? '-' : <Digits value={formatGap(lap.intervalMs)} />}
										</td>
									</>
								)}
								<td>
									<LapNotes entry={entry} />
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

function Stints({ snapshot, driverNumber }: { snapshot: RaceSnapshot; driverNumber: string }) {
	const jumpTo = useJumpTo();
	const stints = snapshot.stints.filter((stint) => stint.driverNumber === driverNumber);

	const total = Math.max(
		snapshot.session.totalLaps,
		snapshot.currentLap,
		...stints.map((stint) => stint.endLap),
		1
	);

	if (stints.length === 0) {
		return null;
	}

	return (
		<Section title="Stints" meta={`${stints.length}`} testId="drill-stints">
			<ol className="flex flex-col">
				{stints.map((stint) => {
					const laps = stint.endLap - stint.startLap + 1;

					const lapAt = snapshot.laps.find(
						(lap) => lap.driverNumber === driverNumber && lap.lap === stint.startLap
					);

					return (
						<li key={stint.stint} className="border-b">
							<button
								type="button"
								onClick={() => jumpTo({ lap: stint.startLap, at: lapAt?.completedAt })}
								aria-label={`Stint ${stint.stint}, ${compoundName(stint.compound)}, laps ${stint.startLap} to ${stint.endLap}: go to its first lap`}
								className={cn(
									ACTIONABLE,
									'grid w-full grid-cols-[2.5rem_minmax(0,1fr)_7rem] items-center gap-3 py-1.5 text-left'
								)}
							>
								<TyreBadge compound={stint.compound} age={stint.tyreAgeAtStart || undefined} />
								<span className="relative h-2">
									<span
										aria-hidden
										className="bg-foreground/60 absolute inset-y-0 left-(--offset) w-(--size)"
										style={{
											'--offset': `${((stint.startLap - 1) / total) * 100}%`,
											'--size': `${(laps / total) * 100}%`
										}}
									/>
								</span>
								<span className="text-right font-mono text-xs">
									L{stint.startLap}–{stint.endLap} · {laps}
								</span>
							</button>
						</li>
					);
				})}
			</ol>
		</Section>
	);
}

const POSITION_CONFIG: ChartConfig = { position: { label: 'Position', color: 'var(--focus)' } };

function PositionChart({ laps, cars }: { laps: readonly DriverLap[]; cars: number }) {
	const jumpTo = useJumpTo();

	const points = laps
		.filter((entry) => entry.lap.position > 0)
		.map((entry) => ({ lap: entry.lap.lap, position: entry.lap.position }));

	if (points.length < 2) {
		return null;
	}

	return (
		<Section title="Position" meta="Click a lap to go there" testId="drill-positions">
			<ChartContainer config={POSITION_CONFIG} className="aspect-auto h-40 w-full cursor-pointer">
				<LineChart
					data={points}
					margin={{ left: 0, right: 8, top: 8 }}
					onClick={(state: MouseHandlerDataParam) => {
						const lap = Number(state.activeLabel);

						if (Number.isInteger(lap)) {
							jumpTo({ lap });
						}
					}}
				>
					<CartesianGrid vertical={false} />
					<XAxis dataKey="lap" tickLine={false} axisLine={false} interval="preserveStartEnd" />
					<YAxis
						reversed
						width={28}
						tickLine={false}
						axisLine={false}
						domain={[1, cars]}
						ticks={[1, 5, 10, 15, 20].filter((tick) => tick <= cars)}
					/>
					<Line
						dataKey="position"
						type="stepAfter"
						stroke="var(--color-position)"
						strokeWidth={2}
						dot={false}
						activeDot={{ r: 3 }}
						isAnimationActive={false}
					/>
				</LineChart>
			</ChartContainer>
		</Section>
	);
}

function SectorsAndTraps({
	snapshot,
	driverNumber
}: {
	snapshot: RaceSnapshot;
	driverNumber: string;
}) {
	const sectors = React.useMemo(() => bestSectors(snapshot), [snapshot]);
	const ideal = sectors.ideal.find((entry) => entry.driver.number === driverNumber);

	const speeds = snapshot.personalBests?.find(
		(best) => best.driverNumber === driverNumber
	)?.topSpeedsKph;

	const traps = speeds
		? [
				{ label: 'Inter 1', value: speeds.intermediate1 },
				{ label: 'Inter 2', value: speeds.intermediate2 },
				{ label: 'Finish', value: speeds.finishLine },
				{ label: 'Trap', value: speeds.speedTrap }
			].filter((trap) => trap.value !== null)
		: [];

	if (!ideal && traps.length === 0) {
		return null;
	}

	return (
		<Section
			title="Best sectors"
			meta={traps.length > 0 ? 'and speed traps, km/h' : undefined}
			testId="drill-sectors"
		>
			<div className="flex flex-wrap gap-y-3 divide-x">
				{ideal
					? SECTORS.map((index) => (
							<Field key={index} label={`S${index + 1}`} className="pr-4 not-first:pl-4">
								<span
									className={cn(
										'font-mono',
										sectors.fastest[index]?.timeMs === ideal.sectorsMs[index] && 'text-fastest'
									)}
								>
									{formatSectorTime(ideal.sectorsMs[index])}
								</span>
							</Field>
						))
					: null}
				{ideal ? (
					<Field label="Ideal lap" className="px-4">
						<span className="font-mono">{formatLapTime(ideal.idealMs)}</span>
						{ideal.bestMs !== null && ideal.bestMs > ideal.idealMs ? (
							<span className="text-muted-foreground ml-2 font-mono text-xs">
								{formatGap(ideal.bestMs - ideal.idealMs)} left
							</span>
						) : null}
					</Field>
				) : null}
				{traps.map((trap) => (
					<Field key={trap.label} label={trap.label} className="px-4">
						<span className="font-mono">{trap.value}</span>
					</Field>
				))}
			</div>
		</Section>
	);
}

type Reference = 'fastest' | 'teammate';

/** The driver's best lap traced against pole (or the session's fastest) or their teammate's best. */
function BestLapTelemetry({ snapshot, driver }: { snapshot: RaceSnapshot; driver: Driver }) {
	const telemetry = useSessionTelemetry();
	const [reference, setReference] = React.useState<Reference>('fastest');
	const knockoutSession = isKnockout(snapshot.session.type);

	const chosen = React.useMemo((): LapChoice[] => {
		if (telemetry.status !== 'ready') {
			return [];
		}

		const { index, circuit } = telemetry.value;

		const bestOf = (driverNumber: string) =>
			lapChoices(snapshot, index.laps, driverNumber, circuit.lengthM).find(
				(choice) => choice.fastest
			);

		const own = bestOf(driver.number);

		if (!own) {
			return [];
		}

		const others = snapshot.drivers.filter(
			(entry) =>
				entry.number !== driver.number && (reference === 'fastest' || entry.team === driver.team)
		);

		const rival = others
			.flatMap((entry) => bestOf(entry.number) ?? [])
			.toSorted((a, b) => a.lap.lapTimeMs - b.lap.lapTimeMs)[0];

		return rival ? [own, rival] : [own];
	}, [telemetry, snapshot, driver, reference]);

	if (telemetry.status !== 'ready') {
		return null;
	}

	const fastestLabel = knockoutSession ? 'Pole' : 'Fastest';

	return (
		<Section
			title="Best lap telemetry"
			meta={chosen.length > 1 ? 'A is theirs' : undefined}
			actions={
				<KeyGroup<Reference>
					label="Compare the best lap with"
					options={[
						{ value: 'fastest', label: fastestLabel },
						{ value: 'teammate', label: 'Teammate' }
					]}
					value={reference}
					onChange={setReference}
				/>
			}
			testId="drill-telemetry"
		>
			{chosen.length === 0 ? (
				<EmptyNote className="px-0">No lap of theirs has telemetry by this point.</EmptyNote>
			) : (
				<div className="flex flex-col gap-3">
					<LapTraces chosen={chosen} session={telemetry.value} table={false} />
				</div>
			)}
		</Section>
	);
}

type Mention = { key: string; lap: number; at?: string; kind: string; text: string };

function Mentions({ snapshot, driverNumber }: { snapshot: RaceSnapshot; driverNumber: string }) {
	const jumpTo = useJumpTo();
	const { timeline } = useRaceView();

	const mentions: Mention[] = [
		...snapshot.raceControl
			.filter((message) => message.driverNumber === driverNumber)
			.map((message, index) => ({
				key: `rc${index}`,
				lap: message.lap,
				at: message.at,
				kind: message.category === 'penalty' ? 'Penalty' : 'Race control',
				text: message.message
			})),
		...(snapshot.teamRadio ?? [])
			.filter((clip) => clip.driverNumber === driverNumber)
			.map((clip, index) => ({
				key: `tr${index}`,
				lap: clip.lap,
				at: clip.at,
				kind: 'Radio',
				text: 'Team radio'
			}))
	].toSorted((a, b) => (a.at && b.at ? a.at.localeCompare(b.at) : a.lap - b.lap));

	if (mentions.length === 0) {
		return null;
	}

	return (
		<Section title="Race control and radio" meta="Click to go there" testId="drill-mentions">
			<ol className="flex flex-col">
				{mentions.map((mention) => (
					<li key={mention.key} className="border-b">
						<button
							type="button"
							onClick={() => jumpTo(mention)}
							className={cn(
								ACTIONABLE,
								'grid w-full grid-cols-[3.5rem_6rem_minmax(0,1fr)] gap-3 py-1.5 text-left text-sm'
							)}
						>
							<span className="type-label">
								{timeline?.unit === 'minute'
									? `Min ${stepShowing(timeline, mention) ?? '-'}`
									: `L${mention.lap}`}
							</span>
							<span className="type-label">{mention.kind}</span>
							<span className="min-w-0">{mention.text}</span>
						</button>
					</li>
				))}
			</ol>
		</Section>
	);
}

/** One driver's session: the headline, every lap, runs, stints, sectors, telemetry and messages. */
export function DriverView({ driverNumber }: { driverNumber: string }) {
	const snapshot = useDrillSession();
	const { standings } = useRace();
	const driver = snapshot.drivers.find((entry) => entry.number === driverNumber);
	const laps = React.useMemo(() => driverLaps(snapshot, driverNumber), [snapshot, driverNumber]);
	const timed = isTimedSession(snapshot.session.type);
	const row = standings.find((entry) => entry.driver.number === driverNumber);

	if (!driver) {
		return <EmptyNote className="p-4">This car is not in this session.</EmptyNote>;
	}

	return (
		<div className="flex flex-col gap-6 p-4" data-testid="driver-view">
			<Headline row={row} best={bestDriverLap(laps)} timed={timed} />
			{isKnockout(snapshot.session.type) ? <Runs laps={laps} snapshot={snapshot} /> : null}
			<Section title="Laps" meta="Click a lap to open it">
				<LapTable laps={laps} snapshot={snapshot} driver={driver} />
			</Section>
			<Stints snapshot={snapshot} driverNumber={driverNumber} />
			{timed ? null : <PositionChart laps={laps} cars={snapshot.drivers.length} />}
			<SectorsAndTraps snapshot={snapshot} driverNumber={driverNumber} />
			<BestLapTelemetry snapshot={snapshot} driver={driver} />
			<Mentions snapshot={snapshot} driverNumber={driverNumber} />
		</div>
	);
}
