import type { Lap, RaceSnapshot } from '@f1-live/shared';

import { average, fuelCorrectedSeconds, isCleanLap } from './clean-laps.ts';
import { type StandingRow, standingsAt } from './standings.ts';

/** Clean laps averaged per car. */
export const PACE_NOW_LAPS = 5;

/** Laps further back than this say nothing about pace now. */
const LOOKBACK_LAPS = 10;

/** Fewer clean laps than this give no pace. */
const MIN_LAPS = 2;

/** A trend needs this many laps. */
const MIN_TREND_LAPS = 3;

export interface PaceNow {
	row: StandingRow;
	/** Fuel-corrected average of the car's last clean laps. */
	paceSeconds: number;
	/** Seconds a lap slower than the fastest car now; 0 for that car. */
	deltaSeconds: number;
	/** The fitted change per lap over those laps, fuel removed: negative when getting faster. */
	trendSecondsPerLap: number | null;
	laps: readonly Lap[];
}

/** Least-squares slope of lap time against lap number. */
function slope(points: readonly { x: number; y: number }[]): number {
	const meanX = average(points.map((point) => point.x)) ?? 0;
	const meanY = average(points.map((point) => point.y)) ?? 0;
	let covariance = 0;
	let variance = 0;

	for (const point of points) {
		covariance += (point.x - meanX) * (point.y - meanY);
		variance += (point.x - meanX) ** 2;
	}

	return variance === 0 ? 0 : covariance / variance;
}

/**
 * Who is fast right now: each running car's last few clean laps, with the fuel burnt taken out,
 * against the fastest car's. Pit laps and neutralised laps are left out; a car without enough
 * clean laps lately is left out too.
 */
export function paceNow(
	snapshot: RaceSnapshot,
	rows: readonly StandingRow[] = standingsAt(snapshot)
): PaceNow[] {
	const { totalLaps } = snapshot.session;
	const since = snapshot.currentLap - LOOKBACK_LAPS;

	const paces = rows.flatMap((row): Omit<PaceNow, 'deltaSeconds'>[] => {
		if (row.state === 'out') {
			return [];
		}

		const laps = snapshot.laps
			.filter((lap) => lap.driverNumber === row.driver.number && lap.lap > since && isCleanLap(lap))
			.slice(-PACE_NOW_LAPS);

		const points = laps.map((lap) => ({ x: lap.lap, y: fuelCorrectedSeconds(lap, totalLaps) }));
		const pace = average(points.map((point) => point.y));

		return pace === null || laps.length < MIN_LAPS
			? []
			: [
					{
						row,
						paceSeconds: pace,
						trendSecondsPerLap: laps.length >= MIN_TREND_LAPS ? slope(points) : null,
						laps
					}
				];
	});

	const best = Math.min(...paces.map((entry) => entry.paceSeconds));

	return paces
		.map((entry) => ({ ...entry, deltaSeconds: entry.paceSeconds - best }))
		.toSorted((a, b) => a.deltaSeconds - b.deltaSeconds);
}
