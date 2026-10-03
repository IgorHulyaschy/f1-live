import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { paysFastestLap, pointsFor, pointsTable } from './points.ts';

function at(leaderLaps: number) {
	return { leaderLaps, scheduledLaps: 60 };
}

describe('pointsTable', () => {
	it('pays 25 to 1 in a race and nothing outside races and sprints', () => {
		assert.deepEqual(pointsTable('race', 2018), [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]);
		assert.deepEqual(pointsTable('qualifying', 2025), []);
		assert.deepEqual(pointsTable('sprint_qualifying', 2024), []);
	});

	it('pays the top three in the 2021 sprints and the top eight since 2022', () => {
		assert.deepEqual(pointsTable('sprint', 2021), [3, 2, 1]);
		assert.deepEqual(pointsTable('sprint', 2023), [8, 7, 6, 5, 4, 3, 2, 1]);
	});

	it('halves a race short of 75% before 2022, as at Spa 2021', () => {
		const spa2021 = { leaderLaps: 3, scheduledLaps: 44 };

		assert.deepEqual(
			[1, 2, 3, 10].map((position) => pointsFor('race', 2021, position, spa2021)),
			[12.5, 9, 7.5, 0.5]
		);
	});

	it('scales a shortened race by its share of the distance from 2022', () => {
		assert.equal(pointsFor('race', 2023, 1, at(10)), 6);
		assert.equal(pointsFor('race', 2023, 6, at(10)), 0);
		assert.equal(pointsFor('race', 2023, 1, at(20)), 13);
		assert.equal(pointsFor('race', 2023, 1, at(40)), 19);
		assert.equal(pointsFor('race', 2023, 1, at(45)), 25);
	});

	it('pays nothing when the leader completed fewer than two laps', () => {
		assert.deepEqual(pointsTable('race', 2024, { leaderLaps: 1, scheduledLaps: 57 }), []);
	});
});

describe('paysFastestLap', () => {
	it('pays from 2019 to 2024 to a driver in the top ten', () => {
		assert.equal(paysFastestLap('race', 2018, 1), false);
		assert.equal(paysFastestLap('race', 2019, 10), true);
		assert.equal(paysFastestLap('race', 2019, 11), false);
		assert.equal(paysFastestLap('race', 2024, 3), true);
		assert.equal(paysFastestLap('race', 2025, 1), false);
		assert.equal(paysFastestLap('sprint', 2023, 1), false);
	});

	it('pays nothing in a half-points race before 2022, or under half distance after', () => {
		assert.equal(paysFastestLap('race', 2021, 1, { leaderLaps: 3, scheduledLaps: 44 }), false);
		assert.equal(paysFastestLap('race', 2023, 1, { leaderLaps: 31, scheduledLaps: 60 }), true);
		assert.equal(paysFastestLap('race', 2023, 1, { leaderLaps: 29, scheduledLaps: 60 }), false);
	});
});
