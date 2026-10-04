import { TRACK_STATUSES, type Driver, type RaceSnapshot, type TrackStatus } from '@f1-live/shared';

import { isCleanLap } from '../../insights/clean-laps.ts';

/** One row per lap: `lap` plus one value per driver code. */
export type LapPoint = Record<string, number>;

export type Metric = 'lapTime' | 'gap' | 'position' | 'battle' | 'versus';

/** The quickest clean lap anyone drove on each lap, in ms, so lap times read as seconds off it. */
function quickestByLap(snapshot: RaceSnapshot): Map<number, number> {
	const quickest = new Map<number, number>();

	for (const lap of snapshot.laps) {
		if (isCleanLap(lap)) {
			quickest.set(lap.lap, Math.min(quickest.get(lap.lap) ?? Infinity, lap.lapTimeMs));
		}
	}

	return quickest;
}

/**
 * One value per driver per lap. Lap times are seconds off the quickest car on that lap, clean laps
 * only: the fuel and tyre slope every car shares drops out and the differences between them stay.
 */
export function toPoints(
	snapshot: RaceSnapshot,
	drivers: readonly Driver[],
	metric: Exclude<Metric, 'battle' | 'versus'>
): LapPoint[] {
	const codes = new Map(drivers.map((driver) => [driver.number, driver.code]));
	const quickest = metric === 'lapTime' ? quickestByLap(snapshot) : null;
	const points = new Map<number, LapPoint>();

	for (const lap of snapshot.laps) {
		const code = codes.get(lap.driverNumber);

		if (!code || (metric === 'lapTime' && !isCleanLap(lap))) {
			continue;
		}

		const point = points.get(lap.lap) ?? { lap: lap.lap };

		point[code] =
			metric === 'lapTime'
				? (lap.lapTimeMs - (quickest?.get(lap.lap) ?? lap.lapTimeMs)) / 1000
				: metric === 'gap'
					? lap.gapToLeaderMs / 1000
					: lap.position;
		points.set(lap.lap, point);
	}

	return [...points.values()].toSorted((a, b) => (a.lap ?? 0) - (b.lap ?? 0));
}

export type Battle = {
	points: LapPoint[];
	/** The car ahead from each lap on, for its name above the line. */
	ahead: { lap: number; code: string }[];
};

/**
 * The driver's interval to whoever was directly ahead, lap by lap. The line breaks where that car
 * changes and on laps either car stopped, so a pass or a stop never reads as a gap won or lost.
 */
export function battlePoints(snapshot: RaceSnapshot, driverNumber: string): Battle {
	const byPlace = new Map(snapshot.laps.map((lap) => [`${lap.lap}:${lap.position}`, lap]));
	const codes = new Map(snapshot.drivers.map((driver) => [driver.number, driver.code]));
	const points: LapPoint[] = [];
	const ahead: Battle['ahead'] = [];

	for (const lap of snapshot.laps) {
		if (lap.driverNumber !== driverNumber || lap.position <= 1) {
			continue;
		}

		const other = byPlace.get(`${lap.lap}:${lap.position - 1}`);
		const code = other ? codes.get(other.driverNumber) : undefined;
		const changed = code !== undefined && code !== ahead.at(-1)?.code;
		const stopped = lap.pitIn || lap.pitOut || other?.pitIn || other?.pitOut;

		if (changed) {
			ahead.push({ lap: lap.lap, code });
		}

		points.push(
			(changed && ahead.length > 1) || stopped
				? { lap: lap.lap }
				: { lap: lap.lap, interval: lap.intervalMs / 1000 }
		);
	}

	return { points, ahead };
}

export type AxisRange = { domain: [number, number]; ticks: number[] };

/** Steps an axis may take, in seconds: a whole number of tenths, halves or seconds. */
const NICE_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 30, 60] as const;

/** To a tenth, so steps of 0.1 s land on 0.3 and not 0.30000000000000004. */
function round(seconds: number): number {
	return Math.round(seconds * 10) / 10;
}

function quantile(sorted: readonly number[], share: number): number {
	return sorted[Math.floor(share * (sorted.length - 1))] ?? 0;
}

/**
 * An axis range that leaves out the outliers, a stop or a spin, so they do not flatten every other
 * lap: from the low to the high `share` of the values, always through 0, in about four nice steps.
 * Values past it are clipped at the edge.
 */
export function robustRange(values: readonly number[], share = 0.95): AxisRange {
	const sorted = values.toSorted((a, b) => a - b);
	const low = Math.min(0, quantile(sorted, 1 - share));
	const high = Math.max(0, quantile(sorted, share));
	const step = NICE_STEPS.find((candidate) => (high - low) / candidate <= 4) ?? 60;
	const first = Math.floor(low / step);
	const count = Math.max(Math.ceil(high / step) - first, 1);
	const ticks = Array.from({ length: count + 1 }, (_, index) => round((first + index) * step));

	return { domain: [ticks[0] ?? 0, ticks.at(-1) ?? step], ticks };
}

/**
 * Each compared driver's gap to `referenceNumber` at every line crossing, in seconds: positive is
 * behind it. Laps where either car has no crossing are left out for that driver.
 */
export function versusPoints(
	snapshot: RaceSnapshot,
	drivers: readonly Driver[],
	referenceNumber: string
): LapPoint[] {
	const reference = new Map(
		snapshot.laps
			.filter((lap) => lap.driverNumber === referenceNumber)
			.map((lap) => [lap.lap, lap.gapToLeaderMs])
	);

	const codes = new Map(drivers.map((driver) => [driver.number, driver.code]));
	const points = new Map<number, LapPoint>();

	for (const lap of snapshot.laps) {
		const code = codes.get(lap.driverNumber);
		const theirs = reference.get(lap.lap);

		if (code && theirs !== undefined) {
			const point = points.get(lap.lap) ?? { lap: lap.lap };

			point[code] = (lap.gapToLeaderMs - theirs) / 1000;
			points.set(lap.lap, point);
		}
	}

	return [...points.values()].toSorted((a, b) => (a.lap ?? 0) - (b.lap ?? 0));
}

/** The laps each driver came into the pits on, for marks on their lines. */
export function pitLaps(snapshot: RaceSnapshot): Map<string, Set<number>> {
	const laps = new Map<string, Set<number>>();

	for (const stop of snapshot.pitStops) {
		laps.set(stop.driverNumber, (laps.get(stop.driverNumber) ?? new Set()).add(stop.lap));
	}

	return laps;
}

export type FlagRange = { from: number; to: number; status: Exclude<TrackStatus, 'green'> };

/**
 * Runs of laps under a flag, for bands behind the charts: each lap takes the most serious status
 * any car saw on it, and neighbouring laps under the same one join up.
 */
export function flagRanges(snapshot: RaceSnapshot): FlagRange[] {
	const worst = new Map<number, TrackStatus>();

	for (const lap of snapshot.laps) {
		const known = worst.get(lap.lap) ?? 'green';

		if (TRACK_STATUSES.indexOf(lap.trackStatus) > TRACK_STATUSES.indexOf(known)) {
			worst.set(lap.lap, lap.trackStatus);
		}
	}

	const ranges: FlagRange[] = [];

	for (const [lap, status] of [...worst].toSorted((a, b) => a[0] - b[0])) {
		const last = ranges.at(-1);

		if (status === 'green') {
			continue;
		}

		if (last && last.to === lap - 1 && last.status === status) {
			last.to = lap;
		} else {
			ranges.push({ from: lap, to: lap, status });
		}
	}

	return ranges;
}
