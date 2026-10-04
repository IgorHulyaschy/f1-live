import type { Driver } from '@f1-live/shared';
import * as React from 'react';

import { EmptyNote } from '@/components/console/empty-note';
import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverPortrait } from '@/components/driver-media';
import { RaceOnly } from '@/components/race-only';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select';
import { useRace } from '@/data/race-context';
import { FIGHT_GAP_SECONDS } from '@/insights/battle';
import { pausingFlag } from '@/insights/clean-laps';
import { type Duel, duel, duelVerdict, type DuelLap } from '@/insights/duel';
import { hasDrs } from '@/insights/rules';
import { useElementSize } from '@/hooks/use-element-size';
import { useRemPixels } from '@/hooks/use-scale';

import { usePair } from './pair-context';

/** Lap gains past this are clipped at the edge: an in-lap or a spin would flatten every other bar. */
const MAX_GAIN_SECONDS = 1.5;

/** Gaps past this are clipped too: a stop would flatten the fight. */
const MAX_GAP_SECONDS = 12;

const LAP_TICK_EVERY = 5;

/** The chart shows this many laps up to now: the duel as it stands, with bars wide enough to read. */
const WINDOW_LAPS = 20;

function clamp(value: number, low: number, high: number): number {
	return Math.min(Math.max(value, low), high);
}

function DriverPicker({
	label,
	value,
	other,
	onChange
}: {
	label: string;
	value: string;
	other: string;
	onChange: (driverNumber: string) => void;
}) {
	const { standings } = useRace();

	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger size="sm" aria-label={label}>
				<SelectValue placeholder="Pick a driver" />
			</SelectTrigger>
			<SelectContent>
				{standings.map((row) => (
					<SelectItem
						key={row.driver.number}
						value={row.driver.number}
						disabled={row.driver.number === other}
					>
						P{row.position} {row.driver.code}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

/** The second car of a team draws hollow, as teammates share a colour. */
function sameTeam(first: Driver, second: Driver): boolean {
	return first.team === second.team;
}

/**
 * Two charts on one lap axis: who was quicker on each lap, as bars toward that driver in their
 * colour, and the gap between them at the line, with the one-second window shaded. Pit laps and
 * laps under a flag are marked rather than drawn, so they never read as pace.
 */
function DuelChart({ pair }: { pair: Duel }) {
	const box = React.useRef<HTMLDivElement>(null);
	const { width, height } = useElementSize(box);
	const rem = useRemPixels();
	const { first, second } = pair;
	const lastLap = pair.laps.at(-1)?.lap ?? 1;
	const laps = pair.laps.filter((lap) => lap.lap > lastLap - WINDOW_LAPS);
	const font = 0.75 * rem;
	const left = 3.5 * rem;
	const right = 4 * rem;
	const plot = Math.max(width - left - right, 0);
	const firstLap = laps[0]?.lap ?? 1;
	const span = Math.max(lastLap - firstLap + 1, 1);
	const step = plot / span;
	const x = (lap: number) => left + (lap - firstLap + 0.5) * step;
	const barsTop = font * 1.5;
	const barsHeight = Math.max((height - 3 * font) * 0.5, 0);
	const middle = barsTop + barsHeight / 2;
	const gapTop = barsTop + barsHeight + font * 1.5;
	const gapBottom = height - font * 1.5;
	const gaps = laps.flatMap((lap) => (lap.gapSeconds === null ? [] : [lap.gapSeconds]));
	const gapLow = clamp(Math.min(0, ...gaps), -MAX_GAP_SECONDS, 0);
	const gapHigh = clamp(Math.max(FIGHT_GAP_SECONDS * 2, ...gaps), 0, MAX_GAP_SECONDS);

	const gapY = (seconds: number) =>
		gapTop +
		((clamp(seconds, gapLow, gapHigh) - gapLow) / (gapHigh - gapLow)) * (gapBottom - gapTop);

	const gainY = (seconds: number) =>
		(clamp(seconds, -MAX_GAIN_SECONDS, MAX_GAIN_SECONDS) / MAX_GAIN_SECONDS) * (barsHeight / 2);

	const hollow = sameTeam(first.driver, second.driver);
	const last = laps.findLast((lap) => lap.gapSeconds !== null);

	const path = laps
		.flatMap((lap, index) =>
			lap.gapSeconds === null
				? []
				: [
						`${index === 0 || laps[index - 1]?.gapSeconds === null ? 'M' : 'L'}${x(lap.lap)},${gapY(lap.gapSeconds)}`
					]
		)
		.join(' ');

	const ticks = laps.filter((lap) => lap.lap % LAP_TICK_EVERY === 0 || lap.lap === lastLap);

	const mark = (lap: DuelLap) =>
		lap.mark === 'neutral' ? (
			<rect
				key={`band-${lap.lap}`}
				x={x(lap.lap) - step / 2}
				y={barsTop}
				width={step}
				height={gapBottom - barsTop}
				fill="var(--flag)"
				fillOpacity={0.1}
			/>
		) : lap.mark === 'pit' ? (
			<text
				key={`pit-${lap.lap}`}
				x={x(lap.lap)}
				y={middle + font / 3}
				fontSize={font}
				textAnchor="middle"
				className="fill-muted-foreground font-mono"
			>
				P
			</text>
		) : null;

	return (
		<figure ref={box} className="relative min-h-40 flex-1" data-testid="duel-chart">
			{width > 0 && height > 0 ? (
				<svg width={width} height={height} aria-hidden className="absolute inset-0">
					{laps.map((lap) => mark(lap))}
					<text x={0} y={barsTop - font * 0.4} fontSize={font} className="fill-muted-foreground">
						Quicker on the lap
					</text>
					<text
						x={left - 4}
						y={barsTop + font}
						fontSize={font}
						textAnchor="end"
						className="fill-foreground font-bold"
					>
						{second.driver.code}
					</text>
					<text
						x={left - 4}
						y={barsTop + barsHeight}
						fontSize={font}
						textAnchor="end"
						className="fill-foreground font-bold"
					>
						{first.driver.code}
					</text>
					<line x1={left} x2={left + plot} y1={middle} y2={middle} stroke="var(--rule-strong)" />
					{laps.map((lap) => {
						if (lap.gainSeconds === null || lap.gainSeconds === 0) {
							return null;
						}

						const toSecond = lap.gainSeconds > 0;
						const size = Math.abs(gainY(lap.gainSeconds));
						const colour = `#${(toSecond ? second : first).driver.teamColour}`;
						const outline = hollow && toSecond;

						return (
							<rect
								key={lap.lap}
								x={x(lap.lap) - step * 0.4}
								y={toSecond ? middle - size : middle}
								width={step * 0.8}
								height={size}
								fill={outline ? 'none' : colour}
								stroke={outline ? colour : 'none'}
								strokeWidth={outline ? 1.5 : 0}
							/>
						);
					})}
					<text x={left} y={gapTop - font * 0.4} fontSize={font} className="fill-muted-foreground">
						{second.driver.code} behind {first.driver.code}
					</text>
					<rect
						x={left}
						y={gapY(Math.max(gapLow, 0))}
						width={plot}
						height={Math.max(gapY(FIGHT_GAP_SECONDS) - gapY(Math.max(gapLow, 0)), 0)}
						fill="var(--foreground)"
						fillOpacity={0.06}
					/>
					<line x1={left} x2={left + plot} y1={gapY(0)} y2={gapY(0)} stroke="var(--rule-strong)" />
					<text
						x={left - 4}
						y={gapY(0) + font / 3}
						fontSize={font}
						textAnchor="end"
						className="fill-muted-foreground font-mono"
					>
						0
					</text>
					<text
						x={left - 4}
						y={gapY(gapHigh) + font / 3}
						fontSize={font}
						textAnchor="end"
						className="fill-muted-foreground font-mono"
					>
						{gapHigh.toFixed(0)} s
					</text>
					<path d={path} fill="none" stroke={`#${second.driver.teamColour}`} strokeWidth={2} />
					{last && last.gapSeconds !== null ? (
						<text
							x={x(last.lap) + 6}
							y={gapY(last.gapSeconds) + font / 3}
							fontSize={font * 1.1}
							className="fill-foreground font-mono font-bold"
						>
							{last.gapSeconds >= 0 ? '+' : '−'}
							{Math.abs(last.gapSeconds).toFixed(1)} s
						</text>
					) : null}
					{ticks.map((lap) => (
						<text
							key={lap.lap}
							x={x(lap.lap)}
							y={height - 2}
							fontSize={font}
							textAnchor="middle"
							className="fill-muted-foreground font-mono"
						>
							L{lap.lap}
						</text>
					))}
				</svg>
			) : null}
		</figure>
	);
}

/**
 * Any two drivers at a glance: one line on who is faster and when the gap closes, then lap by lap
 * who was quicker and how the gap moved. The pair comes from a fight row, two tower rows or the
 * pickers here, and stays the same in every window.
 */
export function DuelTile() {
	const { snapshot, standings } = useRace();
	const { pair, setPair } = usePair();
	const flag = pausingFlag(snapshot);

	const shown = React.useMemo(
		() => (pair ? duel(snapshot, pair[0], pair[1], standings) : null),
		[snapshot, standings, pair]
	);

	const lapsLeft = snapshot.session.totalLaps - snapshot.currentLap;

	const verdict = shown
		? duelVerdict(shown, lapsLeft, hasDrs(snapshot.session) ? 'DRS' : 'overtake', flag)
		: null;

	return (
		<Panel aria-label="Duel" data-testid="duel" className="h-full min-h-0">
			<PanelHeader title="Duel">
				{pair ? (
					<>
						<DriverPicker
							label="First driver"
							value={pair[0]}
							other={pair[1]}
							onChange={(number) => setPair([number, pair[1]])}
						/>
						<span className="type-label">vs</span>
						<DriverPicker
							label="Second driver"
							value={pair[1]}
							other={pair[0]}
							onChange={(number) => setPair([pair[0], number])}
						/>
					</>
				) : null}
			</PanelHeader>
			<RaceOnly what="The duel">
				{shown === null ? (
					<EmptyNote />
				) : (
					<div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
						<div className="flex items-center gap-3">
							<DriverPortrait driver={shown.first.driver} size="sm" />
							<p
								className="min-w-0 flex-1 text-base font-medium"
								data-testid="duel-verdict"
								aria-live="polite"
							>
								{verdict?.text ??
									(flag ? `Pace is paused under the ${flag}.` : 'No gap between them yet.')}
							</p>
							<DriverPortrait driver={shown.second.driver} size="sm" mirrored />
						</div>
						<DuelChart pair={shown} />
						<p className="text-muted-foreground text-xs">
							The last {WINDOW_LAPS} laps. Bars point to the driver quicker on that lap. P marks a
							stop; shaded laps were under a flag. Pick two rows in Timing with Shift, or a fight,
							to change the pair.
						</p>
					</div>
				)}
			</RaceOnly>
		</Panel>
	);
}
