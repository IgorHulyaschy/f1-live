import type { Driver, Lap, RaceSnapshot } from '@f1-live/shared';

import { isCleanLap } from './clean-laps.ts';
import { type StandingRow, standingsAt } from './standings.ts';

/**
 * Pit-lane loss at Las Vegas including the slower out-lap: what a prediction assumes until the
 * session's own stops measure the circuit's.
 */
export const PIT_LOSS_MS = { green: 22_900, neutralised: 13_000 } as const;

/**
 * A stop under a Safety Car or VSC costs about this share of a green-flag one: the field is slow
 * while the car is in the lane. From the Las Vegas figures above.
 */
const NEUTRALISED_SHARE = PIT_LOSS_MS.neutralised / PIT_LOSS_MS.green;

/** Laps either side of a stop that set the pace it is measured against. */
const REFERENCE_LAPS = 4;

/** A measured loss outside this range is a slow stop, a problem or a flag: not the circuit's. */
const PLAUSIBLE_MS = [8_000, 45_000] as const;

export type MeasuredPitLoss = { greenMs: number; neutralisedMs: number; stops: number };

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
 * What a stop has cost at this circuit so far: the median of the session's green-flag stops,
 * each measured on its in-lap and out-lap; null before any.
 */
export function measuredPitLoss(snapshot: RaceSnapshot): MeasuredPitLoss | null {
	const byDriver = new Map<string, Map<number, Lap>>();

	for (const lap of snapshot.laps) {
		const own = byDriver.get(lap.driverNumber) ?? new Map<number, Lap>();

		own.set(lap.lap, lap);
		byDriver.set(lap.driverNumber, own);
	}

	const losses = snapshot.pitStops.flatMap((stop) => {
		const loss = stopLoss(byDriver.get(stop.driverNumber) ?? new Map(), stop.lap);

		return loss === null ? [] : [loss];
	});

	const greenMs = median(losses);

	return greenMs === null
		? null
		: { greenMs, neutralisedMs: greenMs * NEUTRALISED_SHARE, stops: losses.length };
}

export interface RejoinNeighbour {
	driver: Driver;
	/** Positive: how far that car is from the rejoining driver. */
	gapMs: number;
}

export interface RejoinPrediction {
	driver: Driver;
	currentPosition: number;
	rejoinPosition: number;
	pitLossMs: number;
	/** A Safety Car or VSC is out, so a stop costs less than usual. */
	cheapStop: boolean;
	carAhead: RejoinNeighbour | null;
	carBehind: RejoinNeighbour | null;
}

/** Race-time gap to the leader, extending lapped cars by a leader lap per lap down. */
function raceGapMs(row: StandingRow, leaderLapMs: number): number | null {
	if (row.state === 'out' || !row.lastLap) {
		return null;
	}

	return row.lapsDown === 0
		? row.lastLap.gapToLeaderMs
		: row.lastLap.gapToLeaderMs + row.lapsDown * leaderLapMs;
}

/** Where `driverNumber` would rejoin if they pitted at the end of the current lap. */
export function predictRejoin(
	snapshot: RaceSnapshot,
	driverNumber: string
): RejoinPrediction | null {
	const rows = standingsAt(snapshot);
	const leaderLapMs = rows[0]?.lastLap?.lapTimeMs ?? 0;
	const subject = rows.find((row) => row.driver.number === driverNumber);
	const subjectGap = subject ? raceGapMs(subject, leaderLapMs) : null;

	if (!subject || subjectGap === null) {
		return null;
	}

	const cheapStop = snapshot.trackStatus === 'vsc' || snapshot.trackStatus === 'safety_car';
	const measured = measuredPitLoss(snapshot);
	const green = measured?.greenMs ?? PIT_LOSS_MS.green;
	const pitLossMs = cheapStop ? (measured?.neutralisedMs ?? PIT_LOSS_MS.neutralised) : green;
	const rejoinGap = subjectGap + pitLossMs;
	let carAhead: RejoinNeighbour | null = null;
	let carBehind: RejoinNeighbour | null = null;
	let carsAhead = 0;

	for (const row of rows) {
		const gap = row === subject ? null : raceGapMs(row, leaderLapMs);

		if (gap === null) {
			continue;
		}

		if (gap < rejoinGap) {
			carsAhead++;

			if (!carAhead || rejoinGap - gap < carAhead.gapMs) {
				carAhead = { driver: row.driver, gapMs: rejoinGap - gap };
			}
		} else if (!carBehind || gap - rejoinGap < carBehind.gapMs) {
			carBehind = { driver: row.driver, gapMs: gap - rejoinGap };
		}
	}

	return {
		driver: subject.driver,
		currentPosition: subject.position,
		rejoinPosition: carsAhead + 1,
		pitLossMs,
		cheapStop,
		carAhead,
		carBehind
	};
}
