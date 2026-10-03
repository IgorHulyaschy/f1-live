import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LONG_RUN_LAPS, longRuns, tyreMileage } from './long-runs.ts';
import { fixtureSession } from './test-fixtures.ts';

describe('long runs', () => {
	const practice = fixtureSession('9852');

	it('finds runs of five laps or more on one set in 2025 Las Vegas second practice', () => {
		const runs = longRuns(practice);

		assert.ok(runs.length > 0);

		for (const run of runs) {
			assert.ok(run.laps >= LONG_RUN_LAPS, run.driver.code);
			assert.ok(run.toLap >= run.fromLap + run.laps - 1, run.driver.code);
		}

		assert.deepEqual(
			runs.map((run) => run.averageMs),
			runs.map((run) => run.averageMs).toSorted((a, b) => a - b)
		);
	});

	it('has none in qualifying, where nobody runs more than a few laps on a set', () => {
		assert.deepEqual(longRuns(fixtureSession('9854')), []);
	});

	it('counts every lap a driver ran, by compound', () => {
		const mileage = tyreMileage(practice);

		const laps = new Map(
			practice.drivers.map((driver) => [
				driver.number,
				practice.laps.filter((lap) => lap.driverNumber === driver.number).length
			])
		);

		for (const entry of mileage) {
			assert.equal(entry.total, laps.get(entry.driver.number));
			assert.equal(
				[...entry.byCompound.values()].reduce((total, count) => total + count, 0),
				entry.total
			);
		}
	});
});
