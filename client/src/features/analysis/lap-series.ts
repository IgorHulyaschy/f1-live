import { TRACK_STATUSES, type Driver, type RaceSnapshot, type TrackStatus } from '@f1-live/shared';

import { isCleanLap } from '../../insights/clean-laps.ts';

/** One row per lap: `lap` plus one value per driver code. */
export type LapPoint = Record<string, number>;

export type Metric = 'lapTime' | 'gap' | 'position' | 'battle' | 'versus';

export function toPoints(
	snapshot: RaceSnapshot,
	drivers: readonly Driver[],
	metric: Exclude<Metric, 'battle' | 'versus'>
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
