import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EMPTY_SNAPSHOT } from '@f1-live/shared';
import type { Lap, Penalty, RaceSnapshot, Standing } from '@f1-live/shared';

import { unservedPenalties } from './unserved-penalties.js';

function penalty(driverNumber: string, lap: number, seconds: number): Penalty {
	return {
		driverNumber,
		kind: 'time',
		seconds,
		reason: 'CAUSING A COLLISION',
		lap,
		status: 'issued'
	};
}

function lastLap(
	driverNumber: string,
	lap: number,
	gapToLeaderMs: number,
	lapTimeMs = 95_000
): Lap {
	return {
		driverNumber,
		lap,
		lapTimeMs,
		sectorTimesMs: [30_000, 30_000, 35_000],
		position: 1,
		gapToLeaderMs,
		intervalMs: 0,
		compound: 'MEDIUM',
		tyreAge: 10,
		pitIn: false,
		pitOut: false,
		trackStatus: 'green'
	};
}

function standing(driverNumber: string, position: number, gapToLeaderMs: number): Standing {
	return {
		driverNumber,
		position,
		gapToLeaderMs,
		intervalMs: 0,
		lapsCompleted: 56,
		inPit: false,
		retired: false,
		disqualified: false
	};
}

function race(overrides: Partial<RaceSnapshot>): RaceSnapshot {
	return { ...EMPTY_SNAPSHOT, ...overrides };
}

describe('unservedPenalties', () => {
	// 2018 Chinese and British Grands Prix: Verstappen's 10 s on lap 46 came after his last stop and
	// was added at the flag; Räikkönen's 10 s on lap 7 was served at his stop on lap 20.
	it('keeps a time penalty given after the car’s last stop and drops one served at a later stop', () => {
		const verstappen = penalty('33', 46, 10);

		const snapshot = race({
			penalties: [verstappen, penalty('7', 7, 10)],
			pitStops: [
				{ driverNumber: '33', lap: 30, laneTimeMs: 21_000 },
				{ driverNumber: '7', lap: 20, laneTimeMs: 21_000 }
			],
			laps: [lastLap('3', 56, 0), lastLap('33', 56, 10_436)],
			standings: [standing('3', 1, 0), standing('33', 4, 10_436)]
		});

		assert.deepEqual(unservedPenalties(snapshot), [verstappen]);
	});

	// 2019 Monaco: Verstappen crossed the line 0.537 s behind Hamilton and the feed's final gap
	// already held his 5 s.
	it('leaves out a penalty the feed already added to the final gap', () => {
		const snapshot = race({
			penalties: [penalty('33', 22, 5)],
			laps: [lastLap('44', 78, 0), lastLap('33', 78, 537)],
			standings: [standing('44', 1, 0), standing('33', 4, 5537)]
		});

		assert.deepEqual(unservedPenalties(snapshot), []);
	});

	// 2021 Austria: Pérez's two 5 s penalties were in his gap at his last crossing, 10 s more than
	// the lap times explain.
	it('leaves out penalties the feed added at the car’s last crossing', () => {
		const snapshot = race({
			penalties: [penalty('11', 42, 5), penalty('11', 52, 5)],
			laps: [
				lastLap('33', 70, 0, 69_000),
				lastLap('11', 70, 47_697, 69_200),
				lastLap('33', 71, 0, 69_000),
				lastLap('11', 71, 57_915, 69_218)
			],
			standings: [standing('33', 1, 0), standing('11', 6, 57_915)]
		});

		assert.deepEqual(unservedPenalties(snapshot), []);
	});

	it('leaves out drive-throughs and penalties already marked served', () => {
		const snapshot = race({
			penalties: [
				{ ...penalty('44', 10, 0), kind: 'drive_through' },
				{ ...penalty('5', 10, 5), status: 'served', servedLap: 12 }
			]
		});

		assert.deepEqual(unservedPenalties(snapshot), []);
	});
});
