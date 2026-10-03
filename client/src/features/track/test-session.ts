import { readFileSync } from 'node:fs';

import { EMPTY_SNAPSHOT, type Lap, type RaceSnapshot, type SessionType } from '@f1-live/shared';

import { parseOutlineText } from '../../data/telemetry-source.ts';

/** Fixtures for the track tests: the real Las Vegas outline and laps made to measure. */

/** The 2025 Las Vegas circuit as the telemetry pipeline built it: 6145 m, sectors end at 1694 and 3369 m. */
export const LAS_VEGAS = parseOutlineText(
	readFileSync(new URL('../../data/mock/las-vegas-outline.json', import.meta.url), 'utf8')
);

export const START = Date.UTC(2025, 10, 23, 4, 4, 8);

/** Seconds after the start, as epoch ms. */
export function at(seconds: number): number {
	return START + seconds * 1000;
}

export function lapOf(
	driverNumber: string,
	lapNumber: number,
	crossedS: number,
	sectorsMs: readonly [number, number, number],
	flags: Partial<Pick<Lap, 'pitIn' | 'pitOut'>> = {}
): Lap {
	return {
		driverNumber,
		lap: lapNumber,
		lapTimeMs: sectorsMs[0] + sectorsMs[1] + sectorsMs[2],
		sectorTimesMs: sectorsMs,
		position: 1,
		gapToLeaderMs: 0,
		intervalMs: 0,
		compound: 'HARD',
		tyreAge: lapNumber,
		pitIn: flags.pitIn ?? false,
		pitOut: flags.pitOut ?? false,
		trackStatus: 'green',
		completedAt: new Date(at(crossedS)).toISOString()
	};
}

export function session(
	laps: readonly Lap[],
	type: SessionType = 'race',
	extra: Partial<RaceSnapshot> = {}
): RaceSnapshot {
	return {
		...EMPTY_SNAPSHOT,
		session: { ...EMPTY_SNAPSHOT.session, type, startsAt: '2025-11-23T04:00:00.000Z' },
		startedAt: new Date(START).toISOString(),
		startingGrid: [
			{ driverNumber: '1', position: 1 },
			{ driverNumber: '4', position: 2 }
		],
		laps,
		currentLap: Math.max(0, ...laps.map((lap) => lap.lap)),
		...extra
	};
}
