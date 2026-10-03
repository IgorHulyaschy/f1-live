import { TELEMETRY_VERSION } from '@f1-live/shared';
import type { OutlineSource, Point, TrackOutline } from '@f1-live/shared';

import { lowerBound } from './series.js';
import type { PositionTrack } from './series.js';

/** The outline's points are about this far apart. */
const STEP_M = 5;

/** Fine steps along the spline before it is spaced evenly. */
const SPLINE_STEPS = 12;

/** Smoothing averages each point with this many neighbours on each side. */
const SMOOTHING_RADIUS = 2;

/** The lap's end is looked for this long around where the timing feed puts it. */
const CLOSE_WINDOW_MS = 3000;

/** Fewer samples than this is not a lap. */
const MIN_LOOP_POINTS = 40;

export interface Loop {
	points: Point[];
	lengthM: number;
}

function distance(a: Point, b: Point): number {
	return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Centripetal Catmull-Rom spacing of the knots: the square root of the chord. */
function knot(a: Point, b: Point): number {
	return Math.max(Math.sqrt(distance(a, b)), 1e-6);
}

/** Barry-Goldman evaluation of a centripetal Catmull-Rom segment between `p1` and `p2`. */
function splinePoint(p0: Point, p1: Point, p2: Point, p3: Point, share: number): Point {
	const t1 = knot(p0, p1);
	const t2 = t1 + knot(p1, p2);
	const t3 = t2 + knot(p2, p3);
	const t = t1 + (t2 - t1) * share;

	const mix = (a: Point, b: Point, from: number, to: number): Point => {
		const weight = (t - from) / (to - from);

		return [a[0] + (b[0] - a[0]) * weight, a[1] + (b[1] - a[1]) * weight];
	};

	const a1 = mix(p0, p1, 0, t1);
	const a2 = mix(p1, p2, t1, t2);
	const a3 = mix(p2, p3, t2, t3);
	const b1 = mix(a1, a2, 0, t2);
	const b2 = mix(a2, a3, t1, t3);

	return mix(b1, b2, t1, t2);
}

/** A closed centripetal spline through the points, as a finer closed polyline. */
function closedSpline(points: readonly Point[]): Point[] {
	const n = points.length;

	const at = (index: number): Point => {
		const point = points[((index % n) + n) % n];

		if (point === undefined) {
			throw new Error('The loop has no points');
		}

		return point;
	};

	return Array.from({ length: n * SPLINE_STEPS }, (_, index) => {
		const segment = Math.floor(index / SPLINE_STEPS);

		return splinePoint(
			at(segment - 1),
			at(segment),
			at(segment + 1),
			at(segment + 2),
			(index % SPLINE_STEPS) / SPLINE_STEPS
		);
	});
}

/** Points spaced evenly along the closed polyline, as many as fit in `stepM` and no fewer than 8. */
export function evenLoop(polyline: readonly Point[], stepM: number): Loop {
	const n = polyline.length;
	const cumulative = [0];

	for (let index = 0; index < n; index += 1) {
		const from = polyline[index];
		const to = polyline[(index + 1) % n];

		if (from === undefined || to === undefined) {
			throw new Error('The loop has no points');
		}

		cumulative.push((cumulative[index] ?? 0) + distance(from, to));
	}

	const lengthM = cumulative[n] ?? 0;
	const count = Math.max(8, Math.round(lengthM / stepM));
	const points: Point[] = [];
	let segment = 0;

	for (let index = 0; index < count; index += 1) {
		const along = (index / count) * lengthM;

		while ((cumulative[segment + 1] ?? lengthM) < along) {
			segment += 1;
		}

		const from = polyline[segment % n];
		const to = polyline[(segment + 1) % n];
		const start = cumulative[segment] ?? 0;

		const share =
			(cumulative[segment + 1] ?? lengthM) - start === 0
				? 0
				: (along - start) / ((cumulative[segment + 1] ?? lengthM) - start);

		if (from === undefined || to === undefined) {
			throw new Error('The loop has no points');
		}

		points.push([from[0] + (to[0] - from[0]) * share, from[1] + (to[1] - from[1]) * share]);
	}

	return { points, lengthM };
}

function smoothLoop(points: readonly Point[], radius: number): Point[] {
	const n = points.length;

	return points.map((_, index) => {
		let x = 0;
		let y = 0;

		for (let offset = -radius; offset <= radius; offset += 1) {
			const point = points[(((index + offset) % n) + n) % n];

			x += point?.[0] ?? 0;
			y += point?.[1] ?? 0;
		}

		const count = 2 * radius + 1;

		return [x / count, y / count];
	});
}

/**
 * The closed line of one lap's positions: from the sample at `startAt` round to where the car
 * is back at that place within a few seconds of `endAt`, then a spline through them, smoothed and
 * spaced evenly.
 */
export function loopFromLap(track: PositionTrack, startAt: number, endAt: number): Loop {
	const first = lowerBound(track.at, startAt);
	const lastCandidate = lowerBound(track.at, endAt + CLOSE_WINDOW_MS);
	const from: Point = [track.x[first] ?? 0, track.y[first] ?? 0];
	let end = -1;
	let closest = Number.POSITIVE_INFINITY;

	for (
		let index = lowerBound(track.at, endAt - CLOSE_WINDOW_MS);
		index < Math.min(lastCandidate, track.at.length);
		index += 1
	) {
		const gap = distance(from, [track.x[index] ?? 0, track.y[index] ?? 0]);

		if (gap < closest) {
			closest = gap;
			end = index;
		}
	}

	if (end - first < MIN_LOOP_POINTS) {
		throw new Error('The lap has too few position samples to draw the circuit from');
	}

	const raw: Point[] = Array.from({ length: end - first }, (_, offset): Point => [
		track.x[first + offset] ?? 0,
		track.y[first + offset] ?? 0
	]);

	const spaced = evenLoop(closedSpline(raw), STEP_M);

	return evenLoop(smoothLoop(spaced.points, SMOOTHING_RADIUS), STEP_M);
}

/** Degrees that turn the line so its long side lies along the x axis, in (-90, 90]. */
export function longSideRotationDeg(points: readonly Point[]): number {
	const n = points.length;
	const meanX = points.reduce((sum, point) => sum + point[0], 0) / n;
	const meanY = points.reduce((sum, point) => sum + point[1], 0) / n;
	let xx = 0;
	let yy = 0;
	let xy = 0;

	for (const [x, y] of points) {
		xx += (x - meanX) ** 2;
		yy += (y - meanY) ** 2;
		xy += (x - meanX) * (y - meanY);
	}

	const degrees = -(0.5 * Math.atan2(2 * xy, xx - yy) * 180) / Math.PI;

	return Math.round(degrees * 10) / 10;
}

export interface OutlineSections {
	circuitKey: string;
	name: string;
	source: OutlineSource;
}

/**
 * An outline around a loop, with the sectors still unplaced: enough to measure distances on,
 * not yet to publish.
 */
export function provisionalOutline(loop: Loop, about: OutlineSections): TrackOutline {
	return {
		v: TELEMETRY_VERSION,
		circuitKey: about.circuitKey,
		name: about.name,
		lengthM: loop.lengthM,
		points: loop.points,
		rotationDeg: longSideRotationDeg(loop.points),
		sectorBoundariesM: [loop.lengthM / 3, (2 * loop.lengthM) / 3],
		miniSectorsPerSector: [1, 1, 1],
		miniSectorStartsM: [0, loop.lengthM / 3, (2 * loop.lengthM) / 3],
		pitLane: null,
		source: about.source
	};
}

export interface RotatedOutline {
	outline: TrackOutline;
	/** How far the start moved, in metres. */
	shiftedM: number;
}

/**
 * The same loop with its first point moved on by about `shiftM`, to the nearest point, which
 * becomes the new start. `shiftedM` is the move actually made, for adjusting distances measured
 * on the old outline.
 */
export function rotateStart(outline: TrackOutline, shiftM: number): RotatedOutline {
	const n = outline.points.length;
	const first = Math.round((shiftM / outline.lengthM) * n);

	return {
		outline: {
			...outline,
			points: outline.points.map(
				(_, index) => outline.points[(((index + first) % n) + n) % n] ?? [0, 0]
			)
		},
		shiftedM: (first * outline.lengthM) / n
	};
}
