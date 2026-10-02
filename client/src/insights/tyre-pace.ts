import type { Driver, Lap, RaceSnapshot, TyreCompound } from '@f1-live/shared';

import { average, fuelCorrectedSeconds, isCleanLap } from './clean-laps.ts';

/** Fewer clean laps than this make a degradation fit meaningless. */
const MIN_STINT_LAPS = 4;

export interface StintPace {
	driverNumber: string;
	stint: number;
	compound: TyreCompound;
	cleanLaps: number;
	/** Fitted lap-time increase per lap of tyre age, fuel-corrected. */
	degradationSecondsPerLap: number;
	/** Fitted fuel-corrected lap time on a brand-new set of this compound. */
	newTyrePaceSeconds: number;
}

export interface CorrectedPace {
	driver: Driver;
	compound: TyreCompound;
	sampleLaps: number;
	/** Fuel- and tyre-age-corrected pace over the recent window, on a common compound basis. */
	paceSeconds: number;
	deltaToBestSeconds: number;
}

interface LineFit {
	slope: number;
	intercept: number;
}

/** Least-squares line through (x, y) points. */
function fitLine(points: readonly { x: number; y: number }[]): LineFit {
	const meanX = average(points.map((point) => point.x)) ?? 0;
	const meanY = average(points.map((point) => point.y)) ?? 0;
	let covariance = 0;
	let variance = 0;

	for (const point of points) {
		covariance += (point.x - meanX) * (point.y - meanY);
		variance += (point.x - meanX) ** 2;
	}

	const slope = variance === 0 ? 0 : covariance / variance;

	return { slope, intercept: meanY - slope * meanX };
}

function stintLaps(snapshot: RaceSnapshot, driverNumber: string, startLap: number, endLap: number) {
	return snapshot.laps.filter(
		(lap) =>
			lap.driverNumber === driverNumber &&
			lap.lap >= startLap &&
			lap.lap <= endLap &&
			isCleanLap(lap)
	);
}

/** Degradation and new-tyre pace for every stint with enough clean laps. */
export function stintPaces(snapshot: RaceSnapshot): StintPace[] {
	const paces: StintPace[] = [];

	for (const stint of snapshot.stints) {
		const laps = stintLaps(snapshot, stint.driverNumber, stint.startLap, stint.endLap);

		if (laps.length < MIN_STINT_LAPS) {
			continue;
		}

		const fit = fitLine(
			laps.map((lap) => ({
				x: lap.tyreAge,
				y: fuelCorrectedSeconds(lap, snapshot.session.totalLaps)
			}))
		);

		paces.push({
			driverNumber: stint.driverNumber,
			stint: stint.stint,
			compound: stint.compound,
			cleanLaps: laps.length,
			degradationSecondsPerLap: fit.slope,
			newTyrePaceSeconds: fit.intercept
		});
	}

	return paces;
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

/**
 * Who is really fastest right now: recent clean laps with fuel and tyre age removed, and each
 * compound shifted by the field's median new-tyre gap to the hard, so different strategies compare.
 */
export function tyreCorrectedPace(snapshot: RaceSnapshot, windowLaps = 8): CorrectedPace[] {
	const stints = stintPaces(snapshot);

	const hardBaseline = median(
		stints.filter((stint) => stint.compound === 'HARD').map((stint) => stint.newTyrePaceSeconds)
	);

	const compoundShift = (compound: TyreCompound): number => {
		const compoundMedian = median(
			stints.filter((stint) => stint.compound === compound).map((stint) => stint.newTyrePaceSeconds)
		);

		return hardBaseline === null || compoundMedian === null ? 0 : compoundMedian - hardBaseline;
	};

	const results: Omit<CorrectedPace, 'deltaToBestSeconds'>[] = [];

	for (const driver of snapshot.drivers) {
		const current = snapshot.stints.findLast((stint) => stint.driverNumber === driver.number);

		const fit = current
			? stints.find(
					(stint) => stint.driverNumber === driver.number && stint.stint === current.stint
				)
			: undefined;

		if (!current || !fit || current.endLap < snapshot.currentLap - 1) {
			continue;
		}

		const recent: Lap[] = stintLaps(
			snapshot,
			driver.number,
			current.startLap,
			current.endLap
		).slice(-windowLaps);

		const corrected = average(
			recent.map(
				(lap) =>
					fuelCorrectedSeconds(lap, snapshot.session.totalLaps) -
					fit.degradationSecondsPerLap * lap.tyreAge -
					compoundShift(current.compound)
			)
		);

		if (corrected !== null) {
			results.push({
				driver,
				compound: current.compound,
				sampleLaps: recent.length,
				paceSeconds: corrected
			});
		}
	}

	results.sort((a, b) => a.paceSeconds - b.paceSeconds);

	const best = results[0]?.paceSeconds ?? 0;

	return results.map((result) => ({ ...result, deltaToBestSeconds: result.paceSeconds - best }));
}
