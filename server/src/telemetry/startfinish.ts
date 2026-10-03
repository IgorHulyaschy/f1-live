import { distanceAt, lowerBound } from './series.js';
import type { CarDistance } from './series.js';

/** A car completed a lap at this time, as the timing feed published it. */
export interface Crossing {
	driverNumber: string;
	lap: number;
	at: number;
}

export interface StartFinish {
	/** Where the line is, along the outline the distances were measured on. */
	distanceM: number;
	/** How long after a car crossed the line the timing feed published it. */
	latencyMs: number;
}

/** The timing feed is not slower than this; looking further only finds a worse fit. */
const MAX_LATENCY_MS = 2000;

const LATENCY_STEP_MS = 50;

/** The crossing is looked for this long on either side of where the latency puts it. */
const REFINE_WINDOW_MS = 1500;

/** Fewer crossings than this cannot place the line. */
const MIN_CROSSINGS = 8;

export function median(values: readonly number[]): number {
	const sorted = values.toSorted((a, b) => a - b);
	const middle = sorted.length >> 1;

	return sorted.length % 2 === 0
		? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
		: (sorted[middle] ?? 0);
}

/** `value` wrapped into `[-length / 2, length / 2)`. */
function wrapHalf(value: number, length: number): number {
	return ((((value + length / 2) % length) + length) % length) - length / 2;
}

/**
 * Finds the start/finish line from where cars were when the timing feed published a lap. The
 * feed is late by a roughly fixed time, so the delay that puts all those cars in one place is the
 * right one, and that place is the line. When the line is already known, only the delay is found.
 */
export function locateStartFinish(
	lengthM: number,
	cars: ReadonlyMap<string, CarDistance>,
	crossings: readonly Crossing[],
	knownLineM?: number
): StartFinish {
	const usable = crossings.filter((crossing) => cars.has(crossing.driverNumber));

	if (usable.length < MIN_CROSSINGS) {
		throw new Error(`Only ${usable.length} lap crossings to place the start/finish line from`);
	}

	let best: { spread: number; latencyMs: number; distanceM: number } | null = null;

	for (let latencyMs = 0; latencyMs <= MAX_LATENCY_MS; latencyMs += LATENCY_STEP_MS) {
		const places = usable.map((crossing) => {
			const car = cars.get(crossing.driverNumber);

			return car === undefined ? 0 : distanceAt(car, crossing.at - latencyMs);
		});

		const reference = knownLineM ?? places[0] ?? 0;
		const offsets = places.map((place) => wrapHalf(place - reference, lengthM));
		const centre = knownLineM === undefined ? median(offsets) : 0;
		const spread = median(offsets.map((offset) => Math.abs(offset - centre)));

		if (best === null || spread < best.spread) {
			best = { spread, latencyMs, distanceM: reference + centre };
		}
	}

	if (best === null) {
		throw new Error('No latency was tried');
	}

	return {
		distanceM: ((best.distanceM % lengthM) + lengthM) % lengthM,
		latencyMs: best.latencyMs
	};
}

/**
 * The time a car crossed the line near `near`: where its distance passes `lineM` going on,
 * between two samples. Without a crossing in the window, `near`.
 */
export function crossingTime(
	car: CarDistance,
	lengthM: number,
	lineM: number,
	near: number
): number {
	const { at } = car.track;
	const last = Math.min(lowerBound(at, near + REFINE_WINDOW_MS), at.length - 1);
	let best: number | null = null;

	for (let index = Math.max(lowerBound(at, near - REFINE_WINDOW_MS), 0); index < last; index += 1) {
		const before = wrapHalf((car.distanceM[index] ?? 0) - lineM, lengthM);
		const after = wrapHalf((car.distanceM[index + 1] ?? 0) - lineM, lengthM);

		if (before < 0 && after >= 0 && after - before < lengthM / 4) {
			const t0 = at[index] ?? 0;
			const t1 = at[index + 1] ?? t0;
			const time = t0 + ((t1 - t0) * -before) / (after - before);

			if (best === null || Math.abs(time - near) < Math.abs(best - near)) {
				best = time;
			}
		}
	}

	return best ?? near;
}
