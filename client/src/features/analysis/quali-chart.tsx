import type { Driver } from '@f1-live/shared';
import {
	CartesianGrid,
	Line,
	LineChart,
	ReferenceArea,
	ReferenceLine,
	XAxis,
	YAxis
} from 'recharts';

import { DataTable } from '@/components/console/data-table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useRaceView } from '@/data/race-context';
import { formatLapTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import { driverChartConfig, isSecondTeamCar } from './chart-drivers';
import { bestKey, partSpans, qualiLapPoints, qualiPartPoints } from './quali-series';

/** The charts that mean something in qualifying. */
export type QualiMetric = 'lapTime' | 'gap' | 'position';

export const QUALI_NOTE: Record<QualiMetric, string> = {
	lapTime:
		'Push laps only, by session time: out-laps, in-laps and cool-downs are left out. Each line steps down at the driver’s improvements within a part; the purple rule is pole.',
	gap: 'Each driver’s best lap in each part, behind that part’s fastest.',
	position: 'The order within each part, by each driver’s best lap in it.'
};

const DIMMED_OPACITY = 0.12;

function partLabel(part: number): string {
	return `Q${part}`;
}

function formatValue(metric: QualiMetric, value: number): string {
	if (metric === 'lapTime') {
		return formatLapTime(Math.round(value * 1000));
	}

	return metric === 'position' ? `P${value}` : `+${value.toFixed(3)}`;
}

/**
 * Qualifying as the charts should read it: push laps on the session clock with Q1, Q2 and Q3
 * marked and each driver's improvements, or each part's gaps to the fastest and its order.
 */
export function QualiChart({
	metric,
	drivers,
	highlighted,
	table,
	fill
}: {
	metric: QualiMetric;
	drivers: readonly Driver[];
	highlighted: string | null;
	table: boolean;
	fill: boolean;
}) {
	const { snapshot } = useRaceView();
	const opacity = (code: string) => (highlighted && highlighted !== code ? DIMMED_OPACITY : 1);
	const config = driverChartConfig(drivers);
	const byPart = qualiPartPoints(snapshot, drivers, metric);
	const margin = { left: 4, right: 12, top: 18 };

	if (table) {
		return (
			<DataTable
				caption={`${metric === 'lapTime' ? 'Best lap' : metric === 'gap' ? 'Gap to the fastest' : 'Place'} in each part`}
				className={cn(fill && 'flex-1')}
				columns={[
					{ key: 'part', label: 'Part' },
					...drivers.map((driver) => ({ key: driver.code, label: driver.code, numeric: true }))
				]}
				rows={qualiPartPoints(snapshot, drivers, metric).map((point) => ({
					id: String(point.part),
					part: partLabel(point.part ?? 1),
					...Object.fromEntries(
						drivers.map((driver) => {
							const value = point[driver.code];

							return [driver.code, value === undefined ? null : formatValue(metric, value)];
						})
					)
				}))}
			/>
		);
	}

	const chartClass = cn('aspect-auto w-full', fill ? 'min-h-40 flex-1' : 'h-80 @4xl:h-136');

	if (metric !== 'lapTime') {
		return (
			<ChartContainer config={config} className={chartClass} data-testid="quali-chart">
				<LineChart data={byPart} margin={margin}>
					<CartesianGrid vertical={false} />
					<XAxis
						dataKey="part"
						type="number"
						domain={[0.8, 3.2]}
						ticks={byPart.map((point) => point.part ?? 1)}
						tickLine={false}
						axisLine={false}
						tickMargin={8}
						tickFormatter={partLabel}
					/>
					<YAxis
						tickLine={false}
						axisLine={false}
						width={metric === 'gap' ? 56 : 36}
						reversed
						domain={metric === 'position' ? [1, snapshot.drivers.length] : [0, 'auto']}
						ticks={metric === 'position' ? [1, 5, 10, 15, 20] : undefined}
						allowDecimals={metric !== 'position'}
						tickFormatter={(value: number) => formatValue(metric, value)}
					/>
					<ChartTooltip
						content={
							<ChartTooltipContent
								labelFormatter={(part) => partLabel(Number(part))}
								valueFormatter={(value) => formatValue(metric, value)}
							/>
						}
					/>
					{drivers.map((driver) => (
						<Line
							key={driver.number}
							dataKey={driver.code}
							type="linear"
							stroke={`var(--color-${driver.code})`}
							strokeOpacity={opacity(driver.code)}
							strokeWidth={highlighted === driver.code ? 3 : 2}
							strokeDasharray={isSecondTeamCar(driver, drivers) ? '5 3' : undefined}
							dot={{ r: 3, strokeWidth: 0, fill: `var(--color-${driver.code})` }}
							connectNulls={false}
							isAnimationActive={false}
						/>
					))}
				</LineChart>
			</ChartContainer>
		);
	}

	const points = qualiLapPoints(snapshot, drivers);
	const spans = partSpans(snapshot);
	const times = points.flatMap((point) => drivers.flatMap((driver) => point[driver.code] ?? []));
	const pole = Math.min(...times);

	return (
		<ChartContainer config={config} className={chartClass} data-testid="quali-chart">
			<LineChart data={points} margin={margin}>
				<CartesianGrid vertical={false} />
				{spans.map((span) => (
					<ReferenceArea
						key={span.part}
						x1={span.from}
						x2={span.to}
						fill="var(--foreground)"
						fillOpacity={span.part % 2 === 0 ? 0.06 : 0.02}
						label={{
							value: partLabel(span.part),
							position: 'insideTopLeft',
							fill: 'var(--muted-foreground)',
							fontSize: 11
						}}
						ifOverflow="hidden"
					/>
				))}
				<XAxis
					dataKey="t"
					type="number"
					domain={[0, 'dataMax']}
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					tickFormatter={(minutes: number) => `${Math.round(minutes)}m`}
				/>
				<YAxis
					tickLine={false}
					axisLine={false}
					width={64}
					domain={['auto', 'auto']}
					tickFormatter={(value: number) => formatValue('lapTime', value)}
				/>
				{Number.isFinite(pole) ? (
					<ReferenceLine y={pole} stroke="var(--fastest)" strokeDasharray="4 4" />
				) : null}
				<ChartTooltip
					content={
						<ChartTooltipContent
							labelFormatter={(minutes) => `${Number(minutes).toFixed(1)} min`}
							valueFormatter={(value) => formatValue('lapTime', value)}
						/>
					}
				/>
				{drivers.flatMap((driver) => [
					<Line
						key={`${driver.number}-laps`}
						dataKey={driver.code}
						stroke="none"
						dot={{
							r: 2.5,
							strokeWidth: 0,
							fill: `var(--color-${driver.code})`,
							fillOpacity: opacity(driver.code)
						}}
						activeDot={{ r: 3.5 }}
						isAnimationActive={false}
					/>,
					...spans.map((span) => (
						<Line
							key={`${driver.number}-Q${span.part}`}
							dataKey={bestKey(driver.code, span.part)}
							type="stepAfter"
							stroke={`var(--color-${driver.code})`}
							strokeOpacity={opacity(driver.code)}
							strokeWidth={highlighted === driver.code ? 3 : 2}
							strokeDasharray={isSecondTeamCar(driver, drivers) ? '5 3' : undefined}
							dot={false}
							activeDot={false}
							connectNulls
							legendType="none"
							tooltipType="none"
							isAnimationActive={false}
						/>
					))
				])}
			</LineChart>
		</ChartContainer>
	);
}
