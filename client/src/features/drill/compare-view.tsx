import type { Driver } from '@f1-live/shared';
import * as React from 'react';

import { Digits } from '@/components/console/digits';
import { EmptyNote } from '@/components/console/empty-note';
import { Field } from '@/components/console/panel';
import { TeamStripe } from '@/components/driver-tag';
import { TyreBadge } from '@/components/tyre-badge';
import { useRace } from '@/data/race-context';
import { useSessionTelemetry } from '@/data/telemetry-context';
import { LapTraces } from '@/features/analysis/telemetry-panel';
import { lapChoices } from '@/features/analysis/telemetry-selection';
import { bestDriverLap, type DriverLap, driverLaps } from '@/insights/driver-session';
import { isTimedSession } from '@/insights/qualifying';
import { bestSectors } from '@/insights/sectors';
import { OUT_LABEL } from '@/insights/standings';
import { formatLapTime, formatSectorTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import { Section, useDrillSession } from './drill-parts';
import { LapTimeText } from './driver-view';
import { useDrill } from './use-drill';

const SECTORS = [0, 1, 2] as const;

/** "+0.123" when `b` is slower than `a`, "−0.123" when quicker. */
function delta(a: number, b: number): string {
	const ms = b - a;

	return `${ms >= 0 ? '+' : '−'}${(Math.abs(ms) / 1000).toFixed(3)}`;
}

function Side({ driver, laps }: { driver: Driver; laps: readonly DriverLap[] }) {
	const { standings } = useRace();
	const row = standings.find((entry) => entry.driver.number === driver.number);
	const best = bestDriverLap(laps);

	return (
		<div
			className="flex min-w-0 flex-col gap-2 border-l-2 pl-3"
			style={{ '--team': `#${driver.teamColour}` }}
		>
			<span className="flex items-center gap-2">
				<TeamStripe driver={driver} />
				<span className="type-wide text-sm font-black">{driver.code}</span>
				<span className="text-muted-foreground truncate text-xs">{driver.team}</span>
			</span>
			<div className="grid grid-cols-2 gap-2">
				<Field label="Position">
					{row ? (row.out ? OUT_LABEL[row.out] : `P${row.position}`) : '-'}
				</Field>
				<Field label="Best lap">{best ? <LapTimeText entry={best} /> : '-'}</Field>
				<Field label="Tyre">
					{row?.compound ? <TyreBadge compound={row.compound} age={row.tyreAge} /> : '-'}
				</Field>
				<Field label="Stops">{row ? row.pitStops : '-'}</Field>
			</div>
		</div>
	);
}

/** Two drivers side by side: where they stand, lap against lap, sector against sector. */
export function CompareView({ a, b }: { a: string; b: string }) {
	const snapshot = useDrillSession();
	const { open } = useDrill();
	const telemetry = useSessionTelemetry();
	const first = snapshot.drivers.find((driver) => driver.number === a);
	const second = snapshot.drivers.find((driver) => driver.number === b);
	const lapsA = React.useMemo(() => driverLaps(snapshot, a), [snapshot, a]);
	const lapsB = React.useMemo(() => driverLaps(snapshot, b), [snapshot, b]);
	const sectors = React.useMemo(() => bestSectors(snapshot), [snapshot]);

	if (!first || !second) {
		return <EmptyNote className="p-4">One of these cars is not in this session.</EmptyNote>;
	}

	const idealA = sectors.ideal.find((entry) => entry.driver.number === a);
	const idealB = sectors.ideal.find((entry) => entry.driver.number === b);
	const byLap = new Map(lapsB.map((entry) => [entry.lap.lap, entry]));
	const timed = isTimedSession(snapshot.session.type);

	const bestOf = (driverNumber: string) =>
		telemetry.status === 'ready'
			? lapChoices(
					snapshot,
					telemetry.value.index.laps,
					driverNumber,
					telemetry.value.circuit.lengthM
				).find((choice) => choice.fastest)
			: undefined;

	const traced = [bestOf(a), bestOf(b)].flatMap((choice) => choice ?? []);

	return (
		<div className="flex flex-col gap-6 p-4" data-testid="compare-view">
			<div className="grid grid-cols-2 gap-4">
				<Side driver={first} laps={lapsA} />
				<Side driver={second} laps={lapsB} />
			</div>
			{idealA && idealB ? (
				<Section title="Best sectors" meta={`${second.code} against ${first.code}`}>
					<div className="flex flex-wrap gap-y-3 divide-x">
						{SECTORS.map((index) => (
							<Field key={index} label={`S${index + 1}`} className="pr-4 not-first:pl-4">
								<span className="font-mono">{formatSectorTime(idealB.sectorsMs[index])}</span>
								<Digits
									className="ml-2 text-xs"
									value={delta(idealA.sectorsMs[index], idealB.sectorsMs[index])}
								/>
							</Field>
						))}
						<Field label="Ideal lap" className="px-4">
							<span className="font-mono">{formatLapTime(idealB.idealMs)}</span>
							<Digits className="ml-2 text-xs" value={delta(idealA.idealMs, idealB.idealMs)} />
						</Field>
					</div>
				</Section>
			) : null}
			<Section title="Lap by lap" meta="Click a lap to trace both">
				<div className="max-h-[24rem] overflow-auto">
					<table className="w-full text-sm" data-testid="compare-laps">
						<thead className="bg-background sticky top-0">
							<tr className="h-8 border-b">
								<th scope="col" className="type-label pr-3 text-left font-normal">
									Lap
								</th>
								<th scope="col" className="type-label pr-3 text-right font-normal">
									{first.code}
								</th>
								<th scope="col" className="type-label pr-3 text-right font-normal">
									{second.code}
								</th>
								<th scope="col" className="type-label pr-3 text-right font-normal">
									Δ
								</th>
								{timed ? null : (
									<th scope="col" className="type-label text-right font-normal">
										Pos
									</th>
								)}
							</tr>
						</thead>
						<tbody>
							{lapsA.map((entry) => {
								const other = byLap.get(entry.lap.lap);
								const both = other && entry.lap.lapTimeMs > 0 && other.lap.lapTimeMs > 0;

								return (
									<tr
										key={entry.lap.lap}
										onClick={() =>
											open({
												kind: 'lap',
												driverNumber: a,
												lap: entry.lap.lap,
												vs: { driverNumber: b, lap: entry.lap.lap }
											})
										}
										className="hover:bg-accent/70 h-8 cursor-pointer border-b"
									>
										<td className="pr-3 font-mono font-bold">{entry.lap.lap}</td>
										<td className="pr-3 text-right">
											<LapTimeText entry={entry} />
										</td>
										<td className="pr-3 text-right">
											{other ? <LapTimeText entry={other} /> : '-'}
										</td>
										<td className={cn('pr-3 text-right', !both && 'text-muted-foreground')}>
											{both ? (
												<Digits value={delta(entry.lap.lapTimeMs, other.lap.lapTimeMs)} />
											) : (
												'-'
											)}
										</td>
										{timed ? null : (
											<td className="text-right font-mono">
												{entry.lap.position}–{other?.lap.position ?? '-'}
											</td>
										)}
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</Section>
			{telemetry.status === 'ready' && traced.length === 2 ? (
				<Section title="Best laps traced" meta={`A is ${first.code}`}>
					<div className="flex flex-col gap-3">
						<LapTraces chosen={traced} session={telemetry.value} table={false} />
					</div>
				</Section>
			) : null}
		</div>
	);
}
