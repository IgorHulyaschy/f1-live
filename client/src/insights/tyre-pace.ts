import type { RaceSnapshot, TyreCompound } from '@f1-live/shared';

import { average, fuelCorrectedSeconds, isCleanLap, median } from './clean-laps.ts';

/** Fewer clean laps than this make a degradation fit meaningless. */
const MIN_STINT_LAPS = 6;

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

export interface CompoundShift {
	shift: (compound: TyreCompound) => number;
	applied: boolean;
}

/** A compound's offset is trusted only when this many stints back it. */
const MIN_COMPOUND_STINTS = 2;

const DRY_ORDER: readonly TyreCompound[] = ['SOFT', 'MEDIUM', 'HARD'];

/**
 * How much slower than the hard, on a new set, each compound runs: the field's median new-tyre
 * pace on it less its median on the hard. Different strategies then compare on equal tyres.
 *
 * The offsets are field medians, so a race where the softs ran late and short can fit the soft
 * slower than the hard. The shift applies only when every dry compound that ran has enough
 * stints and the offsets keep the physical order (soft not slower than medium, medium not slower
 * than hard); otherwise every shift is zero and `applied` is false.
 */
export function compoundShifter(stints: readonly StintPace[]): CompoundShift {
	const paces = (compound: TyreCompound) =>
		stints.flatMap((stint) => (stint.compound === compound ? [stint.newTyrePaceSeconds] : []));

	const medianOn = (compound: TyreCompound) => median(paces(compound));
	const hardBaseline = medianOn('HARD');

	const ran = DRY_ORDER.filter((compound) => paces(compound).length > 0);

	const enough =
		hardBaseline !== null && ran.every((compound) => paces(compound).length >= MIN_COMPOUND_STINTS);

	const medians = ran.flatMap((compound) => medianOn(compound) ?? []);

	const ordered = medians.every(
		(value, index) => index === 0 || (medians[index - 1] ?? 0) <= value
	);

	const applied = enough && ordered;

	return {
		applied,
		shift: (compound) => {
			const compoundMedian = medianOn(compound);

			return !applied || hardBaseline === null || compoundMedian === null
				? 0
				: compoundMedian - hardBaseline;
		}
	};
}
