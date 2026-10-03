import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EMPTY_SNAPSHOT, type Lap, type RaceSnapshot, type SessionStatus } from '@f1-live/shared';

import { snapshotAtTime } from '../data/snapshot-at-time.ts';
import { cutLines, qualifyingProgress, secondPartCars } from './qualifying.ts';
import { standingsAt } from './standings.ts';

const START_MS = Date.UTC(2026, 9, 3, 8, 0, 0);

function at(minutes: number): string {
	return new Date(START_MS + minutes * 60_000).toISOString();
}

function lap(driverNumber: string, lapNumber: number, minutes: number, lapTimeMs: number): Lap {
	return {
		driverNumber,
		lap: lapNumber,
		lapTimeMs,
		sectorTimesMs: [lapTimeMs / 3, lapTimeMs / 3, lapTimeMs / 3],
		position: 1,
		gapToLeaderMs: 0,
		intervalMs: 0,
		compound: 'SOFT',
		tyreAge: lapNumber,
		pitIn: false,
		pitOut: false,
		trackStatus: 'green',
		completedAt: at(minutes)
	};
}

const DRIVERS = Array.from({ length: 12 }, (_, index) => String(index + 1));

/**
 * Twelve cars, so 11 go through the first part and 10 the second. Car 12 is slowest in Q1;
 * in Q2 car 11 is slowest; in Q3 car 10 takes pole.
 */
function qualifying(statuses: readonly [number, SessionStatus][]): RaceSnapshot {
	const laps = [
		...DRIVERS.map((driver, index) => lap(driver, 2, 5, 90_000 + index * 100)),
		...DRIVERS.slice(0, 11).map((driver, index) => lap(driver, 4, 25, 89_000 + index * 100)),
		...DRIVERS.slice(0, 10).map((driver, index) => lap(driver, 6, 45, 88_000 - index * 50))
	];

	return {
		...EMPTY_SNAPSHOT,
		session: { ...EMPTY_SNAPSHOT.session, id: '11730', type: 'qualifying', startsAt: at(0) },
		drivers: DRIVERS.map((number) => ({
			number,
			code: `D${number}`,
			firstName: 'Test',
			lastName: `Driver ${number}`,
			team: 'Team',
			teamColour: '888888'
		})),
		laps,
		currentLap: 6,
		startedAt: at(0),
		statusLog: statuses.map(([minutes, status]) => ({ at: at(minutes), status })),
		status: statuses.at(-1)?.[1] ?? 'inactive'
	};
}

const FULL: readonly [number, SessionStatus][] = [
	[0, 'started'],
	[18, 'finished'],
	[20, 'inactive'],
	[22, 'started'],
	[30, 'aborted'],
	[32, 'started'],
	[37, 'finished'],
	[39, 'inactive'],
	[41, 'started'],
	[53, 'finished'],
	[60, 'finalised']
];

describe('qualifying', () => {
	it('sends 15 of 20 and 16 of 22 cars through the first part', () => {
		assert.equal(secondPartCars(20), 15);
		assert.equal(secondPartCars(22), 16);
	});

	it('counts a red-flag restart as the same part', () => {
		const snapshot = qualifying(FULL.slice(0, 6));

		assert.deepEqual(qualifyingProgress(snapshot), { part: 2, running: true, finished: false });
		assert.deepEqual(
			cutLines(snapshot, 12).map((line) => [line.after, line.label, line.settled]),
			[
				[10, 'Q2 drop zone', false],
				[11, 'Out in Q1', true]
			]
		);
	});

	it('ranks each part on its own times and keeps knocked-out cars under the line', () => {
		const rows = standingsAt(qualifying(FULL));

		assert.deepEqual(
			rows.map((row) => row.driver.number),
			['10', '9', '8', '7', '6', '5', '4', '3', '2', '1', '11', '12']
		);
		assert.equal(rows[0]?.gapToLeaderMs, 0);
		// Car 11 is measured against the fastest Q2 time, car 12 against the fastest Q1 time.
		assert.equal(rows[10]?.gapToLeaderMs, 1000);
		assert.equal(rows[11]?.gapToLeaderMs, 1100);
	});

	it('replays the order as it stood during the session', () => {
		const race = qualifying(FULL);
		const rows = standingsAt(snapshotAtTime(race, START_MS + 26 * 60_000));

		assert.deepEqual(
			rows.slice(0, 3).map((row) => row.driver.number),
			['1', '2', '3']
		);
		assert.equal(rows.at(-1)?.driver.number, '12');
		assert.deepEqual(
			cutLines(snapshotAtTime(race, START_MS + 26 * 60_000), 12).map((line) => line.label),
			['Q2 drop zone', 'Out in Q1']
		);
	});
});
