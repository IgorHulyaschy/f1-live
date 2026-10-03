import { pointOnTrack, projectToTrack, type TrackOutline } from '@f1-live/shared';

import { type EstimateModel, estimateCar, type TrackPlace } from './estimate.ts';
import { type LaneGeometry, pointInLane } from './pit-lane.ts';
import type { CarSample } from './replay-positions.ts';

export type CarState = 'track' | 'pit' | 'off';

/** A car drawn on the map: where, which way it points, and how far round it is. */
export type CarPlace = {
	driverNumber: string;
	x: number;
	y: number;
	headingRad: number;
	/** Along the lap from the line; null in the pit lane. */
	distanceM: number | null;
	/** Laps done plus the share of the lap in progress: the order on the road. */
	progress: number;
	state: CarState;
};

/** Where the places come from: the feed's car positions, or timing alone. */
export type PlaceSource = 'positions' | 'estimated';

/** Off the racing line by more than this, a car with positions is in the pit lane or off. */
const OFF_LINE_M = 18;

/** Within this of the pit lane, a car off the racing line is in the lane. */
const IN_LANE_M = 16;

function distanceToLane(lane: LaneGeometry, x: number, y: number): number {
	let nearest = Infinity;
	const { points } = lane.lane;

	for (let index = 1; index < points.length; index++) {
		const [x0, y0] = points[index - 1] ?? [0, 0];
		const [x1, y1] = points[index] ?? [0, 0];
		const dx = x1 - x0;
		const dy = y1 - y0;
		const length2 = dx * dx + dy * dy;

		const share =
			length2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - x0) * dx + (y - y0) * dy) / length2));

		nearest = Math.min(nearest, Math.hypot(x - (x0 + dx * share), y - (y0 + dy * share)));
	}

	return nearest;
}

/** A car from timing alone, put on the outline or in the pit lane. */
export function placeFromEstimate(
	outline: TrackOutline,
	lane: LaneGeometry | null,
	driverNumber: string,
	place: TrackPlace,
	progress: number
): CarPlace | null {
	if (place.kind === 'track') {
		const point = pointOnTrack(outline, place.distanceM);

		return { driverNumber, ...point, distanceM: place.distanceM, progress, state: 'track' };
	}

	if (place.kind === 'pit' && lane) {
		const [x, y] = pointInLane(lane, place.laneShare);
		const ahead = pointInLane(lane, Math.min(1, place.laneShare + 0.02));

		return {
			driverNumber,
			x,
			y,
			headingRad: Math.atan2(ahead[1] - y, ahead[0] - x),
			distanceM: null,
			progress,
			state: 'pit'
		};
	}

	return null;
}

/**
 * A car from its position: found on the outline to know how far round it is, and in the pit lane
 * or off the track when it is far from the racing line. `lapsDone` and `hintM` come from timing
 * and the frame before.
 */
export function placeFromPosition(
	outline: TrackOutline,
	lane: LaneGeometry | null,
	driverNumber: string,
	sample: CarSample,
	lapsDone: number,
	lastCrossingAgoMs: number,
	hintM: number | undefined
): CarPlace {
	const projection = projectToTrack(outline, sample.x, sample.y, hintM);
	const onLine = pointOnTrack(outline, projection.distanceM);
	const share = projection.distanceM / outline.lengthM;

	// Near the line the position and the timing can disagree for a moment about the lap.
	const lapsBefore =
		share > 0.8 && lastCrossingAgoMs < 20_000
			? lapsDone - 1
			: share < 0.2 && lastCrossingAgoMs > 60_000
				? lapsDone + 1
				: lapsDone;

	let state: CarState = sample.offTrack ? 'off' : 'track';

	if (projection.offsetM > OFF_LINE_M) {
		state = lane && distanceToLane(lane, sample.x, sample.y) < IN_LANE_M ? 'pit' : 'off';
	}

	return {
		driverNumber,
		x: sample.x,
		y: sample.y,
		headingRad: onLine.headingRad,
		distanceM: state === 'pit' ? null : projection.distanceM,
		progress: lapsBefore + share,
		state
	};
}

/** Every running car at `time` from timing alone. */
export function estimatedPlaces(
	model: EstimateModel,
	driverNumbers: readonly string[],
	time: number
): CarPlace[] {
	return driverNumbers.flatMap((driverNumber) => {
		const estimate = estimateCar(model, driverNumber, time);

		return (
			placeFromEstimate(
				model.outline,
				model.lane,
				driverNumber,
				estimate.place,
				estimate.progress
			) ?? []
		);
	});
}

/** Laps a car had completed by a moment, and how long before it last crossed the line. */
export type LapsDone = { done: number; agoMs: number };

/** Laps a car had completed by `time`, and how long ago it last crossed the line. */
export function lapsAt(
	crossings: ReadonlyMap<string, readonly number[]>,
	driverNumber: string,
	time: number
): LapsDone {
	const own = crossings.get(driverNumber) ?? [];
	let done = 0;

	for (let lap = 1; lap < own.length; lap++) {
		const crossed = own[lap];

		if (crossed !== undefined && crossed <= time) {
			done = lap;
		}
	}

	return { done, agoMs: time - (own[done] ?? time) };
}
