import type { Driver } from '@f1-live/shared';
import * as React from 'react';
import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
	LineChart,
	type MouseHandlerDataParam,
	ReferenceArea,
	ReferenceLine,
	XAxis,
	YAxis
} from 'recharts';

import { DataTable, TableKey } from '@/components/console/data-table';
import { EmptyNote } from '@/components/console/empty-note';
import { Panel, PanelHeader } from '@/components/console/panel';
import { KeyGroup } from '@/components/console/keys';
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent
} from '@/components/ui/chart';
import { RaceOnly } from '@/components/race-only';
import { useRaceView } from '@/data/race-context';
import { DriverLink, useJumpTo } from '@/features/drill/drill-parts';
import { usePair } from '@/features/watch/pair-context';
import { isKnockout, isTimedSession } from '@/insights/qualifying';
import { hasDrs } from '@/insights/rules';
import { cn } from '@/lib/utils';

import { useTileFill } from '../dashboard/tile-fill';

import { driverChartConfig, isSecondTeamCar } from './chart-drivers';
import {
	EndLabels,
	type EndMark,
	flagBands,
	MarksLegend,
	type OverMark,
	OverMarks,
	pitDot
} from './chart-marks';
import { useComparedDrivers } from './compare-context';
import { QUALI_NOTE, QualiChart } from './quali-chart';
import {
	battlePoints,
	flagRanges,
	type LapPoint,
	type Metric,
	pitLaps,
	robustRange,
	toPoints,
	versusPoints
} from './lap-series';

export const METRICS = [
	{ value: 'lapTime', label: 'Lap times', short: 'Laps' },
	{ value: 'gap', label: 'Gap', short: 'Gap' },
	{ value: 'position', label: 'Positions', short: 'Pos' },
	{ value: 'battle', label: 'Battle', short: 'Battle' },
	{ value: 'versus', label: 'Versus', short: 'Vs' }
] as const satisfies readonly { value: Metric; label: string; short: string }[];

/**
 * Narrow tiles print the short names, so every key and the Table key fit on a phone; screen
 * readers always hear the full one.
 */
const METRIC_KEYS = METRICS.map((entry) => ({
	value: entry.value,
	label:
		entry.short === entry.label ? (
			entry.label
		) : (
			<>
				<span aria-hidden className="@md:hidden">
					{entry.short}
				</span>
				<span className="sr-only @md:not-sr-only">{entry.label}</span>
			</>
		)
}));

const METRIC_NOTE: Record<Exclude<Metric, 'versus'>, string> = {
	lapTime:
		'Seconds off the quickest car on each lap, green-flag laps only: in-laps, out-laps and VSC laps are left out. Dashed rules are stops; an arrow at the top is a lap too far off the pace to plot.',
	gap: 'The race trace: seconds behind the leader at each line crossing. Squares are stops; a stop that runs off the bottom is cut.',
	position: 'The lap chart: running order at the end of every lap. Squares are stops.',
	battle:
		'Gap to the car directly ahead, named where it changes. The line breaks at a pass and a stop. The band is the one-second DRS window.'
};

const DIMMED_OPACITY = 0.12;

/** The dash of a team's second car: team-mates share a colour. */
const SECOND_CAR_DASH = '5 3';

/** Lap times keep 90% of laps in range: the rest are traffic, a lock-up or a spin. */
const LAP_TIME_SHARE = 0.9;

function formatMetric(metric: Metric, value: number): string {
	if (metric === 'lapTime') {
		return `+${value.toFixed(value < 1 ? 2 : 1)}s`;
	}

	if (metric === 'position') {
		return `P${value}`;
	}

	if (metric === 'versus') {
		return `${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(1)}s`;
	}

	return `+${value.toFixed(1)}s`;
}

/**
 * One chart of the race with a switch between lap times, the race trace, the lap chart, the
 * battle with the car ahead and the gap to one of the compared drivers. Stops and flags are
 * marked on every chart, and each has a table of its numbers. A dashboard tile can fix the
 * starting metric and keep the choice.
 */
export function ChartWorkspace({
	metric: initialMetric = 'lapTime',
	onMetricChange
}: {
	metric?: Metric;
	onMetricChange?: (metric: Metric) => void;
}) {
	const { snapshot, followedDriver } = useRaceView();
	const { compared: drivers, highlighted } = useComparedDrivers();
	const fill = useTileFill();
	const [metric, setLocalMetric] = React.useState<Metric>(initialMetric);
	const [table, setTable] = React.useState(false);

	const setMetric = (next: Metric) => {
		setLocalMetric(next);
		onMetricChange?.(next);
	};

	const panelId = React.useId();
	const jumpTo = useJumpTo();
	const metricLabel = METRICS.find((entry) => entry.value === metric)?.label ?? '';

	// Qualifying reads its own way: push laps on the session clock, and gaps and order by part.
	const qualiMetric =
		isKnockout(snapshot.session.type) &&
		(metric === 'lapTime' || metric === 'gap' || metric === 'position')
			? metric
			: null;

	// A race chart in practice or qualifying shows only the note that it applies to races.
	const raceChartOnClock =
		metric !== 'lapTime' && isTimedSession(snapshot.session.type) && qualiMetric === null;

	const flags = flagRanges(snapshot);
	const stops = pitLaps(snapshot);

	const followed = snapshot.drivers.find((driver) => driver.number === followedDriver);
	// Versus measures every compared car against the followed driver, or the first compared car.
	const reference = drivers.find((driver) => driver.number === followedDriver) ?? drivers[0];
	const opacity = (code: string) => (highlighted && highlighted !== code ? DIMMED_OPACITY : 1);

	// With more than two lines, the followed driver and a duel pair the viewer picked keep their
	// colour and the rest go grey, so the eye lands on the cars that matter.
	const { picked } = usePair();
	const paired = new Set(picked);

	const lead = drivers.filter(
		(driver) => driver.number === followedDriver || paired.has(driver.number)
	);

	const muted = (driver: Driver) =>
		highlighted === null && drivers.length > 2 && lead.length > 0 && !lead.includes(driver);

	const lineColour = (driver: Driver) =>
		muted(driver) ? 'var(--muted-foreground)' : `var(--color-${driver.code})`;

	const config: ChartConfig =
		metric === 'battle' && followed
			? { interval: { label: `${followed.code} gap ahead`, color: `#${followed.teamColour}` } }
			: driverChartConfig(drivers);

	const battle = metric === 'battle' && followed ? battlePoints(snapshot, followed.number) : null;

	const points: LapPoint[] =
		metric === 'battle'
			? (battle?.points ?? [])
			: metric === 'versus'
				? reference
					? versusPoints(snapshot, drivers, reference.number)
					: []
				: toPoints(snapshot, drivers, metric);

	const series =
		metric === 'battle' && followed
			? [{ key: 'interval', label: `${followed.code} gap ahead` }]
			: drivers.map((driver) => ({ key: driver.code, label: driver.code }));

	const lastLap = points.at(-1)?.lap ?? snapshot.currentLap;

	// Every fifth lap and the last one, which is now, unless it would sit on a fifth.
	const lapTicks = [
		1,
		...Array.from({ length: Math.floor((lastLap - 2) / 5) }, (_, index) => (index + 1) * 5),
		...(lastLap > 1 ? [lastLap] : [])
	];

	const range = robustRange(
		points.flatMap((point) =>
			series.flatMap((entry) => {
				const value = point[entry.key];

				return value === undefined ? [] : [value];
			})
		),
		metric === 'lapTime' ? LAP_TIME_SHARE : undefined
	);

	// A lap time past the top of the scale leaves the line, which joins its neighbours, and shows as
	// an arrow at the edge instead.
	const over: OverMark[] = [];

	const plotted =
		metric === 'lapTime'
			? points.map((point) => {
					const kept = { ...point };

					for (const driver of drivers) {
						const value = point[driver.code];

						if (value !== undefined && point.lap !== undefined && value > range.domain[1]) {
							delete kept[driver.code];
							over.push({ code: driver.code, lap: point.lap, fill: lineColour(driver) });
						}
					}

					return kept;
				})
			: points;

	// A race's charts run lap by lap, so a click on one moves the replay to that lap.
	const onChartClick = isTimedSession(snapshot.session.type)
		? undefined
		: (state: MouseHandlerDataParam) => {
				const lap = Number(state.activeLabel);

				if (Number.isInteger(lap) && lap > 0) {
					jumpTo({ lap });
				}
			};

	const axes = (
		<>
			<CartesianGrid vertical={false} />
			<XAxis
				dataKey="lap"
				type="number"
				domain={[1, 'dataMax']}
				tickLine={false}
				axisLine={false}
				tickMargin={8}
				ticks={lapTicks}
				tickFormatter={(lap: number) => `L${lap}`}
			/>
		</>
	);

	const tooltip = (
		<ChartTooltip
			content={
				<ChartTooltipContent
					labelFormatter={(lap) => `Lap ${String(lap)}`}
					valueFormatter={(value) => formatMetric(metric, value)}
				/>
			}
		/>
	);

	const lines = drivers.map((driver) => {
		const grey = muted(driver);
		const colour = lineColour(driver);
		const second = isSecondTeamCar(driver, drivers);

		const shared = {
			dataKey: driver.code,
			stroke: colour,
			strokeOpacity: grey ? 0.5 : opacity(driver.code),
			strokeDasharray: second ? SECOND_CAR_DASH : undefined,
			connectNulls: true,
			isAnimationActive: false
		};

		return metric === 'gap' || metric === 'versus' ? (
			<Area
				key={driver.number}
				{...shared}
				type="linear"
				strokeWidth={grey ? 1.5 : 2}
				fill="none"
				dot={pitDot(stops.get(driver.number), colour)}
			/>
		) : (
			<Line
				key={driver.number}
				{...shared}
				type={metric === 'position' ? 'stepAfter' : 'linear'}
				strokeWidth={highlighted === driver.code ? 3 : grey ? 1.5 : 2}
				dot={
					metric === 'lapTime'
						? second
							? { r: 2, strokeWidth: 1.5, stroke: colour, fill: 'var(--panel)' }
							: { r: 2, strokeWidth: 0, fill: colour }
						: pitDot(stops.get(driver.number), colour)
				}
				activeDot={{ r: 3 }}
			/>
		);
	});

	const endMarks: EndMark[] =
		metric === 'position'
			? []
			: drivers.flatMap((driver) => {
					const last = plotted.findLast((point) => point[driver.code] !== undefined);
					const value = last?.[driver.code];

					return last?.lap === undefined || value === undefined
						? []
						: [
								{
									code: driver.code,
									lap: last.lap,
									// A last point past the axis is clipped; its code stays at the edge.
									value: Math.min(Math.max(value, range.domain[0]), range.domain[1]),
									fill:
										highlighted && highlighted !== driver.code
											? 'var(--muted-foreground)'
											: lineColour(driver),
									dash: isSecondTeamCar(driver, drivers) ? SECOND_CAR_DASH : undefined
								}
							];
				});

	// Lap times leave in-laps out, so their stops are rules across the plot instead of marks.
	const stopRules =
		metric === 'lapTime'
			? drivers.flatMap((driver) =>
					[...(stops.get(driver.number) ?? [])].map((lap) => (
						<ReferenceLine
							key={`${driver.number}-${lap}`}
							x={lap}
							stroke={`var(--color-${driver.code})`}
							strokeOpacity={0.5 * opacity(driver.code)}
							strokeDasharray="2 3"
						/>
					))
				)
			: [];

	const aheadNow = battle?.ahead.at(-1)?.code;

	const title =
		metric === 'battle' && followed
			? `${followed.code} to ${aheadNow ?? 'car'} ahead`
			: metric === 'versus' && reference
				? `Gap to ${reference.code}`
				: 'Trace';

	const note = qualiMetric
		? QUALI_NOTE[qualiMetric]
		: metric === 'versus'
			? `Seconds behind ${reference?.code ?? 'the first car'} at each line crossing; above its line is ahead. Squares are stops.`
			: metric === 'battle' && !hasDrs(snapshot.session)
				? METRIC_NOTE.battle.replace('DRS', 'overtake-mode')
				: METRIC_NOTE[metric];

	// Room on the right for the names at the ends of the lines.
	const margin = { left: 4, right: metric === 'position' ? 12 : 52, top: 18 };

	const legend = (
		<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
			{metric === 'battle'
				? null
				: drivers.map((driver) => (
						<DriverLink key={driver.number} driver={driver} className="flex items-center gap-1.5">
							<span
								aria-hidden
								className={
									isSecondTeamCar(driver, drivers)
										? 'border-team w-4 border-t-2 border-dashed'
										: 'bg-team h-0.5 w-4'
								}
								style={{
									'--team': muted(driver) ? 'var(--muted-foreground)' : `#${driver.teamColour}`
								}}
							/>
							<span className="type-wide font-bold">{driver.code}</span>
						</DriverLink>
					))}
			<MarksLegend
				ranges={qualiMetric ? [] : flags}
				stops={stops.size > 0 && metric !== 'lapTime' && qualiMetric === null}
			/>
		</div>
	);

	return (
		<Panel aria-label="Race charts" className={cn('min-h-0', fill && 'h-full')}>
			<PanelHeader title={title}>
				<KeyGroup
					label="Chart"
					role="tablist"
					options={METRIC_KEYS}
					value={metric}
					onChange={setMetric}
					controls={panelId}
				/>
				<TableKey table={table} onTableChange={setTable} />
			</PanelHeader>
			<div
				id={panelId}
				role="tabpanel"
				aria-label={metricLabel}
				className={cn('flex flex-col gap-3 p-4', fill && 'min-h-0 flex-1')}
				data-testid={`chart-${metric}`}
			>
				<p className={cn('text-muted-foreground text-xs', raceChartOnClock && 'hidden')}>{note}</p>
				{snapshot.laps.length === 0 ? (
					<EmptyNote className="px-0" />
				) : qualiMetric ? (
					<>
						<QualiChart
							metric={qualiMetric}
							drivers={drivers}
							highlighted={highlighted}
							table={table}
							fill={fill}
						/>
						{legend}
					</>
				) : (
					<RaceOnly what={`The ${metricLabel.toLowerCase()} chart`} applies={metric !== 'lapTime'}>
						{table ? (
							<DataTable
								caption={`${title}, lap by lap`}
								className={cn(fill && 'flex-1')}
								columns={[
									{ key: 'lap', label: 'Lap' },
									...series.map((entry) => ({ key: entry.key, label: entry.label, numeric: true }))
								]}
								rows={points.map((point) => ({
									id: String(point.lap),
									lap: `L${point.lap ?? ''}`,
									...Object.fromEntries(
										series.map((entry) => {
											const value = point[entry.key];

											return [entry.key, value === undefined ? null : formatMetric(metric, value)];
										})
									)
								}))}
							/>
						) : (
							<ChartContainer
								config={config}
								className={cn(
									'aspect-auto w-full',
									fill ? 'min-h-40 flex-1' : 'h-80 @4xl:h-136',
									onChartClick && 'cursor-pointer'
								)}
							>
								{metric === 'battle' ? (
									<AreaChart data={points} margin={margin} onClick={onChartClick}>
										{axes}
										{flagBands(flags)}
										<YAxis
											tickLine={false}
											axisLine={false}
											width={44}
											domain={range.domain}
											ticks={range.ticks}
											allowDataOverflow
											tickFormatter={(value: number) => `${value.toFixed(1)}s`}
										/>
										{battle?.ahead.map((entry) => (
											<ReferenceLine
												key={entry.lap}
												x={entry.lap - 0.5}
												stroke="var(--rule-strong)"
												strokeDasharray="2 3"
												label={{
													value: entry.code,
													position: 'insideTopLeft',
													className: 'fill-muted-foreground font-mono text-[10px]'
												}}
											/>
										))}
										<ReferenceArea
											y1={0}
											y2={1}
											fill="var(--foreground)"
											fillOpacity={0.1}
											ifOverflow="hidden"
										/>
										{tooltip}
										<Area
											dataKey="interval"
											type="linear"
											stroke="var(--color-interval)"
											strokeWidth={2}
											fill="none"
											dot={pitDot(
												followed ? stops.get(followed.number) : undefined,
												'var(--color-interval)'
											)}
											isAnimationActive={false}
										/>
									</AreaChart>
								) : metric === 'gap' || metric === 'versus' ? (
									<AreaChart data={points} margin={margin} onClick={onChartClick}>
										{axes}
										{flagBands(flags)}
										<YAxis
											tickLine={false}
											axisLine={false}
											width={48}
											reversed
											domain={range.domain}
											ticks={range.ticks}
											allowDataOverflow
											tickFormatter={(value: number) => formatMetric(metric, value)}
										/>
										{metric === 'versus' ? (
											<ReferenceLine y={0} stroke="var(--rule-strong)" />
										) : null}
										{tooltip}
										{lines}
										<EndLabels marks={endMarks} />
									</AreaChart>
								) : (
									<LineChart data={plotted} margin={margin} onClick={onChartClick}>
										{axes}
										{flagBands(flags)}
										{stopRules}
										<YAxis
											tickLine={false}
											axisLine={false}
											width={metric === 'lapTime' ? 48 : 36}
											reversed={metric === 'position'}
											domain={metric === 'position' ? [1, snapshot.drivers.length] : range.domain}
											ticks={metric === 'position' ? [1, 5, 10, 15, 20] : range.ticks}
											allowDataOverflow={metric === 'lapTime'}
											allowDecimals={metric !== 'position'}
											tickFormatter={(value: number) => formatMetric(metric, value)}
										/>
										{metric === 'lapTime' ? (
											<ReferenceLine y={0} stroke="var(--rule-strong)" />
										) : null}
										{tooltip}
										{lines}
										<OverMarks marks={over} edge={range.domain[1]} />
										<EndLabels marks={endMarks} />
									</LineChart>
								)}
							</ChartContainer>
						)}
						{legend}
					</RaceOnly>
				)}
			</div>
		</Panel>
	);
}
