import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { RaceSnapshot } from '@f1-live/shared';

import { snapshotAtLap } from '../data/snapshot-at-lap.ts';
import {
	championshipSwing,
	contenders,
	placeValues,
	pointsFor,
	pointsStillOnOffer,
	projectedDrivers,
	projectedTeams
} from './championship.ts';
import { fixtureSession } from './test-fixtures.ts';

/**
 * Before Las Vegas: Norris 390, Piastri 366, Verstappen 341. After it, with both McLarens
 * disqualified: 390, 366 and 366
 * (https://www.si.com/onsi/f1/updated-f1-standings-after-the-2025-las-vegas-grand-prix-following-double-mclaren-dsq,
 * https://fft.crash.net/f1/news/1087322/1/f1-world-championship-points-standings-after-2025-las-vegas-grand-prix).
 * Qatar's sprint and race and Abu Dhabi's race were left.
 */
const race = fixtureSession('9858');

const LEFT_AFTER_LAS_VEGAS = pointsStillOnOffer(['sprint', 'race', 'race'], 2025);

/**
 * The order at the flag, before the disqualifications, Antonelli's 5 s penalty applied
 * (https://www.formula1.com/en/results/2025/races/1274/las-vegas/race-result); the last three retired.
 */
const AT_THE_FLAG = [
	'1',
	'4',
	'63',
	'81',
	'12',
	'16',
	'55',
	'6',
	'27',
	'44',
	'31',
	'87',
	'14',
	'22',
	'10',
	'30',
	'43',
	'23',
	'5',
	'18'
];

const RETIRED = new Set(['23', '5', '18']);

/** The race as the feed ended it, before the stewards' decisions after the flag. */
const beforeDecisions: RaceSnapshot = {
	...race,
	corrections: [],
	standings: AT_THE_FLAG.map((driverNumber, index) => ({
		driverNumber,
		position: index + 1,
		gapToLeaderMs: null,
		intervalMs: null,
		lapsCompleted: 50,
		inPit: false,
		retired: RETIRED.has(driverNumber),
		disqualified: false
	}))
};

function pointsOf(table: ReturnType<typeof projectedDrivers>, driverNumber: string) {
	return table.find((place) => place.id === driverNumber)?.projectedPoints;
}

describe('points', () => {
	it('pays 25 to 1 in a race and 8 to 1 in a sprint', () => {
		assert.deepEqual(
			[1, 2, 3, 10, 11].map((position) => pointsFor('race', 2025, position)),
			[25, 18, 15, 1, 0]
		);
		assert.deepEqual(
			[1, 8, 9].map((position) => pointsFor('sprint', 2025, position)),
			[8, 1, 0]
		);
		assert.equal(pointsFor('sprint', 2021, 3), 1);
		assert.equal(pointsFor('qualifying', 2025, 1), 0);
		assert.equal(LEFT_AFTER_LAS_VEGAS, 58);
	});
});

describe('projectedDrivers', () => {
	it('ends with the standings after Las Vegas, the disqualifications included', () => {
		const table = projectedDrivers(race, race.currentLap);

		assert.deepEqual(
			['4', '81', '1'].map((driverNumber) => pointsOf(table, driverNumber)),
			[390, 366, 366]
		);
		assert.deepEqual(
			table.slice(0, 3).map((place) => place.id),
			['4', '81', '1']
		);
	});

	it('matches the feed’s own projection at the flag, before the disqualifications', () => {
		const atFlag = projectedDrivers(beforeDecisions, race.currentLap);

		for (const place of race.championship?.drivers ?? []) {
			assert.equal(
				pointsOf(atFlag, place.driverNumber),
				place.predictedPoints,
				`car ${place.driverNumber}`
			);
		}
	});

	it('projects the order on a lap as if the race ended there', () => {
		// Norris was third on lap 1, behind Verstappen and Russell.
		const lapOne = projectedDrivers(snapshotAtLap(race, 1), 1);

		assert.equal(pointsOf(lapOne, '1'), 341 + 25);
		assert.equal(pointsOf(lapOne, '4'), 390 + 15);
	});
});

describe('projectedTeams', () => {
	it('adds both cars, and McLaren keeps its 756 after the disqualifications', () => {
		const teams = projectedTeams(race, race.currentLap);

		assert.equal(teams.find((place) => place.id === 'McLaren')?.projectedPoints, 756);
		assert.ok((teams.find((place) => place.id === 'Mercedes')?.gained ?? 0) > 0);
	});
});

describe('contenders and the swing', () => {
	it('keeps Norris, Piastri and Verstappen in the fight with 58 points left after Las Vegas', () => {
		assert.deepEqual(contenders(race, LEFT_AFTER_LAS_VEGAS), ['4', '81', '1']);
	});

	it('shows Verstappen 24 points behind at the end, and 42 before the disqualifications', () => {
		const swing = championshipSwing(race, ['4', '81', '1']);

		assert.equal(swing.length, 50);
		assert.deepEqual([swing.at(-1)?.['4'], swing.at(-1)?.['1']], [0, 24]);
		assert.equal(championshipSwing(beforeDecisions, ['1']).at(-1)?.['1'], 408 - 366);
	});
});

describe('placeValues', () => {
	it('tells what each place was worth to Verstappen at the flag', () => {
		const values = placeValues(race, '1', race.currentLap);

		assert.deepEqual(values[0], { finish: 1, marginPoints: -24, projectedPosition: 2 });
		assert.deepEqual(values.at(-1), { finish: null, marginPoints: -49, projectedPosition: 3 });
		assert.equal(values.length, 11);
	});
});
