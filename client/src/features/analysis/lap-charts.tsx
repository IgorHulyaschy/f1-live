import type { Driver, RaceSnapshot } from '@f1-live/shared';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent
} from '@/components/ui/chart';
import { isCleanLap } from '@/insights/clean-laps';
import { formatLapTime } from '@/lib/format';

import { driverChartConfig, isSecondTeamCar } from './chart-drivers';

/** One row per lap: `lap` plus one value per driver code. */
type LapPoint = Record<string, number>;

type Metric = 'lapTime' | 'gap' | 'position';

function toPoints(snapshot: RaceSnapshot, drivers: readonly Driver[], metric: Metric): LapPoint[] {
	const codes = new Map(drivers.map((driver) => [driver.number, driver.code]));
	const points = new Map<number, LapPoint>();

	for (const lap of snapshot.laps) {
		const code = codes.get(lap.driverNumber);

		if (!code || (metric === 'lapTime' && !isCleanLap(lap))) {
			continue;
		}

		const point = points.get(lap.lap) ?? { lap: lap.lap };

		point[code] =
			metric === 'lapTime'
				? lap.lapTimeMs / 1000
				: metric === 'gap'
					? lap.gapToLeaderMs / 1000
					: lap.position;
		points.set(lap.lap, point);
	}

	return [...points.values()].toSorted((a, b) => (a.lap ?? 0) - (b.lap ?? 0));
}

const METRIC_COPY: Record<Metric, { title: string; description: string }> = {
	lapTime: {
		title: 'Lap times',
		description: 'Green-flag laps only; in-laps, out-laps and VSC laps are left out.'
	},
	gap: { title: 'Gap to leader', description: 'Seconds behind the leader at each line crossing.' },
	position: { title: 'Positions', description: 'Running order at the end of every lap.' }
};

function formatMetric(metric: Metric, value: number): string {
	if (metric === 'lapTime') {
		return formatLapTime(Math.round(value * 1000));
	}

	return metric === 'gap' ? `+${value.toFixed(1)}s` : `P${value}`;
}

export function LapMetricChart({
	snapshot,
	drivers,
	metric
}: {
	snapshot: RaceSnapshot;
	drivers: readonly Driver[];
	metric: Metric;
}) {
	const data = toPoints(snapshot, drivers, metric);
	const config = driverChartConfig(drivers);
	const copy = METRIC_COPY[metric];

	return (
		<Card size="sm" data-testid={`chart-${metric}`}>
			<CardHeader>
				<CardTitle>{copy.title}</CardTitle>
				<CardDescription>{copy.description}</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={config} className="aspect-auto h-72 w-full">
					<LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
						<CartesianGrid vertical={false} />
						<XAxis dataKey="lap" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
						<YAxis
							tickLine={false}
							axisLine={false}
							width={metric === 'lapTime' ? 64 : 40}
							reversed={metric !== 'lapTime'}
							domain={metric === 'position' ? [1, 'dataMax'] : ['auto', 'auto']}
							allowDecimals={metric !== 'position'}
							tickFormatter={(value: number) => formatMetric(metric, value)}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									labelFormatter={(lap) => `Lap ${String(lap)}`}
									valueFormatter={(value) => formatMetric(metric, value)}
								/>
							}
						/>
						<ChartLegend content={<ChartLegendContent />} />
						{drivers.map((driver) => (
							<Line
								key={driver.number}
								dataKey={driver.code}
								type={metric === 'position' ? 'stepAfter' : 'monotone'}
								stroke={`var(--color-${driver.code})`}
								strokeWidth={2}
								strokeDasharray={isSecondTeamCar(driver, drivers) ? '5 3' : undefined}
								dot={false}
								connectNulls
								isAnimationActive={false}
							/>
						))}
					</LineChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
