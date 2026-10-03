import type { Driver, Lap, LapIndexEntry, RaceSnapshot } from '@f1-live/shared';

import { comparableLaps, fastestComparableLap } from '../../insights/telemetry-traces.ts';

/** Most laps the traces compare at once. */
export const MAX_SLOTS = 3;

/** Driver against driver on their best laps, or one driver's laps against each other. */
export type TraceMode = 'drivers' | 'laps';

export type TraceSlot = { driverNumber: string; lap: number };

/** A lap the traces can show: timed, done by the moment on screen, and with comparable telemetry. */
export type LapChoice = { lap: Lap; entry: LapIndexEntry; fastest: boolean };

/** A driver's laps that can go on the traces, in lap order. */
export function lapChoices(
	snapshot: RaceSnapshot,
	entries: readonly LapIndexEntry[],
	driverNumber: string,
	lengthM: number
): LapChoice[] {
	const comparable = comparableLaps(entries, driverNumber, lengthM);
	const own = snapshot.laps.filter((lap) => lap.driverNumber === driverNumber && lap.lapTimeMs > 0);
	const fastest = fastestComparableLap(own, comparable);

	return own.flatMap((lap) => {
		const entry = comparable.get(lap.lap);

		return entry ? [{ lap, entry, fastest: lap === fastest }] : [];
	});
}

/**
 * The laps the traces open on. Drivers: the first compared drivers, each on their best lap.
 * Laps: the followed driver's best lap against a later one, or against their second best when
 * nothing came after it; another compared driver stands in when the followed one has none.
 */
export function defaultSlots(
	mode: TraceMode,
	compared: readonly Driver[],
	followedDriver: string,
	choicesOf: (driverNumber: string) => readonly LapChoice[]
): TraceSlot[] {
	if (mode === 'drivers') {
		return compared
			.flatMap((driver) => {
				const best = choicesOf(driver.number).find((choice) => choice.fastest);

				return best ? [{ driverNumber: driver.number, lap: best.lap.lap }] : [];
			})
			.slice(0, MAX_SLOTS);
	}

	const candidates = [followedDriver, ...compared.map((driver) => driver.number)];
	const driverNumber = candidates.find((number) => choicesOf(number).length > 0);

	if (driverNumber === undefined) {
		return [];
	}

	const choices = choicesOf(driverNumber);
	const best = choices.find((choice) => choice.fastest);
	const latest = choices.findLast((choice) => choice !== best);

	const second = choices
		.filter((choice) => choice !== best)
		.toSorted((a, b) => a.lap.lapTimeMs - b.lap.lapTimeMs)[0];

	return [best, latest === undefined || latest.lap.lap < (best?.lap.lap ?? 0) ? second : latest]
		.flatMap((choice) => (choice ? [{ driverNumber, lap: choice.lap.lap }] : []))
		.slice(0, MAX_SLOTS);
}
