import type { Driver, Lap, RaceSnapshot, TyreCompound } from '@f1-live/shared';

import { isCleanLap, median } from './clean-laps.ts';

/** Practice race runs are this many clean laps on one set at least. */
export const LONG_RUN_LAPS = 5;

/** A lap this much slower than the run's middle lap was a cool-down or traffic, not pace. */
const PACE_LAP_LIMIT = 1.04;

export type LongRun = {
	driver: Driver;
	compound: TyreCompound;
	/** Laps counted for pace. */
	laps: number;
	fromLap: number;
	toLap: number;
	averageMs: number;
	/** Lap time lost per lap of tyre age over the run, ms; positive is slower. */
	fallOffMs: number;
};

/** Least-squares slope of y on x. */
function slope(points: readonly { x: number; y: number }[]): number {
	const meanX = points.reduce((total, point) => total + point.x, 0) / points.length;
	const meanY = points.reduce((total, point) => total + point.y, 0) / points.length;
	let covariance = 0;
	let variance = 0;

	for (const point of points) {
		covariance += (point.x - meanX) * (point.y - meanY);
		variance += (point.x - meanX) ** 2;
	}

	return variance === 0 ? 0 : covariance / variance;
}

/** Each set of tyres a driver ran, as its laps, in order. */
function runsOf(laps: readonly Lap[]): Lap[][] {
	const runs: Lap[][] = [];

	for (const lap of laps) {
		const run = runs.at(-1);
		const previous = run?.at(-1);

		if (run && previous && previous.compound === lap.compound && lap.tyreAge > previous.tyreAge) {
			run.push(lap);
		} else {
			runs.push([lap]);
		}
	}

	return runs;
}

/**
 * Each driver's longest run on one set, of at least `LONG_RUN_LAPS` laps at pace, quickest on
 * average first. Compounds differ, so the order is a first read, not a verdict.
 */
export function longRuns(snapshot: RaceSnapshot): LongRun[] {
	const runs = snapshot.drivers.flatMap((driver): LongRun[] => {
		const own = snapshot.laps.filter((lap) => lap.driverNumber === driver.number);

		const candidates = runsOf(own).flatMap((run) => {
			const clean = run.filter(isCleanLap);
			const middle = median(clean.map((lap) => lap.lapTimeMs));

			const paced = clean.filter(
				(lap) => middle !== null && lap.lapTimeMs <= middle * PACE_LAP_LIMIT
			);

			return paced.length >= LONG_RUN_LAPS ? [paced] : [];
		});

		const longest = candidates.reduce<Lap[] | null>(
			(best, run) => (!best || run.length > best.length ? run : best),
			null
		);

		const first = longest?.[0];
		const last = longest?.at(-1);

		if (!longest || !first || !last) {
			return [];
		}

		return [
			{
				driver,
				compound: first.compound,
				laps: longest.length,
				fromLap: first.lap,
				toLap: last.lap,
				averageMs: longest.reduce((total, lap) => total + lap.lapTimeMs, 0) / longest.length,
				fallOffMs: slope(longest.map((lap) => ({ x: lap.tyreAge, y: lap.lapTimeMs })))
			}
		];
	});

	return runs.toSorted((a, b) => a.averageMs - b.averageMs);
}

export type Mileage = {
	driver: Driver;
	total: number;
	byCompound: ReadonlyMap<TyreCompound, number>;
};

/** Laps each driver has run on each compound, most laps first. */
export function tyreMileage(snapshot: RaceSnapshot): Mileage[] {
	return snapshot.drivers
		.map((driver) => {
			const byCompound = new Map<TyreCompound, number>();
			let total = 0;

			for (const lap of snapshot.laps) {
				if (lap.driverNumber === driver.number) {
					byCompound.set(lap.compound, (byCompound.get(lap.compound) ?? 0) + 1);
					total += 1;
				}
			}

			return { driver, total, byCompound };
		})
		.filter((entry) => entry.total > 0)
		.toSorted((a, b) => b.total - a.total);
}
