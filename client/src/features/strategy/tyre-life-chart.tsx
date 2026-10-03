import type { TyreCompound } from '@f1-live/shared';
import * as React from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';

import { DataTable } from '@/components/console/data-table';
import { Digits } from '@/components/console/digits';
import { Field } from '@/components/console/panel';
import { compoundName, TyreBadge } from '@/components/tyre-badge';
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent
} from '@/components/ui/chart';
import { useRaceView } from '@/data/race-context';
import { isKnockout } from '@/insights/qualifying';
import { type CompoundLife, lossAt, tyreLife } from '@/insights/tyre-life';
import { formatDeltaSeconds } from '@/lib/format';
import { cn } from '@/lib/utils';

import { useTileFill } from '../dashboard/tile-fill';

const COMPOUND_COLOUR: Record<TyreCompound, string> = {
	SOFT: 'var(--tyre-soft)',
	MEDIUM: 'var(--tyre-medium)',
	HARD: 'var(--tyre-hard)',
	INTERMEDIATE: 'var(--tyre-intermediate)',
	WET: 'var(--tyre-wet)',
	UNKNOWN: 'var(--muted-foreground)'
};

type AgeRow = { age: number } & Partial<Record<string, number>>;

/**
 * Measured points and the fitted line, one row per tyre age, for the compounds whose pace when
 * new compares; a compound nobody ran with another has its wear only.
 */
function ageRows(compounds: readonly CompoundLife[]): AgeRow[] {
	const last = Math.max(0, ...compounds.flatMap((life) => life.points.map((point) => point.age)));

	return Array.from({ length: last }, (_, index) => {
		const age = index + 1;
		const row: AgeRow = { age };

		for (const life of compounds) {
			const point = life.points.find((entry) => entry.age === age);

			if (life.newOffsetS === null) {
				continue;
			}

			if (point) {
				row[life.compound] = point.deltaS;
			}

			if (age <= (life.points.at(-1)?.age ?? 0)) {
				row[`fit${life.compound}`] = life.newOffsetS + lossAt(life, age);
			}
		}

		return row;
	});
}

/**
 * Tyre life per compound: the measured loss at each tyre age with fuel taken out, the fitted
 * wear and any cliff, and the age at which a new set of a compound slower when new is already
 * the quicker tyre.
 */
export function TyreLifeChart({ table }: { table: boolean }) {
	const { snapshot } = useRaceView();
	const fill = useTileFill();
	const life = React.useMemo(() => tyreLife(snapshot), [snapshot]);
	const rows = React.useMemo(() => ageRows(life.compounds), [life]);
	// A compound whose pace when new is not compared keeps its numbers above, off the chart.
	const drawn = life.compounds.filter((entry) => entry.newOffsetS !== null);

	if (isKnockout(snapshot.session.type)) {
		return (
			<p className="text-muted-foreground text-sm" data-testid="tyre-life-applies">
				Tyre life applies to races and to long runs in practice; qualifying runs are a lap or two.
			</p>
		);
	}

	if (life.compounds.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				Curves show once a compound has three runs of five clean laps.
			</p>
		);
	}

	const config: ChartConfig = Object.fromEntries(
		drawn.flatMap((entry) => [
			[
				entry.compound,
				{ label: compoundName(entry.compound), color: COMPOUND_COLOUR[entry.compound] }
			],
			[
				`fit${entry.compound}`,
				{ label: `${compoundName(entry.compound)} fit`, color: COMPOUND_COLOUR[entry.compound] }
			]
		])
	);

	return (
		<div className={cn('flex flex-col gap-3', fill && 'min-h-0 flex-1')} data-testid="tyre-life">
			<div className="flex flex-wrap gap-x-6 gap-y-2">
				{life.compounds.map((entry) => (
					<div key={entry.compound} className="flex items-end gap-3">
						<TyreBadge compound={entry.compound} />
						<Field label="Per lap">
							<Digits value={formatDeltaSeconds(entry.wearSecondsPerLap, 3)} />
						</Field>
						{life.comparable ? (
							<Field label="When new">
								{entry.newOffsetS === null ? (
									'Not compared'
								) : (
									<Digits value={formatDeltaSeconds(entry.newOffsetS, 2)} />
								)}
							</Field>
						) : null}
						<Field label="Cliff">{entry.cliff ? `Lap ${entry.cliff.age}` : 'None'}</Field>
					</div>
				))}
			</div>
			{life.crossovers.length > 0 ? (
				<ul className="flex flex-col gap-1 text-sm" data-testid="tyre-crossovers">
					{life.crossovers.map((crossover) => (
						<li key={`${crossover.from}-${crossover.to}`}>
							A new {compoundName(crossover.to).toLowerCase()} is quicker than a{' '}
							{compoundName(crossover.from).toLowerCase()} from lap {crossover.age} of its life.
						</li>
					))}
				</ul>
			) : null}
			{table ? (
				<DataTable
					caption="Lap time against the quickest new set, by tyre age"
					className={cn(fill && 'flex-1')}
					columns={[
						{ key: 'age', label: 'Tyre age' },
						...drawn.map((entry) => ({
							key: entry.compound,
							label: compoundName(entry.compound),
							numeric: true
						}))
					]}
					rows={rows.map((row) => ({
						id: String(row.age),
						age: `${row.age}`,
						...Object.fromEntries(
							drawn.map((entry) => {
								const value = row[entry.compound];

								return [entry.compound, value === undefined ? null : formatDeltaSeconds(value, 2)];
							})
						)
					}))}
				/>
			) : (
				<ChartContainer
					config={config}
					className={cn('aspect-auto w-full', fill ? 'min-h-40 flex-1' : 'h-72')}
				>
					<LineChart data={rows} margin={{ left: 4, right: 12, top: 18 }}>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="age"
							type="number"
							domain={[1, 'dataMax']}
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							tickFormatter={(age: number) => `${age}`}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							width={48}
							domain={['auto', 'auto']}
							tickFormatter={(value: number) => formatDeltaSeconds(value, 1)}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									labelFormatter={(age) => `Lap ${String(age)} of the tyre’s life`}
									valueFormatter={(value) => formatDeltaSeconds(value, 2)}
								/>
							}
						/>
						{drawn.map((entry) =>
							entry.cliff ? (
								<ReferenceLine
									key={`cliff-${entry.compound}`}
									x={entry.cliff.age}
									stroke="var(--rule-strong)"
									strokeDasharray="6 2"
									label={{
										value: `${compoundName(entry.compound)} cliff`,
										position: 'top',
										className: 'fill-muted-foreground text-[10px]'
									}}
								/>
							) : null
						)}
						{life.crossovers.map((crossover) => (
							<ReferenceLine
								key={`cross-${crossover.from}-${crossover.to}`}
								x={crossover.age}
								stroke="var(--rule-strong)"
								strokeDasharray="2 4"
								label={{
									value: `New ${compoundName(crossover.to).toLowerCase()} quicker`,
									position: 'top',
									className: 'fill-muted-foreground text-[10px]'
								}}
							/>
						))}
						{drawn.map((entry) => (
							<Line
								key={`fit-${entry.compound}`}
								dataKey={`fit${entry.compound}`}
								type="linear"
								stroke={`var(--color-fit${entry.compound})`}
								strokeWidth={1}
								strokeDasharray="4 3"
								dot={false}
								activeDot={false}
								isAnimationActive={false}
							/>
						))}
						{drawn.map((entry) => (
							<Line
								key={entry.compound}
								dataKey={entry.compound}
								type="linear"
								stroke={`var(--color-${entry.compound})`}
								strokeWidth={1.5}
								strokeOpacity={0.6}
								dot={{
									r: 2.5,
									strokeWidth: 1.5,
									stroke: `var(--color-${entry.compound})`,
									fill:
										entry.compound === 'HARD' ? 'var(--panel)' : `var(--color-${entry.compound})`
								}}
								connectNulls
								isAnimationActive={false}
							/>
						))}
					</LineChart>
				</ChartContainer>
			)}
			<p className="text-muted-foreground text-xs">
				Each point is the median lap at that tyre age over every run of five or more clean laps,
				with the fuel effect taken out and each run’s own pace too; dashed, the fitted wear.
				{life.comparable
					? ' Compounds compare through the drivers who ran both.'
					: ' Practice runs start on their own fuel loads, so only the wear compares.'}
			</p>
		</div>
	);
}
