/**
 * Track geometry, per-lap telemetry and replay positions, as the server writes them and the
 * client reads them. Distances are metres along the racing line from the start/finish line,
 * times are milliseconds, speeds km/h. Positions are metres in the timing feed's own frame, so
 * a car's `x`, `y` and the outline's points can be drawn together without a transform. The
 * helpers are pure: they take the data and return numbers.
 */

export const TELEMETRY_VERSION = 1;

/** A place on the circuit in metres: `[x, y]`. */
export type Point = readonly [x: number, y: number];

export interface PitLane {
	/** The lane in driving order, from the entry to the exit. */
	points: readonly Point[];
	/** Where along the lap the lane starts and ends; the exit can be past the line. */
	entryM: number;
	exitM: number;
}

/** What the outline was built from, to judge it and to replace it with a better one. */
export interface OutlineSource {
	sessionKey: number;
	driverNumber: string;
	lap: number;
	lapTimeMs: number;
	/** `timing` when the mini-sector boundaries come from the timing feed, `even` when guessed. */
	miniSectors: 'timing' | 'even';
}

export interface TrackOutline {
	v: typeof TELEMETRY_VERSION;
	/** The timing feed's circuit key, e.g. "152" for Las Vegas. */
	circuitKey: string;
	name: string;
	lengthM: number;
	/**
	 * A closed loop in driving direction, `points[0]` on the start/finish line. The points are
	 * `lengthM / points.length` apart and the last one joins the first, so distance `d` is at
	 * index `d / step`.
	 */
	points: readonly Point[];
	/** Degrees to turn the outline (counter-clockwise, y up) to put its long side horizontal. */
	rotationDeg: number;
	/** Where sector 1 and sector 2 end. */
	sectorBoundariesM: readonly [number, number];
	/** Mini sectors in sectors 1, 2 and 3, as the timing feed counts them. */
	miniSectorsPerSector: readonly [number, number, number];
	/** Where each mini sector starts, ascending from 0; one entry per mini sector. */
	miniSectorStartsM: readonly number[];
	pitLane: PitLane | null;
	source: OutlineSource;
}

/** One lap as columns, one row per sample; the optional columns are absent without car data. */
export interface LapTelemetry {
	v: typeof TELEMETRY_VERSION;
	driverNumber: string;
	lap: number;
	/** The line crossing that began the lap, ISO 8601 UTC. */
	startedAt: string;
	lapTimeMs: number;
	/** Milliseconds since `startedAt`; the last row is the end of the lap. */
	t: readonly number[];
	/** Metres along the lap from the line; never decreases. */
	d: readonly number[];
	x: readonly number[];
	y: readonly number[];
	speed?: readonly number[];
	/** 0 to 100. */
	throttle?: readonly number[];
	/** 1 while braking. */
	brake?: readonly number[];
	/** 0 is neutral. */
	gear?: readonly number[];
	rpm?: readonly number[];
	/** 1 while the DRS flap is open; absent for seasons without DRS. */
	drs?: readonly number[];
}

export interface LapIndexEntry {
	driverNumber: string;
	lap: number;
	/** Path inside the session's telemetry folder. */
	file: string;
	startedAt: string;
	lapTimeMs: number;
	rows: number;
	distanceM: number;
	/** Size of the gzipped file. */
	bytes: number;
	/** The lap did not run line to line: the first lap of a standing start. */
	partial: boolean;
	pitIn: boolean;
	pitOut: boolean;
}

export interface LapIndex {
	v: typeof TELEMETRY_VERSION;
	sessionKey: number;
	circuitKey: string;
	stepMs: number;
	hasCarData: boolean;
	laps: readonly LapIndexEntry[];
}

export interface ReplayChunkRef {
	file: string;
	/** Milliseconds from `originAt` to this chunk's first sample. */
	t0: number;
	/** Samples in the chunk. */
	n: number;
	bytes: number;
}

export interface ReplayManifest {
	v: typeof TELEMETRY_VERSION;
	/** The time of sample 0 of chunk 0, ISO 8601 UTC. */
	originAt: string;
	stepMs: number;
	chunkMs: number;
	/** Positions are whole multiples of this many metres. */
	quantM: number;
	driverNumbers: readonly string[];
	chunks: readonly ReplayChunkRef[];
}

/** A car's samples in a chunk: the first value in quanta, then each change from the one before. */
export interface ReplayCar {
	x: readonly number[];
	y: readonly number[];
	/** Sample ranges `[from, to]` (inclusive) where the car was reported off the track. */
	off?: readonly (readonly [number, number])[];
}

export interface ReplayChunk {
	v: typeof TELEMETRY_VERSION;
	t0: number;
	stepMs: number;
	n: number;
	quantM: number;
	cars: { [driverNumber: string]: ReplayCar };
}

/**
 * Where the server is in fetching an older session's positions and car data from the archive and
 * building its telemetry: `GET` and `POST /telemetry-fetch/<key>` answer with it.
 */
export type TelemetryFetchStatus =
	| { state: 'idle' }
	| { state: 'queued'; ahead: number }
	| { state: 'fetching'; receivedBytes: number; totalBytes: number | null }
	| { state: 'building' }
	| { state: 'ready' }
	| { state: 'unavailable'; reason: string }
	| { state: 'failed'; message: string };

/** The live position frame: whole metres, and 1 when the car is on the track. */
export interface LivePositions {
	/** The time of the samples, ms since the Unix epoch. */
	at: number;
	cars: { [driverNumber: string]: readonly [x: number, y: number, onTrack: 0 | 1] };
}

/** The live car data frame: speed km/h, gear, throttle %, brake 0 or 1, rpm and DRS 0 or 1. */
export interface LiveCarData {
	at: number;
	cars: {
		[driverNumber: string]: readonly [
			speed: number,
			gear: number,
			throttle: number,
			brake: 0 | 1,
			rpm: number,
			drs: 0 | 1
		];
	};
}

/** A lap's time at each distance, for aligning laps. Both arrays never decrease. */
export interface LapClock {
	distanceM: ArrayLike<number>;
	timeMs: ArrayLike<number>;
}

export interface LapDelta {
	distanceM: number[];
	/** `other` time minus `reference` time at the distance: positive means `other` is behind. */
	deltaMs: number[];
}

export interface TrackProjection {
	/** Along the lap from the line, in `[0, lengthM)`. */
	distanceM: number;
	/** How far the point is from the line. */
	offsetM: number;
}

export interface TrackPosition {
	x: number;
	y: number;
	/** Direction of travel, radians from the x axis. */
	headingRad: number;
}

/** A hint keeps the search near where the car was; this much behind it and ahead, in points. */
const HINT_BACK_POINTS = 20;

const HINT_AHEAD_POINTS = 60;

/** A hinted match farther than this from the line may be the wrong place, so it is searched again. */
const HINT_MAX_OFFSET_M = 40;

export function outlineStepM(outline: TrackOutline): number {
	return outline.lengthM / outline.points.length;
}

export function wrapDistance(outline: TrackOutline, distanceM: number): number {
	const wrapped = distanceM % outline.lengthM;

	return wrapped < 0 ? wrapped + outline.lengthM : wrapped;
}

function pointAt(outline: TrackOutline, index: number): Point {
	const { points } = outline;
	const n = points.length;
	const point = points[((index % n) + n) % n];

	if (point === undefined) {
		throw new Error('The outline has no points');
	}

	return point;
}

/** Where the car is at `distanceM` along the lap, and which way the track points there. */
export function pointOnTrack(outline: TrackOutline, distanceM: number): TrackPosition {
	const position = wrapDistance(outline, distanceM) / outlineStepM(outline);
	const index = Math.floor(position);
	const share = position - index;
	const [x0, y0] = pointAt(outline, index);
	const [x1, y1] = pointAt(outline, index + 1);

	return {
		x: x0 + (x1 - x0) * share,
		y: y0 + (y1 - y0) * share,
		headingRad: Math.atan2(y1 - y0, x1 - x0)
	};
}

function nearestOnSegments(
	outline: TrackOutline,
	x: number,
	y: number,
	first: number,
	count: number
): TrackProjection {
	const step = outlineStepM(outline);
	let best = { distanceM: 0, offsetM: Number.POSITIVE_INFINITY };

	for (let index = first; index < first + count; index += 1) {
		const [x0, y0] = pointAt(outline, index);
		const [x1, y1] = pointAt(outline, index + 1);
		const dx = x1 - x0;
		const dy = y1 - y0;
		const length2 = dx * dx + dy * dy;

		const share =
			length2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - x0) * dx + (y - y0) * dy) / length2));

		const offsetM = Math.hypot(x - (x0 + dx * share), y - (y0 + dy * share));

		if (offsetM < best.offsetM) {
			best = { distanceM: (index + share) * step, offsetM };
		}
	}

	return { distanceM: wrapDistance(outline, best.distanceM), offsetM: best.offsetM };
}

/**
 * The distance along the lap of the point on the line nearest to `(x, y)`. With `hintM`, the
 * distance the car was at a moment ago, only the stretch around it is searched; without it, or
 * when that stretch holds nothing close, the whole loop is.
 */
export function projectToTrack(
	outline: TrackOutline,
	x: number,
	y: number,
	hintM?: number
): TrackProjection {
	if (hintM !== undefined) {
		const centre = Math.floor(wrapDistance(outline, hintM) / outlineStepM(outline));

		const near = nearestOnSegments(
			outline,
			x,
			y,
			centre - HINT_BACK_POINTS,
			HINT_BACK_POINTS + HINT_AHEAD_POINTS
		);

		if (near.offsetM <= HINT_MAX_OFFSET_M) {
			return near;
		}
	}

	return nearestOnSegments(outline, x, y, 0, outline.points.length);
}

/** The mini sector, from 0, that `distanceM` along the lap is in. */
export function miniSectorAt(outline: TrackOutline, distanceM: number): number {
	const position = wrapDistance(outline, distanceM);
	const starts = outline.miniSectorStartsM;
	let low = 0;
	let high = starts.length - 1;

	while (low < high) {
		const middle = Math.ceil((low + high) / 2);

		if ((starts[middle] ?? 0) <= position) {
			low = middle;
		} else {
			high = middle - 1;
		}
	}

	return low;
}

/** The mini sector a point on the circuit is in; `hintM` is as for `projectToTrack`. */
export function miniSectorOfPoint(
	outline: TrackOutline,
	x: number,
	y: number,
	hintM?: number
): number {
	return miniSectorAt(outline, projectToTrack(outline, x, y, hintM).distanceM);
}

/** The sector, 0 to 2, that `distanceM` along the lap is in. */
export function sectorAt(outline: TrackOutline, distanceM: number): 0 | 1 | 2 {
	const position = wrapDistance(outline, distanceM);
	const [first, second] = outline.sectorBoundariesM;

	if (position < first) {
		return 0;
	}

	return position < second ? 1 : 2;
}

/** The sector a mini sector belongs to, from the counts the timing feed gives. */
export function sectorOfMiniSector(outline: TrackOutline, miniSector: number): 0 | 1 | 2 {
	const [first, second] = outline.miniSectorsPerSector;

	if (miniSector < first) {
		return 0;
	}

	return miniSector < first + second ? 1 : 2;
}

/** The lap time at `distanceM`, interpolated between the two samples around it. */
export function timeAtDistance(lap: LapClock, distanceM: number): number {
	const last = lap.distanceM.length - 1;

	if (last < 0) {
		throw new Error('The lap has no samples');
	}

	let low = 0;
	let high = last;

	// The first sample at or past the distance.
	while (low < high) {
		const middle = (low + high) >> 1;

		if ((lap.distanceM[middle] ?? 0) < distanceM) {
			low = middle + 1;
		} else {
			high = middle;
		}
	}

	if (low === 0) {
		return lap.timeMs[0] ?? 0;
	}

	const d0 = lap.distanceM[low - 1] ?? 0;
	const d1 = lap.distanceM[low] ?? d0;
	const t0 = lap.timeMs[low - 1] ?? 0;
	const t1 = lap.timeMs[low] ?? t0;

	return d1 === d0 ? t1 : t0 + ((t1 - t0) * (distanceM - d0)) / (d1 - d0);
}

/**
 * How far `other` is ahead of or behind `reference` at every `stepM` of distance, as the
 * difference between the times each took to get there. Only the distance both laps cover is
 * compared, so the last point is a little before the line.
 */
export function alignLaps(reference: LapClock, other: LapClock, stepM: number): LapDelta {
	if (!(stepM > 0)) {
		throw new Error('The distance step must be positive');
	}

	const shared = Math.min(
		reference.distanceM[reference.distanceM.length - 1] ?? 0,
		other.distanceM[other.distanceM.length - 1] ?? 0
	);

	const delta: LapDelta = { distanceM: [], deltaMs: [] };

	for (let distance = 0; distance <= shared; distance += stepM) {
		delta.distanceM.push(distance);
		delta.deltaMs.push(timeAtDistance(other, distance) - timeAtDistance(reference, distance));
	}

	return delta;
}

/** A car's positions in metres. */
export interface ReplayPath {
	x: number[];
	y: number[];
}

/** A replay car's positions in metres, from the deltas in quanta that the chunk holds. */
export function expandReplayCar(car: ReplayCar, quantM: number): ReplayPath {
	const expand = (values: readonly number[]) => {
		let total = 0;

		return values.map((value) => {
			total += value;

			return total * quantM;
		});
	};

	return { x: expand(car.x), y: expand(car.y) };
}
