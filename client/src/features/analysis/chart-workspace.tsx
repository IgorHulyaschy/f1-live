import type { Driver } from '@f1-live/shared';
import * as React from 'react';
import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
	LineChart,
	ReferenceArea,
	ReferenceLine,
	XAxis,
	YAxis
} from 'recharts';

import { Panel, PanelHeader } from '@/components/console/panel';
import { KeyGroup } from '@/components/console/keys';
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent
} from '@/components/ui/chart';
import { useRace } from '@/data/race-context';
import { isCleanLap } from '@/insights/clean-laps';
import { formatLapTime } from '@/lib/format';

import { driverChartConfig, isSecondTeamCar } from './chart-drivers';
import { battlePoints, type Metric, neutralisedRanges, toPoints } from './lap-series';

const METRICS = [
	{ value: 'lapTime', label: 'Lap times' },
	{ value: 'gap', label: 'Gap' },
	{ value: 'position', label: 'Positions' },
	{ value: 'battle', label: 'Battle' }
] as const satisfies readonly { value: Metric; label: string }[];

const METRIC_NOTE: Record<Metric, string> = {
	lapTime:
		'Green-flag laps only. In-laps, out-laps and VSC laps are left out. The purple rule is the fastest lap.',
	gap: 'Seconds behind the leader at each line crossing.',
	position: 'Running order at the end of every lap.',
	battle: 'Gap to the car directly ahead. The band is the one-second DRS window.'
};

const DIMMED_OPACITY = 0.12;

function formatMetric(metric: Metric, value: number): string {
	if (metric === 'lapTime') {
		return formatLapTime(Math.round(value * 1000));
	}

	if (metric === 'position') {
		return `P${value}`;
	}

	return `+${value.toFixed(1)}s`;
}

export function ChartWorkspace({
	drivers,
	highlighted
}: {
	drivers: readonly Driver[];
	highlighted: string | null;
}) {
	const { snapshot, followedDriver } = useRace();
	const [metric, setMetric] = React.useState<Metric>('lapTime');
	const neutralised = neutralisedRanges(snapshot);

	const lapTicks = [
		1,
		...Array.from({ length: Math.floor(snapshot.currentLap / 5) }, (_, index) => (index + 1) * 5)
	];

	const followed = snapshot.drivers.find((driver) => driver.number === followedDriver);
	const opacity = (code: string) => (highlighted && highlighted !== code ? DIMMED_OPACITY : 1);

	const fastestLap = Math.min(
		...snapshot.laps
			.filter((lap) => lap.lap > 1 && isCleanLap(lap))
			.map((lap) => lap.lapTimeMs / 1000)
	);

	const config: ChartConfig =
		metric === 'battle' && followed
			? { interval: { label: `${followed.code} gap ahead`, color: `#${followed.teamColour}` } }
			: driverChartConfig(drivers);

	const shading = neutralised.map((range) => (
		<ReferenceArea
			key={range.from}
			x1={range.from - 0.5}
			x2={range.to + 0.5}
			fill="var(--flag)"
			fillOpacity={0.07}
			ifOverflow="hidden"
		/>
	));

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

	const title = metric === 'battle' && followed ? `${followed.code} to car ahead` : 'Trace';

	return (
		<Panel aria-label="Race charts" className="min-h-0">
			<PanelHeader title={title}>
				<KeyGroup
					label="Chart"
					role="tablist"
					options={METRICS}
					value={metric}
					onChange={setMetric}
				/>
			</PanelHeader>
			<div className="flex flex-col gap-3 p-4" data-testid={`chart-${metric}`}>
				<p className="text-muted-foreground text-xs">{METRIC_NOTE[metric]}</p>
				<ChartContainer config={config} className="aspect-auto h-80 w-full lg:h-136">
					{metric === 'battle' ? (
						<AreaChart
							data={followed ? battlePoints(snapshot, followed.number) : []}
							margin={{ left: 4, right: 12, top: 8 }}
						>
							{axes}
							{shading}
							<YAxis
								tickLine={false}
								axisLine={false}
								width={44}
								domain={[0, 'auto']}
								tickFormatter={(value: number) => `${value.toFixed(1)}s`}
							/>
							<ReferenceArea
								y1={0}
								y2={1}
								fill="var(--foreground)"
								fillOpacity={0.06}
								ifOverflow="hidden"
							/>
							{tooltip}
							<Area
								dataKey="interval"
								type="linear"
								stroke="var(--color-interval)"
								strokeWidth={2}
								fill="var(--color-interval)"
								fillOpacity={0.12}
								isAnimationActive={false}
							/>
						</AreaChart>
					) : metric === 'gap' ? (
						<AreaChart
							data={toPoints(snapshot, drivers, 'gap')}
							margin={{ left: 4, right: 12, top: 8 }}
						>
							{axes}
							{shading}
							<YAxis
								tickLine={false}
								axisLine={false}
								width={48}
								reversed
								tickFormatter={(value: number) => formatMetric('gap', value)}
							/>
							{tooltip}
							{drivers.map((driver) => (
								<Area
									key={driver.number}
									dataKey={driver.code}
									type="linear"
									stroke={`var(--color-${driver.code})`}
									strokeWidth={2}
									strokeOpacity={opacity(driver.code)}
									fill="none"
									strokeDasharray={isSecondTeamCar(driver, drivers) ? '5 3' : undefined}
									connectNulls
									isAnimationActive={false}
								/>
							))}
						</AreaChart>
					) : (
						<LineChart
							data={toPoints(snapshot, drivers, metric)}
							margin={{ left: 4, right: 12, top: 8 }}
						>
							{axes}
							{shading}
							<YAxis
								tickLine={false}
								axisLine={false}
								width={metric === 'lapTime' ? 64 : 36}
								reversed={metric === 'position'}
								domain={metric === 'position' ? [1, snapshot.drivers.length] : ['auto', 'auto']}
								ticks={metric === 'position' ? [1, 5, 10, 15, 20] : undefined}
								allowDecimals={metric !== 'position'}
								tickFormatter={(value: number) => formatMetric(metric, value)}
							/>
							{metric === 'lapTime' && Number.isFinite(fastestLap) ? (
								<ReferenceLine y={fastestLap} stroke="var(--fastest)" strokeDasharray="4 4" />
							) : null}
							{tooltip}
							{drivers.map((driver) => (
								<Line
									key={driver.number}
									dataKey={driver.code}
									type={metric === 'position' ? 'stepAfter' : 'linear'}
									stroke={`var(--color-${driver.code})`}
									strokeWidth={highlighted === driver.code ? 3 : 2}
									strokeOpacity={opacity(driver.code)}
									strokeDasharray={isSecondTeamCar(driver, drivers) ? '5 3' : undefined}
									dot={
										metric === 'lapTime'
											? { r: 1.5, strokeWidth: 0, fill: `var(--color-${driver.code})` }
											: false
									}
									activeDot={{ r: 3 }}
									connectNulls
									isAnimationActive={false}
								/>
							))}
						</LineChart>
					)}
				</ChartContainer>
				{metric === 'battle' ? null : (
					<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
						{drivers.map((driver) => (
							<span key={driver.number} className="flex items-center gap-1.5">
								<span
									aria-hidden
									className={
										isSecondTeamCar(driver, drivers)
											? 'border-team w-4 border-t-2 border-dashed'
											: 'bg-team h-0.5 w-4'
									}
									style={{ '--team': `#${driver.teamColour}` }}
								/>
								<span className="type-wide font-bold">{driver.code}</span>
							</span>
						))}
						{neutralised.length > 0 ? (
							<span className="text-muted-foreground flex items-center gap-1.5">
								<span aria-hidden className="bg-flag/30 h-2.5 w-4" />
								Neutralised laps
							</span>
						) : null}
					</div>
				)}
			</div>
		</Panel>
	);
}
