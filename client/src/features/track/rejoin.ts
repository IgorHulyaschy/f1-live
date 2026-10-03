import type { RaceSnapshot, TrackOutline } from '@f1-live/shared';

import { measuredPitLoss, PIT_LOSS_MS } from '../../insights/pit-window.ts';
import { type LaneGeometry, PIT_SPEED_MPS } from './pit-lane.ts';

/**
 * What a stop costs at this circuit: time lost against staying out, at green-flag pace and under
 * a Safety Car or VSC, and where the figure comes from.
 */
export type PitLoss = {
	greenMs: number;
	neutralisedMs: number;
	/** `stops`: measured from this session's stops; `lane`: from the pit lane's length. */
	source: 'stops' | 'lane';
	/** Stops measured. */
	stops: number;
};

/** Time stationary in the box, and lost slowing for the lane and joining again. */
const STATIONARY_MS = 2_500;

const IN_AND_OUT_MS = 3_000;

/**
 * The circuit's pit loss from the data: the median of this session's green-flag stops, measured
 * on the laps around them; before any stop, from the pit lane: its length at the speed limit,
 * the stop and the slowing, less the stretch of track it bypasses at the session's pace.
 */
export function pitLoss(
	race: RaceSnapshot,
	outline: TrackOutline,
	lane: LaneGeometry | null,
	typicalLapMs: number
): PitLoss {
	const measured = measuredPitLoss(race);

	if (measured) {
		return { ...measured, source: 'stops' };
	}

	const laneMs = lane ? (lane.lengthM / PIT_SPEED_MPS) * 1000 : 16_000;
	const bypassM = lane ? outline.lengthM - lane.lane.entryM + lane.lane.exitM : 300;
	const bypassMs = (bypassM / outline.lengthM) * typicalLapMs;
	const greenMs = laneMs + STATIONARY_MS + IN_AND_OUT_MS - bypassMs;

	return {
		greenMs,
		neutralisedMs: greenMs * (PIT_LOSS_MS.neutralised / PIT_LOSS_MS.green),
		source: 'lane',
		stops: 0
	};
}

export type RoadCar = { driverNumber: string; progress: number };

export type Rejoin = {
	/** The place the car would hold on the road, counting cars by how far round they are. */
	position: number;
	ahead: RoadCar | null;
	behind: RoadCar | null;
};

/**
 * Where a car `ghostProgress` round the lap rejoins among `cars`: the cars further round are
 * ahead of it. The car itself is left out.
 */
export function rejoinAmong(
	cars: readonly RoadCar[],
	driverNumber: string,
	ghostProgress: number
): Rejoin {
	let ahead: RoadCar | null = null;
	let behind: RoadCar | null = null;
	let position = 1;

	for (const car of cars) {
		if (car.driverNumber === driverNumber || !Number.isFinite(car.progress)) {
			continue;
		}

		if (car.progress > ghostProgress) {
			position++;

			if (!ahead || car.progress < ahead.progress) {
				ahead = car;
			}
		} else if (!behind || car.progress > behind.progress) {
			behind = car;
		}
	}

	return { position, ahead, behind };
}
