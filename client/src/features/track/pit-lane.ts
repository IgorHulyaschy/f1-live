import type { PitLane, Point, TrackOutline } from '@f1-live/shared';

/** The pit lane measured: its length and where along it the timing line crosses. */
export type LaneGeometry = {
	lane: PitLane;
	/** Metres from the entry at each point. */
	along: readonly number[];
	lengthM: number;
	/** Share of the lane before the point nearest the start/finish line, where laps are counted. */
	lineShare: number;
};

export function laneGeometry(outline: TrackOutline): LaneGeometry | null {
	const lane = outline.pitLane;

	if (!lane || lane.points.length < 2) {
		return null;
	}

	const along = [0];

	for (let index = 1; index < lane.points.length; index++) {
		const [x0, y0] = lane.points[index - 1] ?? [0, 0];
		const [x1, y1] = lane.points[index] ?? [0, 0];

		along.push((along[index - 1] ?? 0) + Math.hypot(x1 - x0, y1 - y0));
	}

	const lengthM = along.at(-1) ?? 0;
	const [lineX, lineY] = outline.points[0] ?? [0, 0];
	let nearest = 0;
	let nearestM = Infinity;

	lane.points.forEach(([x, y], index) => {
		const offset = Math.hypot(x - lineX, y - lineY);

		if (offset < nearestM) {
			nearestM = offset;
			nearest = index;
		}
	});

	return {
		lane,
		along,
		lengthM,
		lineShare: lengthM > 0 ? (along[nearest] ?? 0) / lengthM : 0.5
	};
}

/** The place `share` of the way down the lane, from the entry. */
export function pointInLane(geometry: LaneGeometry, share: number): Point {
	const target = Math.min(1, Math.max(0, share)) * geometry.lengthM;
	const { along, lane } = geometry;
	let index = 1;

	while (index < along.length - 1 && (along[index] ?? 0) < target) {
		index++;
	}

	const from = along[index - 1] ?? 0;
	const to = along[index] ?? from;
	const [x0, y0] = lane.points[index - 1] ?? [0, 0];
	const [x1, y1] = lane.points[index] ?? [x0, y0];
	const part = to > from ? (target - from) / (to - from) : 0;

	return [x0 + (x1 - x0) * part, y0 + (y1 - y0) * part];
}

/** Pit lane speed limit, m/s (80 km/h). */
export const PIT_SPEED_MPS = 80 / 3.6;
