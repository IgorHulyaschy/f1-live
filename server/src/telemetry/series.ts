import { projectToTrack } from '@f1-live/shared';
import type { TrackOutline } from '@f1-live/shared';

import type { CarDataSample, CarReading, PositionSample } from '../sources/f1/telemetry.js';

/** One car's positions in time order. Samples without a fix, (0, 0) in the feed, are left out. */
export interface PositionTrack {
	/** Milliseconds since the Unix epoch, strictly increasing. */
	at: Float64Array;
	x: Float64Array;
	y: Float64Array;
	offTrack: Uint8Array;
}

/** One car's readings in time order. */
export interface CarDataTrack {
	at: Float64Array;
	speedKph: Float64Array;
	rpm: Float64Array;
	throttle: Float64Array;
	gear: Uint8Array;
	brake: Uint8Array;
	/** Absent when the feed has no DRS channel. */
	drsOpen: Uint8Array | null;
}

/** A gap in the samples longer than this is too long to trust a car's last place as a hint. */
const HINT_MAX_GAP_MS = 1500;

const OFF_TRACK = 'OffTrack';

/** Every car's positions, by racing number. */
export function positionTracks(samples: readonly PositionSample[]): Map<string, PositionTrack> {
	const rows = new Map<string, { at: number; x: number; y: number; off: number }[]>();

	for (const sample of samples) {
		for (const [driver, car] of sample.cars) {
			if (car.x === 0 && car.y === 0) {
				continue;
			}

			const list = rows.get(driver) ?? [];
			const last = list.at(-1);

			if (last === undefined || sample.at > last.at) {
				list.push({ at: sample.at, x: car.x, y: car.y, off: car.status === OFF_TRACK ? 1 : 0 });
			}

			rows.set(driver, list);
		}
	}

	return new Map(
		[...rows].map(([driver, list]) => [
			driver,
			{
				at: Float64Array.from(list, (row) => row.at),
				x: Float64Array.from(list, (row) => row.x),
				y: Float64Array.from(list, (row) => row.y),
				offTrack: Uint8Array.from(list, (row) => row.off)
			}
		])
	);
}

/** Every car's readings, by racing number. */
export function carDataTracks(samples: readonly CarDataSample[]): Map<string, CarDataTrack> {
	const rows = new Map<string, { at: number; reading: CarReading }[]>();

	for (const sample of samples) {
		for (const [driver, reading] of sample.cars) {
			const list = rows.get(driver) ?? [];
			const last = list.at(-1);

			if (last === undefined || sample.at > last.at) {
				list.push({ at: sample.at, reading });
			}

			rows.set(driver, list);
		}
	}

	return new Map(
		[...rows].map(([driver, list]) => [
			driver,
			{
				at: Float64Array.from(list, (row) => row.at),
				speedKph: Float64Array.from(list, (row) => row.reading.speedKph),
				rpm: Float64Array.from(list, (row) => row.reading.rpm),
				throttle: Float64Array.from(list, (row) => row.reading.throttle),
				gear: Uint8Array.from(list, (row) => row.reading.gear),
				brake: Uint8Array.from(list, (row) => (row.reading.brake ? 1 : 0)),
				drsOpen: list.some((row) => row.reading.drsOpen === null)
					? null
					: Uint8Array.from(list, (row) => (row.reading.drsOpen ? 1 : 0))
			}
		])
	);
}

/** Index of the first time at or after `t`; `times.length` when all are before it. */
export function lowerBound(times: ArrayLike<number>, t: number): number {
	let low = 0;
	let high = times.length;

	while (low < high) {
		const middle = (low + high) >> 1;

		if ((times[middle] ?? 0) < t) {
			low = middle + 1;
		} else {
			high = middle;
		}
	}

	return low;
}

/** `values` at time `t`, linear between the samples around it and the end value outside them. */
export function interpolate(
	times: ArrayLike<number>,
	values: ArrayLike<number>,
	t: number
): number {
	const next = lowerBound(times, t);

	if (next === 0) {
		return values[0] ?? 0;
	}

	if (next >= times.length) {
		return values[times.length - 1] ?? 0;
	}

	const t0 = times[next - 1] ?? 0;
	const t1 = times[next] ?? t0;
	const v0 = values[next - 1] ?? 0;
	const v1 = values[next] ?? v0;

	return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
}

/** The sample nearest in time to `t`. */
export function nearest(times: ArrayLike<number>, values: ArrayLike<number>, t: number): number {
	const next = lowerBound(times, t);

	if (next === 0) {
		return values[0] ?? 0;
	}

	if (next >= times.length) {
		return values[times.length - 1] ?? 0;
	}

	return t - (times[next - 1] ?? 0) <= (times[next] ?? 0) - t
		? (values[next - 1] ?? 0)
		: (values[next] ?? 0);
}

/**
 * How far along the outline a car has driven at each of its samples, adding up laps: it only
 * grows, so the wobble of a position fix on the line never runs the car backwards. The origin is
 * the outline's own start, which is where the car's first sample lies on it, not where the car
 * began.
 */
export function distanceAlong(outline: TrackOutline, track: PositionTrack): Float64Array {
	const distances = new Float64Array(track.at.length);
	const half = outline.lengthM / 2;
	let previous = 0;
	let raw = 0;
	let best = 0;

	for (let index = 0; index < track.at.length; index += 1) {
		const gap =
			index === 0 ? Number.POSITIVE_INFINITY : (track.at[index] ?? 0) - (track.at[index - 1] ?? 0);

		const found = projectToTrack(
			outline,
			track.x[index] ?? 0,
			track.y[index] ?? 0,
			gap <= HINT_MAX_GAP_MS ? previous : undefined
		);

		if (index === 0) {
			raw = found.distanceM;
		} else {
			let change = found.distanceM - previous;

			if (change > half) {
				change -= outline.lengthM;
			} else if (change < -half) {
				change += outline.lengthM;
			}

			raw += change;
		}

		previous = found.distanceM;
		best = Math.max(best, raw);
		distances[index] = best;
	}

	return distances;
}

/** A car's positions and how far along the outline it was at each of them. */
export interface CarDistance {
	track: PositionTrack;
	/** At each sample of `track`, from `distanceAlong`; never decreases. */
	distanceM: Float64Array;
}

/** Distance along the outline at time `t`, between the samples around it. */
export function distanceAt(car: CarDistance, t: number): number {
	return interpolate(car.track.at, car.distanceM, t);
}
