import type { TrackOutline } from '@f1-live/shared';
import * as React from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { DataTable, TableKey } from '@/components/console/data-table';
import { Digits } from '@/components/console/digits';
import { EmptyNote } from '@/components/console/empty-note';
import { Field, Panel, PanelHeader } from '@/components/console/panel';
import { ProGate } from '@/components/pro-gate';
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent
} from '@/components/ui/chart';
import { useRaceView } from '@/data/race-context';
import { useSessionTelemetry } from '@/data/telemetry-context';
import {
	conditionsByLap,
	type StraightWind,
	straights,
	temperatureSensitivity,
	windOnStraights
} from '@/insights/conditions';
import { isTimedSession } from '@/insights/qualifying';
import { cn } from '@/lib/utils';

import { useTileFill } from '../dashboard/tile-fill';

/** Below this, pace and temperature hardly moved together, so no rate is printed. */
const MEANINGFUL_CORRELATION = 0.3;

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

function compassPoint(degrees: number): string {
	return COMPASS[Math.round((((degrees % 360) + 360) % 360) / 45) % COMPASS.length] ?? 'N';
}

function windWord(straight: StraightWind): string {
	const along = Math.abs(straight.headwindMs);

	if (along < 0.3) {
		return 'crosswind';
	}

	return `${straight.headwindMs > 0 ? 'head' : 'tail'} ${along.toFixed(1)}`;
}

const chartConfig: ChartConfig = {
	trackTempC: { label: 'Track °C', color: 'var(--foreground)' },
	paceS: { label: 'Field pace s', color: 'var(--muted-foreground)' }
};

/** The outline turned so its long side is level, as screen coordinates. */
function useTurned(outline: TrackOutline) {
	return React.useMemo(() => {
		const angle = (outline.rotationDeg * Math.PI) / 180;

		const turn = (x: number, y: number) =>
			[
				x * Math.cos(angle) - y * Math.sin(angle),
				-(x * Math.sin(angle) + y * Math.cos(angle))
			] as const;

		const points = outline.points.map(([x, y]) => turn(x, y));
		const xs = points.map(([x]) => x);

		return { points, turn, width: Math.max(...xs) - Math.min(...xs) };
	}, [outline]);
}

/** Monospace glyphs are about this wide for their size, to make room for a label. */
const GLYPH_WIDTH = 0.62;

/** A compass-bearing direction as a screen vector on the turned outline. */
function screenVector(
	turn: (x: number, y: number) => readonly [number, number],
	bearingDeg: number
) {
	const radians = (bearingDeg * Math.PI) / 180;

	return turn(Math.sin(radians), Math.cos(radians));
}

/** A small arrow pointing along a screen direction, for the map's legend. */
function LegendArrow({
	direction,
	className
}: {
	direction: readonly [number, number];
	className: string;
}) {
	const angle = (Math.atan2(direction[1], direction[0]) * 180) / Math.PI;

	return (
		<svg viewBox="-6 -6 12 12" className={cn('size-4 shrink-0', className)} aria-hidden>
			<g transform={`rotate(${angle})`}>
				<line x1={-4.5} y1={0} x2={2} y2={0} stroke="currentColor" strokeWidth={1.5} />
				<path d="M1,-3 L5,0 L1,3 z" fill="currentColor" />
			</g>
		</svg>
	);
}

function WindMap({
	outline,
	winds,
	windFromDeg,
	windSpeedMs
}: {
	outline: TrackOutline;
	winds: readonly StraightWind[];
	windFromDeg: number;
	windSpeedMs: number;
}) {
	const { points, turn, width } = useTurned(outline);
	const markerId = React.useId();
	const step = outline.lengthM / outline.points.length;
	const unit = width / 50;
	const fontSize = unit * 2.8;
	const xs = points.map(([x]) => x);
	const ys = points.map(([, y]) => y);

	const centre = {
		x: (Math.min(...xs) + Math.max(...xs)) / 2,
		y: (Math.min(...ys) + Math.max(...ys)) / 2
	};

	const labels = winds.map((straight) => {
		const [midX, midY] = turn(straight.midX, straight.midY);
		const along = screenVector(turn, straight.bearingDeg);
		// The label goes on the side of the straight away from the middle of the circuit.
		const side = along[1] * (midX - centre.x) - along[0] * (midY - centre.y) >= 0 ? 1 : -1;
		const across = [along[1] * side, -along[0] * side] as const;
		const x = midX + across[0] * unit * 3;
		const y = midY + across[1] * unit * 3;
		const text = windWord(straight);
		const textWidth = text.length * GLYPH_WIDTH * fontSize;

		const anchor: 'start' | 'middle' | 'end' =
			Math.abs(across[0]) < 0.5 ? 'middle' : across[0] > 0 ? 'start' : 'end';

		const left = anchor === 'start' ? x : anchor === 'end' ? x - textWidth : x - textWidth / 2;

		return {
			straight,
			midX,
			midY,
			along,
			across,
			x,
			y,
			text,
			anchor,
			left,
			right: left + textWidth
		};
	});

	// The circuit and every label, with a little room around.
	const margin = unit * 2;
	const minX = Math.min(...xs, ...labels.map((label) => label.left)) - margin;
	const maxX = Math.max(...xs, ...labels.map((label) => label.right)) + margin;
	const minY = Math.min(...ys, ...labels.map((label) => label.y - fontSize)) - margin;
	const maxY = Math.max(...ys, ...labels.map((label) => label.y + fontSize)) + margin;

	const stretch = (startM: number, endM: number) => {
		const from = Math.round(startM / step);
		const to = Math.round(endM / step);
		const indexes: number[] = [];

		for (let index = from; index !== to; index = (index + 1) % points.length) {
			indexes.push(index);
		}

		return [...indexes, to].map((index) => points[index] ?? [0, 0]);
	};

	return (
		<figure className="flex flex-col gap-2">
			<svg
				viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
				className="text-foreground h-auto max-h-80 w-full"
			>
				<title>{`The circuit, with the wind from the ${compassPoint(windFromDeg)}`}</title>
				<defs>
					<marker
						id={markerId}
						viewBox="0 0 6 6"
						refX="3"
						refY="3"
						markerWidth="4"
						markerHeight="4"
						orient="auto"
					>
						<path d="M0,0 L6,3 L0,6 z" fill="currentColor" />
					</marker>
				</defs>
				<polyline
					points={points.map(([x, y]) => `${x},${y}`).join(' ')}
					fill="none"
					stroke="currentColor"
					strokeOpacity={0.3}
					strokeWidth={unit * 0.6}
					strokeLinejoin="round"
				/>
				{labels.map(({ straight, midX, midY, along, across, x, y, text, anchor }) => (
					<g key={straight.startM}>
						<polyline
							points={stretch(straight.startM, straight.endM)
								.map(([pointX, pointY]) => `${pointX},${pointY}`)
								.join(' ')}
							fill="none"
							stroke="currentColor"
							strokeWidth={unit * (Math.abs(straight.headwindMs) < 0.3 ? 1 : 1.6)}
							strokeDasharray={straight.headwindMs < 0 ? `${unit * 2} ${unit}` : undefined}
						/>
						<line
							x1={midX - along[0] * unit * 3}
							y1={midY - along[1] * unit * 3}
							x2={midX + along[0] * unit * 3}
							y2={midY + along[1] * unit * 3}
							stroke="currentColor"
							strokeWidth={unit * 0.5}
							markerEnd={`url(#${CSS.escape(markerId)})`}
						/>
						<text
							x={x}
							y={y}
							fontSize={fontSize}
							textAnchor={anchor}
							dominantBaseline={across[1] > 0.5 ? 'hanging' : across[1] < -0.5 ? 'auto' : 'middle'}
							className="fill-foreground font-mono"
						>
							{text}
						</text>
					</g>
				))}
			</svg>
			<figcaption className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
				<span className="flex items-center gap-1.5">
					<LegendArrow direction={screenVector(turn, 0)} className="text-muted-foreground" />
					North
				</span>
				<span className="flex items-center gap-1.5">
					<LegendArrow
						direction={screenVector(turn, windFromDeg + 180)}
						className="text-foreground"
					/>
					Wind, {windSpeedMs.toFixed(1)} m/s from the {compassPoint(windFromDeg)}
				</span>
			</figcaption>
		</figure>
	);
}

/**
 * Weather against the racing: track temperature beside the field's pace lap by lap, and the wind
 * along each straight, head or tail, from the wind direction and the circuit outline.
 */
export function ConditionsPanel() {
	const { snapshot } = useRaceView();
	const telemetry = useSessionTelemetry();
	const fill = useTileFill();
	const [table, setTable] = React.useState(false);
	const rows = React.useMemo(() => conditionsByLap(snapshot), [snapshot]);
	const link = React.useMemo(() => temperatureSensitivity(rows), [rows]);
	const sample = snapshot.weather.at(-1);
	const outline = telemetry.status === 'ready' ? telemetry.value.circuit : null;
	const found = React.useMemo(() => (outline ? straights(outline) : []), [outline]);
	const winds = sample ? windOnStraights(found, sample) : [];
	const timed = isTimedSession(snapshot.session.type);

	return (
		<Panel
			aria-label="Conditions"
			data-testid="conditions"
			className={cn('min-h-0', fill && 'h-full')}
		>
			<PanelHeader title="Conditions" meta={sample && !timed ? `Lap ${sample.lap}` : undefined}>
				<TableKey table={table} onTableChange={setTable} />
			</PanelHeader>
			<div className={cn('flex flex-col gap-4 p-4', fill && 'min-h-0 flex-1 overflow-y-auto')}>
				<ProGate
					feature="Conditions"
					teaser="Which straights run into the wind, and how the field’s pace followed the track temperature."
				>
					{!sample ? (
						<EmptyNote className="px-0">No weather from this feed yet.</EmptyNote>
					) : (
						<>
							<div className="grid gap-6 @4xl:grid-cols-2">
								<section className="flex flex-col gap-2" aria-label="Wind on the straights">
									<dl className="flex flex-wrap gap-x-6 gap-y-2">
										<Field label="Wind">
											{sample.windDirectionDeg === undefined
												? `${sample.windSpeedMs.toFixed(1)} m/s`
												: `${sample.windSpeedMs.toFixed(1)} m/s from the ${compassPoint(sample.windDirectionDeg)}`}
										</Field>
										<Field label="Track">{sample.trackTempC.toFixed(1)}°</Field>
										<Field label="Air">{sample.airTempC.toFixed(1)}°</Field>
									</dl>
									{sample.windDirectionDeg === undefined ? (
										<p className="text-muted-foreground text-sm">
											This feed gives no wind direction.
										</p>
									) : outline === null ? (
										<p className="text-muted-foreground text-sm">
											Wind on each straight needs the circuit outline, which comes with the
											session’s telemetry.
										</p>
									) : table ? (
										<DataTable
											caption="Wind along and across each straight"
											columns={[
												{ key: 'where', label: 'Straight' },
												{ key: 'length', label: 'Length', numeric: true },
												{ key: 'head', label: 'Headwind m/s', numeric: true },
												{ key: 'cross', label: 'Crosswind m/s', numeric: true }
											]}
											rows={winds.map((straight) => ({
												id: String(straight.startM),
												where: `${Math.round(straight.startM)} m, heading ${compassPoint(straight.bearingDeg)}`,
												length: `${Math.round(straight.lengthM)} m`,
												head: straight.headwindMs.toFixed(1),
												cross: straight.crosswindMs.toFixed(1)
											}))}
										/>
									) : (
										<WindMap
											outline={outline}
											winds={winds}
											windFromDeg={sample.windDirectionDeg}
											windSpeedMs={sample.windSpeedMs}
										/>
									)}
								</section>
								{timed ? null : (
									<section
										className="flex flex-col gap-2"
										aria-label="Track temperature against pace"
									>
										<div className="flex flex-wrap items-end gap-x-6 gap-y-2">
											<span className="type-label">Track temperature and the field’s pace</span>
											{link && Math.abs(link.correlation) >= MEANINGFUL_CORRELATION ? (
												<Field label="Pace with each °C">
													<Digits
														value={`${link.secondsPerDegree >= 0 ? '+' : '−'}${Math.abs(link.secondsPerDegree).toFixed(2)} s`}
													/>
													<span className="text-muted-foreground">
														{' '}
														r {link.correlation.toFixed(2)}
													</span>
												</Field>
											) : null}
										</div>
										{table ? (
											<DataTable
												caption="Track temperature and the field's pace on each lap"
												columns={[
													{ key: 'lap', label: 'Lap' },
													{ key: 'track', label: 'Track °C', numeric: true },
													{ key: 'air', label: 'Air °C', numeric: true },
													{ key: 'pace', label: 'Field pace s', numeric: true }
												]}
												rows={rows.map((row) => ({
													id: String(row.lap),
													lap: `L${row.lap}`,
													track: row.trackTempC.toFixed(1),
													air: row.airTempC.toFixed(1),
													pace: row.paceS === null ? null : row.paceS.toFixed(2)
												}))}
											/>
										) : (
											<>
												<ChartContainer
													config={chartConfig}
													className="aspect-auto h-48 w-full @4xl:h-56"
												>
													<LineChart data={rows} margin={{ left: 4, right: 4, top: 8 }}>
														<CartesianGrid vertical={false} />
														<XAxis
															dataKey="lap"
															type="number"
															domain={[1, 'dataMax']}
															tickLine={false}
															axisLine={false}
															tickFormatter={(lap: number) => `L${lap}`}
														/>
														<YAxis
															yAxisId="temp"
															tickLine={false}
															axisLine={false}
															width={36}
															domain={['auto', 'auto']}
															tickFormatter={(value: number) => `${value.toFixed(1)}°`}
														/>
														<YAxis
															yAxisId="pace"
															orientation="right"
															tickLine={false}
															axisLine={false}
															width={44}
															domain={['auto', 'auto']}
															tickFormatter={(value: number) => `${value.toFixed(1)}`}
														/>
														<ChartTooltip
															content={
																<ChartTooltipContent
																	labelFormatter={(lap) => `Lap ${String(lap)}`}
																	valueFormatter={(value) => value.toFixed(1)}
																/>
															}
														/>
														<Line
															yAxisId="temp"
															dataKey="trackTempC"
															type="linear"
															stroke="var(--color-trackTempC)"
															strokeWidth={2}
															dot={false}
															isAnimationActive={false}
														/>
														<Line
															yAxisId="pace"
															dataKey="paceS"
															type="linear"
															stroke="var(--color-paceS)"
															strokeWidth={1.5}
															strokeDasharray="4 3"
															dot={false}
															connectNulls
															isAnimationActive={false}
														/>
													</LineChart>
												</ChartContainer>
												<div className="text-muted-foreground flex flex-wrap gap-x-4 text-xs">
													<span className="flex items-center gap-1.5">
														<span aria-hidden className="bg-foreground h-0.5 w-4" />
														Track temperature, left
													</span>
													<span className="flex items-center gap-1.5">
														<span
															aria-hidden
															className="border-muted-foreground w-4 border-t-2 border-dashed"
														/>
														Field pace, seconds, right
													</span>
												</div>
											</>
										)}
									</section>
								)}
							</div>
							<p className="text-muted-foreground text-xs">
								Straights are where the outline turns less than three degrees per 100 m; arrows show
								the direction of travel, solid straights run into the wind and dashed ones have it
								behind. The pace is the field’s median clean lap as if on an empty tank; it moves
								with the track temperature, but also with grip building up as the race goes on.
							</p>
						</>
					)}
				</ProGate>
			</div>
		</Panel>
	);
}
