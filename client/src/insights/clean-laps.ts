import type { Lap } from '@f1-live/shared';

/**
 * Fuel burn effect on lap time. The common rule of thumb is ~0.03 s per kg with ~1.8 kg burnt
 * per lap; this is an assumption, not a measured value.
 */
export const FUEL_EFFECT_SECONDS_PER_LAP = 0.055;

/**
 * A lap that represents pace: timed, green flag, not the opening lap, and not an in- or out-lap.
 * Outside races the feed leaves some laps untimed, at 0.
 */
export function isCleanLap(lap: Lap): boolean {
	return (
		lap.lapTimeMs > 0 && lap.trackStatus === 'green' && lap.lap > 1 && !lap.pitIn && !lap.pitOut
	);
}

/** Lap time with the fuel effect removed, i.e. as if driven with an empty tank. */
export function fuelCorrectedSeconds(
	lap: Pick<Lap, 'lap' | 'lapTimeMs'>,
	totalLaps: number
): number {
	return lap.lapTimeMs / 1000 - FUEL_EFFECT_SECONDS_PER_LAP * (totalLaps - lap.lap);
}

export function average(values: readonly number[]): number | null {
	if (values.length === 0) {
		return null;
	}

	let total = 0;

	for (const value of values) {
		total += value;
	}

	return total / values.length;
}

export function median(values: readonly number[]): number | null {
	const sorted = values.toSorted((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);

	if (sorted.length === 0) {
		return null;
	}

	return sorted.length % 2 === 1
		? (sorted[middle] ?? null)
		: ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** Under a Virtual Safety Car or a Safety Car, when everyone slows and a stop costs less. */
export function isNeutralised(lap: Pick<Lap, 'trackStatus'> | undefined): boolean {
	return lap?.trackStatus === 'vsc' || lap?.trackStatus === 'safety_car';
}

/** Clean laps this close to a lap set a driver's normal pace around it. */
const PACE_WINDOW_LAPS = 4;

/** A driver's usual lap around `lap`, from their own laps: the median of the clean ones nearby. */
export function paceAround(own: readonly Lap[], lap: number): number | null {
	return median(
		own.flatMap((entry) =>
			Math.abs(entry.lap - lap) <= PACE_WINDOW_LAPS && isCleanLap(entry) ? [entry.lapTimeMs] : []
		)
	);
}
