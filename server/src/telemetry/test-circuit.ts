import { TELEMETRY_VERSION } from '@f1-live/shared';
import type { Point, TrackOutline } from '@f1-live/shared';

import { distanceAlong } from './series.js';
import type { CarDistance, PositionTrack } from './series.js';

/** A rounded stadium: two straights joined by two half circles, driven counter-clockwise. */
export const STRAIGHT_M = 1200;

export const RADIUS_M = 300;

export const LENGTH_M = 2 * STRAIGHT_M + 2 * Math.PI * RADIUS_M;

/** The point `distanceM` along the stadium from the middle of the bottom straight. */
export function stadiumPoint(distanceM: number): Point {
	const d = ((distanceM % LENGTH_M) + LENGTH_M) % LENGTH_M;
	const half = STRAIGHT_M / 2;
	const arc = Math.PI * RADIUS_M;

	if (d < half) {
		return [d, -RADIUS_M];
	}

	if (d < half + arc) {
		const angle = (d - half) / RADIUS_M - Math.PI / 2;

		return [half + RADIUS_M * Math.cos(angle), RADIUS_M * Math.sin(angle)];
	}

	if (d < half + arc + STRAIGHT_M) {
		return [half - (d - half - arc), RADIUS_M];
	}

	if (d < half + 2 * arc + STRAIGHT_M) {
		const angle = (d - half - arc - STRAIGHT_M) / RADIUS_M + Math.PI / 2;

		return [-half + RADIUS_M * Math.cos(angle), RADIUS_M * Math.sin(angle)];
	}

	return [-half + (d - half - 2 * arc - STRAIGHT_M), -RADIUS_M];
}

/** A repeatable stream of numbers in [-1, 1), so a test's noise is the same every run. */
export function noise(seed: number): () => number {
	let state = seed;

	return () => {
		state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;

		return (state / 4_294_967_296) * 2 - 1;
	};
}

export interface DrivenLap {
	/** Seconds the lap takes. */
	lapSeconds: number;
	/** How much faster than the lap's mean speed the car is on the line: the speed varies as a cosine of the lap. */
	swing: number;
}

export interface Driven {
	track: PositionTrack;
	/** When the car crosses the line at the start of each lap and at the end of the last, ms. */
	crossings: number[];
	/** The car's true distance along the stadium at each sample, which a test may hold the result to. */
	truth: Float64Array;
}

/**
 * One car driving laps of the stadium, sampled every 250 ms with a position error of up to
 * `errorM`. Within a lap the speed follows a cosine, so the car is not where an even pace would
 * put it. The line is at distance 0.
 */
export function driveLaps(
	laps: readonly DrivenLap[],
	startAt: number,
	errorM: number,
	seed: number
): Driven {
	const random = noise(seed);
	const at: number[] = [];
	const x: number[] = [];
	const y: number[] = [];
	const truth: number[] = [];
	const stepSeconds = 0.25;
	let distance = 0;
	let time = startAt;

	while (distance < laps.length * LENGTH_M + 100) {
		const lap = laps[Math.min(laps.length - 1, Math.floor(distance / LENGTH_M))];
		const [px, py] = stadiumPoint(distance);

		at.push(time);
		x.push(px + random() * errorM);
		y.push(py + random() * errorM);
		truth.push(distance);

		if (lap !== undefined) {
			const mean = LENGTH_M / lap.lapSeconds;
			const swing = lap.swing * Math.cos((2 * Math.PI * (distance % LENGTH_M)) / LENGTH_M);

			distance += mean * (1 + swing) * stepSeconds;
		}

		time += stepSeconds * 1000;
	}

	const crossings = Array.from({ length: laps.length + 1 }, (_, lap) => {
		const next = truth.findIndex((value) => value >= lap * LENGTH_M);
		const before = Math.max(0, next - 1);
		const span = (truth[next] ?? 0) - (truth[before] ?? 0);
		const share = span === 0 ? 0 : (lap * LENGTH_M - (truth[before] ?? 0)) / span;

		return (at[before] ?? 0) + share * ((at[next] ?? 0) - (at[before] ?? 0));
	});

	return {
		track: {
			at: Float64Array.from(at),
			x: Float64Array.from(x),
			y: Float64Array.from(y),
			offTrack: new Uint8Array(at.length)
		},
		crossings,
		truth: Float64Array.from(truth)
	};
}

export function stadiumOutline(): TrackOutline {
	const count = Math.round(LENGTH_M / 5);

	return {
		v: TELEMETRY_VERSION,
		circuitKey: 'stadium',
		name: 'Stadium',
		lengthM: LENGTH_M,
		points: Array.from({ length: count }, (_, index) => stadiumPoint((index / count) * LENGTH_M)),
		rotationDeg: 0,
		sectorBoundariesM: [LENGTH_M / 3, (2 * LENGTH_M) / 3],
		miniSectorsPerSector: [1, 1, 1],
		miniSectorStartsM: [0, LENGTH_M / 3, (2 * LENGTH_M) / 3],
		pitLane: null,
		source: { sessionKey: 1, driverNumber: '1', lap: 1, lapTimeMs: 1, miniSectors: 'even' }
	};
}

export function carOn(outline: TrackOutline, driven: Driven): CarDistance {
	return { track: driven.track, distanceM: distanceAlong(outline, driven.track) };
}
