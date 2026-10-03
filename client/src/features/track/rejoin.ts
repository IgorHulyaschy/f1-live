import type { Lap, RaceSnapshot, TrackOutline } from '@f1-live/shared';

import { isCleanLap } from '../../insights/clean-laps.ts';
import { type LaneGeometry, PIT_SPEED_MS } from './pit-lane.ts';

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

/** Laps either side of a stop that set the pace it is measured against. */
const REFERENCE_LAPS = 4;

/** A measured loss outside this range is a slow stop, a problem or a flag: not the circuit's. */
const PLAUSIBLE_MS = [8_000, 45_000] as const;

/**
 * A stop under a Safety Car or VSC costs about this share of a green-flag one: the field is slow
 * while the car is in the lane. From the 2025 Las Vegas race, 13.0 s against 22.9 s.
 */
const NEUTRALISED_SHARE = 0.57;

/** Time stationary in the box, and lost slowing for the lane and joining again. */
const STATIONARY_MS = 2_500;

const IN_AND_OUT_MS = 3_000;

function median(values: readonly number[]): number | null {
	const sorted = values.toSorted((a, b) => a - b);

	return sorted.length === 0 ? null : (sorted[sorted.length >> 1] ?? null);
}

/** One stop's cost: in-lap and out-lap against the driver's clean laps around them. */
function stopLoss(laps: ReadonlyMap<number, Lap>, inLap: number): number | null {
	const into = laps.get(inLap);
	const out = laps.get(inLap + 1);

	if (!into || !out || into.trackStatus !== 'green' || out.trackStatus !== 'green') {
		return null;
	}

	const reference = median(
		[...laps.values()].flatMap((lap) =>
			isCleanLap(lap) &&
			Math.abs(lap.lap - inLap) <= REFERENCE_LAPS + 1 &&
			lap.lap !== inLap &&
			lap.lap !== inLap + 1
				? [lap.lapTimeMs]
				: []
		)
	);

	if (reference === null || into.lapTimeMs <= 0 || out.lapTimeMs <= 0) {
		return null;
	}

	const loss = into.lapTimeMs + out.lapTimeMs - 2 * reference;

	return loss >= PLAUSIBLE_MS[0] && loss <= PLAUSIBLE_MS[1] ? loss : null;
}

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
	const byDriver = new Map<string, Map<number, Lap>>();

	for (const lap of race.laps) {
		const own = byDriver.get(lap.driverNumber) ?? new Map<number, Lap>();

		own.set(lap.lap, lap);
		byDriver.set(lap.driverNumber, own);
	}

	const losses = race.pitStops.flatMap((stop) => {
		const loss = stopLoss(byDriver.get(stop.driverNumber) ?? new Map(), stop.lap);

		return loss === null ? [] : [loss];
	});

	const measured = median(losses);

	if (measured !== null) {
		return {
			greenMs: measured,
			neutralisedMs: measured * NEUTRALISED_SHARE,
			source: 'stops',
			stops: losses.length
		};
	}

	const laneMs = lane ? (lane.lengthM / PIT_SPEED_MS) * 1000 : 16_000;
	const bypassM = lane ? outline.lengthM - lane.lane.entryM + lane.lane.exitM : 300;
	const bypassMs = (bypassM / outline.lengthM) * typicalLapMs;
	const greenMs = laneMs + STATIONARY_MS + IN_AND_OUT_MS - bypassMs;

	return { greenMs, neutralisedMs: greenMs * NEUTRALISED_SHARE, source: 'lane', stops: 0 };
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
