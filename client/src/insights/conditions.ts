import {
	outlineStepM,
	type RaceSnapshot,
	type TrackOutline,
	type WeatherSample
} from '@f1-live/shared';

import { average, isCleanLap } from './clean-laps.ts';
import { fuelCorrectedLapSeconds } from './tyre-life.ts';

/** Heading is measured over this much track either side of a point. */
const HEADING_SPAN_M = 50;

/** Track turning less than this over the span either side is straight. */
const STRAIGHT_TURN_DEG = 3;

/** A straight run shorter than this is a link between corners, not a straight. */
const MIN_STRAIGHT_M = 300;

export interface Straight {
	startM: number;
	endM: number;
	lengthM: number;
	/** Direction of travel, degrees clockwise from north. */
	bearingDeg: number;
	/** Its middle, for a label: metres in the outline's frame. */
	midX: number;
	midY: number;
}

export interface StraightWind extends Straight {
	/** Wind against the cars, m/s: negative is a tailwind. */
	headwindMs: number;
	/** Wind across the straight, m/s: positive from the left. */
	crosswindMs: number;
}

/**
 * Compass bearing from one point to another. The feed's positions put x east and y north: the
 * 2025 Las Vegas outline runs anticlockwise with the Strip driven south and Koval Lane north,
 * as the circuit is.
 */
function bearing(fromX: number, fromY: number, toX: number, toY: number): number {
	return ((Math.atan2(toX - fromX, toY - fromY) * 180) / Math.PI + 360) % 360;
}

/** The smaller angle between two bearings, signed: positive when `to` is clockwise of `from`. */
function turn(from: number, to: number): number {
	return ((to - from + 540) % 360) - 180;
}

/** The circuit's straights, from where the outline turns less than three degrees per 100 m. */
export function straights(outline: TrackOutline): Straight[] {
	const { points } = outline;
	const step = outlineStepM(outline);
	const span = Math.max(1, Math.round(HEADING_SPAN_M / step));
	const count = points.length;
	const at = (index: number) => points[((index % count) + count) % count] ?? [0, 0];

	const isStraight = points.map((_, index) => {
		const [x0, y0] = at(index - span);
		const [x1, y1] = at(index);
		const [x2, y2] = at(index + span);

		return Math.abs(turn(bearing(x0, y0, x1, y1), bearing(x1, y1, x2, y2))) < STRAIGHT_TURN_DEG;
	});

	// Start from a bend so a straight across the line stays whole.
	const firstBend = isStraight.indexOf(false);

	if (firstBend === -1) {
		return [];
	}

	const runs: { from: number; to: number }[] = [];

	for (let offset = 1; offset <= count; offset++) {
		const index = firstBend + offset;

		if (isStraight[index % count]) {
			const last = runs.at(-1);

			if (last && last.to === index - 1) {
				last.to = index;
			} else {
				runs.push({ from: index, to: index });
			}
		}
	}

	return runs.flatMap(({ from, to }) => {
		const lengthM = (to - from) * step;

		if (lengthM < MIN_STRAIGHT_M) {
			return [];
		}

		const [x0, y0] = at(from);
		const [x1, y1] = at(to);
		const [midX, midY] = at(Math.round((from + to) / 2));

		return [
			{
				startM: (from % count) * step,
				endM: (to % count) * step,
				lengthM,
				bearingDeg: bearing(x0, y0, x1, y1),
				midX,
				midY
			}
		];
	});
}

/**
 * The wind along and across each straight. Wind direction is where it blows from, so wind from
 * straight ahead is all headwind.
 */
export function windOnStraights(
	list: readonly Straight[],
	sample: Pick<WeatherSample, 'windSpeedMs' | 'windDirectionDeg'>
): StraightWind[] {
	const from = sample.windDirectionDeg;

	if (from === undefined) {
		return [];
	}

	return list.map((straight) => {
		const angle = (turn(straight.bearingDeg, from) * Math.PI) / 180;

		return {
			...straight,
			headwindMs: sample.windSpeedMs * Math.cos(angle),
			crosswindMs: -sample.windSpeedMs * Math.sin(angle)
		};
	});
}

export interface ConditionsLap {
	lap: number;
	trackTempC: number;
	airTempC: number;
	/** The field's median clean lap, fuel burn added back, in seconds; null without clean laps. */
	paceS: number | null;
}

function median(values: readonly number[]): number | null {
	const sorted = values.toSorted((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);

	if (sorted.length === 0) {
		return null;
	}

	return sorted.length % 2 === 1
		? (sorted[middle] ?? null)
		: ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** Track and air temperature on each lap, beside the field's pace on it. */
export function conditionsByLap(snapshot: RaceSnapshot): ConditionsLap[] {
	return snapshot.weather.map((sample) => ({
		lap: sample.lap,
		trackTempC: sample.trackTempC,
		airTempC: sample.airTempC,
		paceS: median(
			snapshot.laps.flatMap((lap) =>
				lap.lap === sample.lap && isCleanLap(lap) ? [fuelCorrectedLapSeconds(lap)] : []
			)
		)
	}));
}

export interface TemperatureSensitivity {
	/** Seconds per lap the field's pace moves with each degree of track temperature. */
	secondsPerDegree: number;
	/** How closely pace followed temperature, from -1 to 1. */
	correlation: number;
	laps: number;
}

/** Fewer laps with both readings than this say nothing about the link. */
const MIN_SENSITIVITY_LAPS = 8;

/** A least-squares line through pace against track temperature, over the laps that have both. */
export function temperatureSensitivity(
	rows: readonly ConditionsLap[]
): TemperatureSensitivity | null {
	const pairs = rows.flatMap((row) =>
		row.paceS === null ? [] : [{ x: row.trackTempC, y: row.paceS }]
	);

	if (pairs.length < MIN_SENSITIVITY_LAPS) {
		return null;
	}

	const meanX = average(pairs.map((pair) => pair.x)) ?? 0;
	const meanY = average(pairs.map((pair) => pair.y)) ?? 0;
	let covariance = 0;
	let varianceX = 0;
	let varianceY = 0;

	for (const { x, y } of pairs) {
		covariance += (x - meanX) * (y - meanY);
		varianceX += (x - meanX) ** 2;
		varianceY += (y - meanY) ** 2;
	}

	if (varianceX === 0 || varianceY === 0) {
		return null;
	}

	return {
		secondsPerDegree: covariance / varianceX,
		correlation: covariance / Math.sqrt(varianceX * varianceY),
		laps: pairs.length
	};
}
