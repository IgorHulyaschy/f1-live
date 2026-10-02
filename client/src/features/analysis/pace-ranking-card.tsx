import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';

import { ProGate } from '@/components/pro-gate';
import { compoundName } from '@/components/tyre-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useRace } from '@/data/race-context';
import { tyreCorrectedPace } from '@/insights/tyre-pace';

import { driverChartConfig } from './chart-drivers';

const SHOWN_DRIVERS = 10;

export function PaceRankingCard() {
	const { snapshot } = useRace();
	const ranking = tyreCorrectedPace(snapshot).slice(0, SHOWN_DRIVERS);

	const data = ranking.map((entry) => ({
		code: entry.driver.code,
		delta: Number(entry.deltaToBestSeconds.toFixed(3)),
		compound: compoundName(entry.compound),
		colour: `#${entry.driver.teamColour}`
	}));

	const config = driverChartConfig(ranking.map((entry) => entry.driver));

	return (
		<Card size="sm" data-testid="pace-ranking">
			<CardHeader>
				<CardTitle>Who is really fastest</CardTitle>
				<CardDescription>
					Recent pace with fuel load and tyre age removed, on equal tyres. Seconds per lap slower
					than the quickest car.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ProGate feature="Tyre-corrected pace">
					{data.length === 0 ? (
						<p className="text-muted-foreground px-2 text-sm">
							Not enough green-flag laps on the current tyres yet.
						</p>
					) : (
						<ChartContainer config={config} className="aspect-auto h-72 w-full">
							<BarChart data={data} layout="vertical" margin={{ left: 4, right: 16 }}>
								<CartesianGrid horizontal={false} />
								<XAxis
									type="number"
									tickLine={false}
									axisLine={false}
									tickFormatter={(value: number) => `+${value.toFixed(1)}s`}
								/>
								<YAxis
									type="category"
									dataKey="code"
									tickLine={false}
									axisLine={false}
									width={44}
								/>
								<ChartTooltip
									cursor={false}
									content={
										<ChartTooltipContent
											hideIndicator
											valueFormatter={(value) => `+${value.toFixed(3)}s per lap`}
										/>
									}
								/>
								<Bar dataKey="delta" name="Off the pace" radius={4} isAnimationActive={false}>
									{data.map((entry) => (
										<Cell key={entry.code} fill={entry.colour} />
									))}
								</Bar>
							</BarChart>
						</ChartContainer>
					)}
				</ProGate>
			</CardContent>
		</Card>
	);
}
