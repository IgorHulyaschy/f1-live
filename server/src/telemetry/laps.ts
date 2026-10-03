import { TELEMETRY_VERSION } from '@f1-live/shared';
import type { LapTelemetry } from '@f1-live/shared';

import { distanceAt, interpolate, nearest } from './series.js';
import type { CarDataTrack, CarDistance } from './series.js';

/** Rows are this far apart in time, like the feed's own samples. */
export const LAP_STEP_MS = 250;

export interface LapWindow {
	driverNumber: string;
	lap: number;
	/** The line crossings that begin and end the lap, ms since the Unix epoch. */
	startAt: number;
	endAt: number;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * One lap as columns. Position and car data are sampled at different instants, so every row is
 * a moment on a fixed grid, with each channel read between the samples around it: continuous
 * ones are interpolated, gear, brake and DRS take the nearest sample.
 */
export function buildLapTelemetry(
	car: CarDistance,
	carData: CarDataTrack | undefined,
	lap: LapWindow
): LapTelemetry {
	const duration = Math.round(lap.endAt - lap.startAt);
	const times: number[] = [];

	for (let t = 0; t < duration; t += LAP_STEP_MS) {
		times.push(t);
	}

	times.push(duration);

	const startDistance = distanceAt(car, lap.startAt);
	const at = (t: number) => lap.startAt + t;
	const { track } = car;

	const telemetry: LapTelemetry = {
		v: TELEMETRY_VERSION,
		driverNumber: lap.driverNumber,
		lap: lap.lap,
		startedAt: new Date(lap.startAt).toISOString(),
		lapTimeMs: duration,
		t: times,
		d: times.map((t) => round1(Math.max(0, distanceAt(car, at(t)) - startDistance))),
		x: times.map((t) => round1(interpolate(track.at, track.x, at(t)))),
		y: times.map((t) => round1(interpolate(track.at, track.y, at(t))))
	};

	if (carData === undefined) {
		return telemetry;
	}

	const withCarData: LapTelemetry = {
		...telemetry,
		speed: times.map((t) => Math.round(interpolate(carData.at, carData.speedKph, at(t)))),
		throttle: times.map((t) => Math.round(interpolate(carData.at, carData.throttle, at(t)))),
		brake: times.map((t) => nearest(carData.at, carData.brake, at(t))),
		gear: times.map((t) => nearest(carData.at, carData.gear, at(t))),
		rpm: times.map((t) => Math.round(interpolate(carData.at, carData.rpm, at(t))))
	};

	if (carData.drsOpen === null) {
		return withCarData;
	}

	const { drsOpen } = carData;

	return { ...withCarData, drs: times.map((t) => nearest(carData.at, drsOpen, at(t))) };
}
