import type { Lap, LapTelemetry, RaceSnapshot } from '@f1-live/shared';

import { isKnockout, partOfLap, partStarts } from './qualifying.ts';
import { countedLaps, type StandingRow } from './standings.ts';

/** A part of qualifying (1, 2 or 3), or the whole session's best laps. */
export type GapPart = 'best' | 1 | 2 | 3;

/** One car on the straight: how far behind the car in front of the field it is, and why. */
export type GapCar = {
	driverNumber: string;
	/** Its place in this view, from 1. */
	position: number;
	/** The lap it is placed by; null in a race, where the gap comes from the timing. */
	lap: Lap | null;
	gapMs: number;
	metres: number;
	/** Placed by a speed, not its own telemetry. */
	estimated: boolean;
};

export type GapField = {
	cars: GapCar[];
	/** The lap time of the car in front, for its label; null in a race. */
	leaderMs: number | null;
};

/** A car's distance behind, and whether it came from a speed rather than its own telemetry. */
export type MetreGap = { metres: number; estimated: boolean };

/** One sector's order, from 1. */
export type SectorGapField = { sector: number; field: GapField };

/** The parts of telemetry the gap reads: the lap's own clock and how fast the car went. */
export type GapTelemetry = Pick<LapTelemetry, 't' | 'd' | 'speed' | 'lapTimeMs'>;

/** A channel's value at `at`, between its samples at `times`; the ends hold past either side. */
export function valueAtTime(
	times: readonly number[],
	values: readonly number[],
	at: number
): number {
	let low = 0;
	let high = times.length - 1;

	if (high < 0) {
		return 0;
	}

	// The first sample at or past the time.
	while (low < high) {
		const middle = (low + high) >> 1;

		if ((times[middle] ?? 0) < at) {
			low = middle + 1;
		} else {
			high = middle;
		}
	}

	if (low === 0) {
		return values[0] ?? 0;
	}

	const t0 = times[low - 1] ?? 0;
	const t1 = times[low] ?? t0;
	const v0 = values[low - 1] ?? 0;
	const v1 = values[low] ?? v0;

	return t1 === t0 ? v1 : v0 + ((v1 - v0) * (at - t0)) / (t1 - t0);
}

/** Metres run by each sample, from 0, integrating a speed channel in km/h over its times in ms. */
export function speedRun(times: readonly number[], kph: readonly number[]): number[] {
	const run = [0];

	for (let index = 1; index < times.length; index++) {
		const seconds = ((times[index] ?? 0) - (times[index - 1] ?? 0)) / 1000;
		const mean = ((kph[index] ?? 0) + (kph[index - 1] ?? 0)) / 2;

		run.push((run[index - 1] ?? 0) + (mean / 3.6) * seconds);
	}

	return run;
}

/**
 * Metres a car covered in the last `ms` of its lap. The speed channel is integrated where there
 * is one: positions jump by several metres between samples, the speed does not.
 */
export function distanceInLastMs(lap: GapTelemetry, ms: number): number {
	if (ms <= 0) {
		return 0;
	}

	const from = Math.max(0, (lap.t.at(-1) ?? lap.lapTimeMs) - ms);
	const along = lap.speed && lap.speed.length === lap.t.length ? speedRun(lap.t, lap.speed) : lap.d;

	return (along.at(-1) ?? 0) - valueAtTime(lap.t, along, from);
}

/**
 * How far behind the car in front a car is when that car crosses the line: the distance it
 * still has to run, in the time it is behind. Telemetry clocks run a few tens of milliseconds
 * off the official timing, so the time behind is taken from the official lap times and scaled
 * onto the car's own clock. Without telemetry the gap is run at the car's speed over the line,
 * or its average speed round the lap, and marked as an estimate.
 */
export function metreGap({
	gapMs,
	lapMs,
	telemetry,
	lineSpeedKph,
	lengthM
}: {
	gapMs: number;
	lapMs: number;
	telemetry: GapTelemetry | null;
	lineSpeedKph: number | null;
	lengthM: number;
}): MetreGap {
	if (gapMs <= 0) {
		return { metres: 0, estimated: telemetry === null };
	}

	if (telemetry && telemetry.t.length > 1 && lapMs > 0) {
		return {
			metres: distanceInLastMs(telemetry, (gapMs * telemetry.lapTimeMs) / lapMs),
			estimated: false
		};
	}

	const metresPerMs =
		lineSpeedKph !== null && lineSpeedKph > 0 ? lineSpeedKph / 3600 : lengthM / Math.max(1, lapMs);

	return { metres: gapMs * metresPerMs, estimated: true };
}

/**
 * Each driver's best lap that counts, fastest first: in one part of qualifying, or over the
 * whole session. Out, in and cool-down laps and laps the stewards deleted are left out.
 */
export function bestLaps(snapshot: RaceSnapshot, part: GapPart): Lap[] {
	const starts = isKnockout(snapshot.session.type) ? partStarts(snapshot) : [];
	const best = new Map<string, Lap>();

	for (const lap of countedLaps(snapshot)) {
		if (part !== 'best' && partOfLap(lap, starts) !== part) {
			continue;
		}

		const known = best.get(lap.driverNumber);

		if (!known || lap.lapTimeMs < known.lapTimeMs) {
			best.set(lap.driverNumber, lap);
		}
	}

	return [...best.values()].toSorted((a, b) => a.lapTimeMs - b.lapTimeMs);
}

/** The parts of the session with a time in them: 1 to 3 in qualifying, none otherwise. */
export function timedParts(snapshot: RaceSnapshot): (1 | 2 | 3)[] {
	if (!isKnockout(snapshot.session.type)) {
		return [];
	}

	return ([1, 2, 3] as const).filter((part) => bestLaps(snapshot, part).length > 0);
}

/**
 * The field on the straight by best laps: each car behind the fastest by the distance its time
 * is worth. `telemetryOf` gives a lap's telemetry where it has loaded.
 */
export function lapGapField(
	laps: readonly Lap[],
	telemetryOf: (lap: Lap) => GapTelemetry | null,
	lineSpeedOf: (driverNumber: string) => number | null,
	lengthM: number
): GapField {
	const leader = laps[0];

	if (!leader) {
		return { cars: [], leaderMs: null };
	}

	return {
		leaderMs: leader.lapTimeMs,
		cars: laps.map((lap, index): GapCar => {
			const gapMs = lap.lapTimeMs - leader.lapTimeMs;

			return {
				driverNumber: lap.driverNumber,
				position: index + 1,
				lap,
				gapMs,
				...metreGap({
					gapMs,
					lapMs: lap.lapTimeMs,
					telemetry: telemetryOf(lap),
					lineSpeedKph: lineSpeedOf(lap.driverNumber),
					lengthM
				})
			};
		})
	};
}

/**
 * The race on the straight: each running car behind the leader by its gap, run at the leader's
 * average speed over its last lap. Lapped cars and cars out are left off.
 */
export function raceGapField(rows: readonly StandingRow[], lengthM: number): GapField {
	const running = rows.filter(
		(row) => row.state !== 'out' && row.lapsDown === 0 && row.gapToLeaderMs !== null
	);

	const leaderLapMs = running[0]?.lastLap?.lapTimeMs ?? 0;
	const metresPerMs = leaderLapMs > 0 ? lengthM / leaderLapMs : 0;

	return {
		leaderMs: null,
		cars: running.map((row, index) => {
			const gapMs = index === 0 ? 0 : (row.gapToLeaderMs ?? 0);

			return {
				driverNumber: row.driver.number,
				position: row.position,
				lap: null,
				gapMs,
				metres: gapMs * metresPerMs,
				estimated: true
			};
		})
	};
}

/**
 * Who loses where: in each sector, every car behind the quickest through it by the time it lost
 * there, run at that sector's average speed for the quickest.
 */
export function sectorGapFields(
	laps: readonly Lap[],
	sectorLengthsM: readonly [number, number, number]
): SectorGapField[] {
	const field = (sector: 0 | 1 | 2): GapField => {
		const timed = laps
			.filter((lap) => lap.sectorTimesMs[sector] > 0)
			.toSorted((a, b) => a.sectorTimesMs[sector] - b.sectorTimesMs[sector]);

		const fastest = timed[0]?.sectorTimesMs[sector] ?? 0;
		const metresPerMs = fastest > 0 ? sectorLengthsM[sector] / fastest : 0;

		return {
			leaderMs: fastest > 0 ? fastest : null,
			cars: timed.map((lap, index) => {
				const gapMs = lap.sectorTimesMs[sector] - fastest;

				return {
					driverNumber: lap.driverNumber,
					position: index + 1,
					lap,
					gapMs,
					metres: gapMs * metresPerMs,
					estimated: true
				};
			})
		};
	};

	return ([0, 1, 2] as const).map((sector) => ({ sector: sector + 1, field: field(sector) }));
}
