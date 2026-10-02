import type { Lap } from '@f1-live/shared';

/**
 * Fuel burn effect on lap time. The common rule of thumb is ~0.03 s per kg with ~1.8 kg burnt
 * per lap; this is an assumption, not a measured value.
 */
export const FUEL_EFFECT_SECONDS_PER_LAP = 0.055;

/** A lap that represents pace: green flag, not the opening lap, and not an in- or out-lap. */
export function isCleanLap(lap: Lap): boolean {
	return lap.trackStatus === 'green' && lap.lap > 1 && !lap.pitIn && !lap.pitOut;
}

/** Lap time with the fuel effect removed, i.e. as if driven with an empty tank. */
export function fuelCorrectedSeconds(lap: Lap, totalLaps: number): number {
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
