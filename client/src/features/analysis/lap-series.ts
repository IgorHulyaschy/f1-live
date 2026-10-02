import type { Driver, RaceSnapshot } from '@f1-live/shared';

import { isCleanLap } from '@/insights/clean-laps';

/** One row per lap: `lap` plus one value per driver code. */
export type LapPoint = Record<string, number>;

export type Metric = 'lapTime' | 'gap' | 'position' | 'battle';

export function toPoints(
	snapshot: RaceSnapshot,
	drivers: readonly Driver[],
	metric: Exclude<Metric, 'battle'>
): LapPoint[] {
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

/** The followed driver's interval to whoever was directly ahead, lap by lap. */
export function battlePoints(snapshot: RaceSnapshot, driverNumber: string): LapPoint[] {
	return snapshot.laps
		.filter((lap) => lap.driverNumber === driverNumber && lap.position > 1)
		.map((lap) => ({ lap: lap.lap, interval: lap.intervalMs / 1000 }));
}

/** Contiguous runs of neutralised laps, for shading behind the charts. */
export function neutralisedRanges(snapshot: RaceSnapshot): { from: number; to: number }[] {
	const laps = [
		...new Set(snapshot.laps.filter((lap) => lap.trackStatus !== 'green').map((lap) => lap.lap))
	].toSorted((a, b) => a - b);

	const ranges: { from: number; to: number }[] = [];

	for (const lap of laps) {
		const last = ranges.at(-1);

		if (last && last.to === lap - 1) {
			last.to = lap;
		} else {
			ranges.push({ from: lap, to: lap });
		}
	}

	return ranges;
}
