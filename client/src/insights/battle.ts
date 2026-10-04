import type { Driver, Lap, RaceSnapshot, TyreCompound } from '@f1-live/shared';

import { average, isCleanLap, isNeutralised } from './clean-laps.ts';
import { ONE_SECOND_MS } from './rules.ts';
import { type StandingRow, standingsAt } from './standings.ts';

/** Laps compared for pace: the last few both cars drove clean. */
const PACE_WINDOW_LAPS = 5;

/** Laps further back than this say nothing about pace now. */
const PACE_LOOKBACK_LAPS = 10;

/** Fewer laps in common than this give no pace and no projection. */
const MIN_PACE_LAPS = 3;

/** Below this pace advantage per lap a catch projection is noise. */
const MIN_CLOSING_SECONDS_PER_LAP = 0.05;

/** Lap-to-lap timing noise: the narrowest a pace range gets. */
const MIN_SPREAD_SECONDS = 0.05;

/** A car projected further out than this is not in a fight coming up. */
export const FIGHT_HORIZON_LAPS = 10;

/** A stop this recent puts a car on fresh tyres. */
const FRESH_TYRE_LAPS = 5;

/** Tyres this many laps newer than the other car's are a reason it is faster. */
const TYRE_AGE_EDGE_LAPS = 5;

/** Closer than this to the car ahead is a fight: the one-second aid's range. */
export const FIGHT_GAP_SECONDS = ONE_SECOND_MS / 1000;

/** The pace of one car against another over the laps both drove clean. */
export interface PairPace {
	/** Seconds a lap the second car gains on the first; positive when it is faster. */
	secondsPerLap: number;
	/** How sure the rate is: the standard error of the lap differences, at least timing noise. */
	spreadSeconds: number;
	/** The laps compared, oldest first. */
	laps: readonly number[];
}

/** Laps until a gap is down to a target, as a range: the high end is null when it may never be. */
export type LapRange = readonly [low: number, high: number | null];

function lapsOf(snapshot: RaceSnapshot, driverNumber: string): Lap[] {
	return snapshot.laps.filter((lap) => lap.driverNumber === driverNumber);
}

/** The last lap a car was in the pit lane on, or 0 when it has not stopped. */
function lastStopLap(laps: readonly Lap[]): number {
	return laps.findLast((lap) => lap.pitIn || lap.pitOut)?.lap ?? 0;
}

/**
 * How much faster `second` is than `first`, lap for lap, over the last laps both drove clean since
 * either last stopped: comparing the same laps takes fuel, track and weather out. Null with too few
 * such laps, such as just after a stop or a safety car.
 */
export function pairPace(snapshot: RaceSnapshot, first: string, second: string): PairPace | null {
	const firstLaps = lapsOf(snapshot, first);
	const secondLaps = lapsOf(snapshot, second);

	const since = Math.max(
		lastStopLap(firstLaps),
		lastStopLap(secondLaps),
		snapshot.currentLap - PACE_LOOKBACK_LAPS
	);

	const theirs = new Map(secondLaps.map((lap) => [lap.lap, lap]));

	const pairs = firstLaps.flatMap((lap) => {
		const other = theirs.get(lap.lap);

		return lap.lap > since && other && isCleanLap(lap) && isCleanLap(other)
			? [{ lap: lap.lap, gain: (lap.lapTimeMs - other.lapTimeMs) / 1000 }]
			: [];
	});

	const recent = pairs.slice(-PACE_WINDOW_LAPS);
	const mean = average(recent.map((pair) => pair.gain));

	if (mean === null || recent.length < MIN_PACE_LAPS) {
		return null;
	}

	const variance =
		recent.reduce((total, pair) => total + (pair.gain - mean) ** 2, 0) / (recent.length - 1);

	return {
		secondsPerLap: mean,
		spreadSeconds: Math.max(Math.sqrt(variance / recent.length), MIN_SPREAD_SECONDS),
		laps: recent.map((pair) => pair.lap)
	};
}

/**
 * Laps until a car `gapSeconds` behind is `targetSeconds` behind, from its pace advantage and that
 * pace's spread. Null when it is not clearly closing.
 */
export function lapsToReach(
	gapSeconds: number,
	pace: PairPace,
	targetSeconds = FIGHT_GAP_SECONDS
): LapRange | null {
	const excess = gapSeconds - targetSeconds;

	if (excess <= 0) {
		return [0, 0];
	}

	if (pace.secondsPerLap < MIN_CLOSING_SECONDS_PER_LAP) {
		return null;
	}

	const fast = pace.secondsPerLap + pace.spreadSeconds;
	const slow = pace.secondsPerLap - pace.spreadSeconds;

	return [
		Math.ceil(excess / fast),
		slow >= MIN_CLOSING_SECONDS_PER_LAP ? Math.ceil(excess / slow) : null
	];
}

export interface Battle {
	ahead: Driver;
	intervalSeconds: number;
	/** Positive when the driver behind is faster. */
	closingSecondsPerLap: number | null;
	lapsToCatch: number | null;
	catchesBeforeFlag: boolean;
}

/** The fight with the car directly ahead, with a laps-to-catch projection from recent pace. */
export function battleAhead(snapshot: RaceSnapshot, driverNumber: string): Battle | null {
	const rows = standingsAt(snapshot);
	const index = rows.findIndex((row) => row.driver.number === driverNumber);
	const subject = rows[index];
	const ahead = rows[index - 1];

	if (!subject || !ahead || subject.intervalMs === null || subject.state === 'out') {
		return null;
	}

	const pace =
		subject.state === 'running' && ahead.state === 'running'
			? pairPace(snapshot, ahead.driver.number, subject.driver.number)
			: null;

	const closing = pace?.secondsPerLap ?? null;
	const intervalSeconds = subject.intervalMs / 1000;

	const lapsToCatch =
		closing !== null && closing >= MIN_CLOSING_SECONDS_PER_LAP
			? Math.ceil(intervalSeconds / closing)
			: null;

	return {
		ahead: ahead.driver,
		intervalSeconds,
		closingSecondsPerLap: closing,
		lapsToCatch,
		catchesBeforeFlag:
			lapsToCatch !== null && lapsToCatch <= snapshot.session.totalLaps - snapshot.currentLap
	};
}

/** Why the car behind is quicker, when its tyres say so. */
export type FightReason =
	| { kind: 'fresh-tyres'; lapsSinceStop: number }
	| { kind: 'compound'; behind: TyreCompound; ahead: TyreCompound }
	| { kind: 'tyre-age'; newerLaps: number };

const DRY_ORDER: Partial<Record<TyreCompound, number>> = { SOFT: 0, MEDIUM: 1, HARD: 2 };

export interface Fight {
	ahead: StandingRow;
	behind: StandingRow;
	gapSeconds: number;
	/** The car behind against the car ahead: positive when it is closing. */
	pace: PairPace | null;
	/** Laps until the car behind is within a second: [0, 0] when it already is. */
	within: LapRange;
	reason: FightReason | null;
}

function fightReason(snapshot: RaceSnapshot, ahead: StandingRow, behind: StandingRow) {
	const sinceStop = snapshot.currentLap - lastStopLap(lapsOf(snapshot, behind.driver.number));
	const aheadSinceStop = snapshot.currentLap - lastStopLap(lapsOf(snapshot, ahead.driver.number));
	const behindOrder = behind.compound ? DRY_ORDER[behind.compound] : undefined;
	const aheadOrder = ahead.compound ? DRY_ORDER[ahead.compound] : undefined;

	if (sinceStop < FRESH_TYRE_LAPS && sinceStop < aheadSinceStop) {
		return { kind: 'fresh-tyres', lapsSinceStop: sinceStop } as const;
	}

	if (
		behind.compound &&
		ahead.compound &&
		behindOrder !== undefined &&
		aheadOrder !== undefined &&
		behindOrder < aheadOrder
	) {
		return { kind: 'compound', behind: behind.compound, ahead: ahead.compound } as const;
	}

	return ahead.tyreAge - behind.tyreAge >= TYRE_AGE_EDGE_LAPS
		? ({ kind: 'tyre-age', newerLaps: ahead.tyreAge - behind.tyreAge } as const)
		: null;
}

/**
 * Every pair of cars on track in a fight now (within a second) or soon (clearly closing, projected to
 * be within a second inside the horizon and before the flag), the soonest first. Neutralised laps
 * freeze the order, so there are none under a safety car or a Virtual Safety Car.
 */
export function fights(
	snapshot: RaceSnapshot,
	rows: readonly StandingRow[] = standingsAt(snapshot)
): Fight[] {
	if (isNeutralised(snapshot) || snapshot.trackStatus === 'red') {
		return [];
	}

	const lapsLeft = snapshot.session.totalLaps - snapshot.currentLap;

	const found = rows.flatMap((behind, index): Fight[] => {
		const ahead = rows[index - 1];

		if (
			!ahead ||
			behind.state !== 'running' ||
			ahead.state !== 'running' ||
			behind.intervalMs === null ||
			behind.lapsDown !== ahead.lapsDown
		) {
			return [];
		}

		const gapSeconds = behind.intervalMs / 1000;
		const pace = pairPace(snapshot, ahead.driver.number, behind.driver.number);

		const within =
			gapSeconds <= FIGHT_GAP_SECONDS ? ([0, 0] as const) : pace && lapsToReach(gapSeconds, pace);

		// A car that may never get there is not in a fight coming up.
		if (!within || within[1] === null || within[0] > Math.min(FIGHT_HORIZON_LAPS, lapsLeft)) {
			return [];
		}

		return [
			{ ahead, behind, gapSeconds, pace, within, reason: fightReason(snapshot, ahead, behind) }
		];
	});

	return found.toSorted((a, b) => a.within[0] - b.within[0] || a.gapSeconds - b.gapSeconds);
}
