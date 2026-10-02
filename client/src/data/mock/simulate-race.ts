import type {
	Lap,
	PitStop,
	RaceControlMessage,
	RaceSnapshot,
	Retirement,
	Stint,
	TrackStatus,
	TyreCompound,
	WeatherSample
} from '@f1-live/shared';

import { MOCK_DRIVERS } from './drivers.ts';
import {
	REFERENCE_RACE_CONTROL,
	REFERENCE_RESULTS,
	REFERENCE_SESSION,
	REFERENCE_TOTAL_LAPS,
	REFERENCE_WEATHER,
	type ReferenceResult
} from './las-vegas-2025.ts';

/**
 * Lap-by-lap replay of the 2025 Las Vegas Grand Prix.
 *
 * Grid, strategies, retirements, race control, weather and the classification at the flag are
 * real (see las-vegas-2025.ts). Individual lap times are not in the reference data, so they are
 * modelled from fuel load, compound, tyre age and track status, then calibrated per driver so
 * that every finisher crosses the line with their real gap to the winner.
 */

/** Winner's lap time on new hards with an empty tank; anchors VER's real 1:33.365 on lap 50. */
const BASE_LAP_SECONDS = 92.85;

const FUEL_EFFECT_SECONDS_PER_LAP = 0.06;

/** Retirements have no finishing gap to calibrate against; they run at typical midfield pace. */
const RETIRED_PACE_DEFICIT_SECONDS = 0.9;

const STANDING_START_PENALTY_SECONDS = 7.5;

const GRID_SLOT_SECONDS = 0.22;

const PIT_LANE_SECONDS = 21.5;

const PIT_LANE_UNDER_VSC_SECONDS = 13;

const OUT_LAP_SECONDS = 1.4;

/** Sector split of VER's best lap: 26.350 / 31.156 / 35.859. */
const SECTOR_SPLIT = [0.2824, 0.3339, 0.3837] as const;

export const COMPOUND_MODEL: Readonly<
	Record<TyreCompound, { offsetSeconds: number; degradationSecondsPerLap: number }>
> = {
	SOFT: { offsetSeconds: -0.6, degradationSecondsPerLap: 0.08 },
	MEDIUM: { offsetSeconds: -0.3, degradationSecondsPerLap: 0.045 },
	HARD: { offsetSeconds: 0, degradationSecondsPerLap: 0.025 },
	INTERMEDIATE: { offsetSeconds: 6, degradationSecondsPerLap: 0.05 },
	WET: { offsetSeconds: 10, degradationSecondsPerLap: 0.05 },
	UNKNOWN: { offsetSeconds: 0, degradationSecondsPerLap: 0.05 }
};

/** Real VSC periods: deployed on lap 2 and ended on lap 4; deployed and ended on lap 16. */
const TRACK_STATUS_BY_LAP: ReadonlyMap<number, TrackStatus> = new Map([
	[1, 'yellow'],
	[2, 'vsc'],
	[3, 'vsc'],
	[4, 'vsc'],
	[16, 'vsc']
]);

const VSC_SLOWDOWN_BY_LAP: ReadonlyMap<number, number> = new Map([
	[2, 1.18],
	[3, 1.38],
	[4, 1.12],
	[16, 1.09]
]);

interface PlannedLap {
	lap: number;
	compound: TyreCompound;
	tyreAge: number;
	pitIn: boolean;
	pitOut: boolean;
	seconds: number;
}

/** Deterministic PRNG (mulberry32) so every replay, test and screenshot is identical. */
function createRandom(seed: number) {
	let state = seed;

	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let mixed = Math.imul(state ^ (state >>> 15), 1 | state);

		mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;

		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
	};
}

function trackStatusOnLap(lap: number): TrackStatus {
	return TRACK_STATUS_BY_LAP.get(lap) ?? 'green';
}

/** Expands stints into one entry per completed lap, clamped to the laps the driver completed. */
function planLaps(result: ReferenceResult, random: () => number): PlannedLap[] {
	const planned: PlannedLap[] = [];

	for (const [stintIndex, stint] of result.stints.entries()) {
		for (let age = 1; age <= stint.laps; age++) {
			const lap = planned.length + 1;

			if (lap > result.lapsCompleted) {
				return planned;
			}

			const isLastLapOfStint = age === stint.laps && stintIndex < result.stints.length - 1;
			const model = COMPOUND_MODEL[stint.compound];
			const noise = (random() - 0.5) * 0.45;

			let seconds =
				BASE_LAP_SECONDS +
				FUEL_EFFECT_SECONDS_PER_LAP * (REFERENCE_TOTAL_LAPS - lap) +
				model.offsetSeconds +
				model.degradationSecondsPerLap * age +
				noise;

			if (result.retired && lap > 1) {
				seconds += RETIRED_PACE_DEFICIT_SECONDS;
			}

			if (lap === 1) {
				seconds += STANDING_START_PENALTY_SECONDS + GRID_SLOT_SECONDS * (result.grid - 1);
			}

			seconds *= VSC_SLOWDOWN_BY_LAP.get(lap) ?? 1;

			if (isLastLapOfStint && lap < result.lapsCompleted) {
				seconds += trackStatusOnLap(lap) === 'vsc' ? PIT_LANE_UNDER_VSC_SECONDS : PIT_LANE_SECONDS;
			}

			const pitOut = stintIndex > 0 && age === 1;

			if (pitOut) {
				seconds += OUT_LAP_SECONDS;
			}

			planned.push({
				lap,
				compound: stint.compound,
				tyreAge: age,
				pitIn: isLastLapOfStint && lap < result.lapsCompleted,
				pitOut,
				seconds
			});
		}
	}

	return planned;
}

function sum(values: readonly number[]): number {
	let total = 0;

	for (const value of values) {
		total += value;
	}

	return total;
}

/**
 * Spreads a correction across green-flag laps so the total race time hits the target.
 * Laps under VSC, in-laps and out-laps keep their modelled time.
 */
function calibrate(planned: PlannedLap[], targetSeconds: number) {
	const adjustable = planned.filter(
		(lap) => trackStatusOnLap(lap.lap) === 'green' && !lap.pitIn && !lap.pitOut && lap.lap > 1
	);

	const correction = (targetSeconds - sum(planned.map((lap) => lap.seconds))) / adjustable.length;

	for (const lap of adjustable) {
		lap.seconds += correction;
	}
}

function cumulativeSeconds(planned: readonly PlannedLap[], throughLap: number): number {
	return sum(planned.slice(0, throughLap).map((lap) => lap.seconds));
}

function planRace(): Map<string, PlannedLap[]> {
	const random = createRandom(2025_11_22);
	const plans = new Map<string, PlannedLap[]>();

	for (const result of REFERENCE_RESULTS) {
		plans.set(result.driverNumber, planLaps(result, random));
	}

	const winner = plans.get('1');

	if (!winner) {
		throw new Error('Reference data has no winner');
	}

	const winnerTotal = sum(winner.map((lap) => lap.seconds));
	let previousFinisher: { plan: PlannedLap[]; result: ReferenceResult } | null = null;

	for (const result of REFERENCE_RESULTS) {
		const plan = plans.get(result.driverNumber) ?? [];

		if (result.gapSeconds !== null && result.driverNumber !== '1') {
			calibrate(plan, winnerTotal + result.gapSeconds);
		}

		// Lapped finishers: place them their real interval behind the car ahead, one lap down.
		if (result.gapSeconds === null && !result.retired && previousFinisher) {
			const aheadAtSameLap = cumulativeSeconds(previousFinisher.plan, result.lapsCompleted);

			calibrate(plan, aheadAtSameLap + (result.intervalSeconds ?? 5));
		}

		if (!result.retired) {
			previousFinisher = { plan, result };
		}
	}

	return plans;
}

function toMs(seconds: number): number {
	return Math.round(seconds * 1000);
}

function buildLaps(plans: ReadonlyMap<string, PlannedLap[]>): Lap[] {
	const laps: Lap[] = [];

	for (let lap = 1; lap <= REFERENCE_TOTAL_LAPS; lap++) {
		const crossings: { driverNumber: string; planned: PlannedLap; totalMs: number }[] = [];

		for (const [driverNumber, plan] of plans) {
			const planned = plan[lap - 1];

			if (planned) {
				crossings.push({ driverNumber, planned, totalMs: toMs(cumulativeSeconds(plan, lap)) });
			}
		}

		crossings.sort((a, b) => a.totalMs - b.totalMs);

		const leaderMs = crossings[0]?.totalMs ?? 0;

		for (const [index, crossing] of crossings.entries()) {
			const lapTimeMs = toMs(crossing.planned.seconds);
			const sector1 = Math.round(lapTimeMs * SECTOR_SPLIT[0]);
			const sector2 = Math.round(lapTimeMs * SECTOR_SPLIT[1]);

			laps.push({
				driverNumber: crossing.driverNumber,
				lap,
				lapTimeMs,
				sectorTimesMs: [sector1, sector2, lapTimeMs - sector1 - sector2],
				position: index + 1,
				gapToLeaderMs: crossing.totalMs - leaderMs,
				intervalMs: index === 0 ? 0 : crossing.totalMs - (crossings[index - 1]?.totalMs ?? 0),
				compound: crossing.planned.compound,
				tyreAge: crossing.planned.tyreAge,
				pitIn: crossing.planned.pitIn,
				pitOut: crossing.planned.pitOut,
				trackStatus: trackStatusOnLap(lap)
			});
		}
	}

	return laps;
}

function buildStints(): Stint[] {
	const stints: Stint[] = [];

	for (const result of REFERENCE_RESULTS) {
		let startLap = 1;

		for (const [index, stint] of result.stints.entries()) {
			if (startLap > result.lapsCompleted) {
				break;
			}

			const endLap = Math.min(startLap + stint.laps - 1, result.lapsCompleted);

			stints.push({
				driverNumber: result.driverNumber,
				stint: index + 1,
				compound: stint.compound,
				startLap,
				endLap
			});
			startLap = endLap + 1;
		}
	}

	return stints;
}

function buildPitStops(laps: readonly Lap[]): PitStop[] {
	return laps.flatMap((lap) =>
		lap.pitIn
			? [
					{
						driverNumber: lap.driverNumber,
						lap: lap.lap,
						laneTimeMs: toMs(
							lap.trackStatus === 'vsc'
								? PIT_LANE_UNDER_VSC_SECONDS
								: PIT_LANE_SECONDS + OUT_LAP_SECONDS
						)
					}
				]
			: []
	);
}

const RACE_CONTROL_DRIVER = /CARS? (\d+) \(/;

function buildRaceControl(): RaceControlMessage[] {
	return REFERENCE_RACE_CONTROL.map((message) => {
		const driverNumber = RACE_CONTROL_DRIVER.exec(message.message)?.[1];

		return driverNumber ? { ...message, driverNumber } : { ...message };
	});
}

/** Track cools through the night race; the starting sample is real, the drift is modelled. */
function buildWeather(): WeatherSample[] {
	const samples: WeatherSample[] = [];

	for (let lap = 1; lap <= REFERENCE_TOTAL_LAPS; lap++) {
		samples.push({
			lap,
			airTempC: Math.round((REFERENCE_WEATHER.airTempC - lap * 0.02) * 10) / 10,
			trackTempC: Math.round((REFERENCE_WEATHER.trackTempC - lap * 0.04) * 10) / 10,
			humidityPct: REFERENCE_WEATHER.humidityPct + Math.floor(lap / 10),
			windSpeedMs: REFERENCE_WEATHER.windSpeedMs,
			rainfall: false
		});
	}

	return samples;
}

function buildRetirements(): Retirement[] {
	return REFERENCE_RESULTS.filter((result) => result.retired).map((result) => ({
		driverNumber: result.driverNumber,
		lap: Math.max(result.lapsCompleted, 1),
		reason: 'Retired'
	}));
}

/** The full race; use `snapshotAtLap` for the state at a given lap. */
export function simulateLasVegas2025(): RaceSnapshot {
	const laps = buildLaps(planRace());

	return {
		session: REFERENCE_SESSION,
		currentLap: REFERENCE_TOTAL_LAPS,
		trackStatus: 'green',
		drivers: MOCK_DRIVERS,
		startingGrid: REFERENCE_RESULTS.map((result) => ({
			driverNumber: result.driverNumber,
			position: result.grid
		})),
		laps,
		stints: buildStints(),
		pitStops: buildPitStops(laps),
		raceControl: buildRaceControl(),
		weather: buildWeather(),
		retirements: buildRetirements()
	};
}
