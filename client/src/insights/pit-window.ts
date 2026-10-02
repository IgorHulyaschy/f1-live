import type { Driver, RaceSnapshot } from '@f1-live/shared';

import { type StandingRow, standingsAt } from './standings.ts';

/** Pit-lane loss at Las Vegas including the slower out-lap; an estimate per circuit. */
export const PIT_LOSS_MS = { green: 22_900, neutralised: 13_000 } as const;

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
	const pitLossMs = cheapStop ? PIT_LOSS_MS.neutralised : PIT_LOSS_MS.green;
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
