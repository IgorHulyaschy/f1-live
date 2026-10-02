import type { Driver, RaceSnapshot } from '@f1-live/shared';

import { average, fuelCorrectedSeconds, isCleanLap } from './clean-laps.ts';
import { standingsAt } from './standings.ts';

const PACE_WINDOW_LAPS = 5;

/** Below this pace advantage per lap a catch projection is noise. */
const MIN_CLOSING_SECONDS_PER_LAP = 0.05;

export interface Battle {
	ahead: Driver;
	intervalSeconds: number;
	/** Positive when the driver behind is faster. */
	closingSecondsPerLap: number | null;
	lapsToCatch: number | null;
	catchesBeforeFlag: boolean;
}

function recentPace(snapshot: RaceSnapshot, driverNumber: string): number | null {
	const laps = snapshot.laps
		.filter((lap) => lap.driverNumber === driverNumber && isCleanLap(lap))
		.slice(-PACE_WINDOW_LAPS);

	return average(laps.map((lap) => fuelCorrectedSeconds(lap, snapshot.session.totalLaps)));
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

	const subjectPace = recentPace(snapshot, subject.driver.number);
	const aheadPace = recentPace(snapshot, ahead.driver.number);
	const closing = subjectPace !== null && aheadPace !== null ? aheadPace - subjectPace : null;
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
