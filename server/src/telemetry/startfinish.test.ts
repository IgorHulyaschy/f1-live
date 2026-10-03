import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { crossingTime, locateStartFinish, median } from './startfinish.js';
import type { Crossing } from './startfinish.js';
import { LENGTH_M, carOn, driveLaps, noise, stadiumOutline } from './test-circuit.js';
import type { CarDistance } from './series.js';

const LATENCY_MS = 400;

/** Three cars, ten laps each, with the speed on the line changing from lap to lap. */
function field() {
	const outline = stadiumOutline();
	const random = noise(11);
	const cars = new Map<string, CarDistance>();
	const crossings: Crossing[] = [];
	const truths = new Map<string, number[]>();

	['1', '4', '44'].forEach((driverNumber, index) => {
		const laps = Array.from({ length: 10 }, () => ({
			lapSeconds: 80 + random() * 4,
			swing: 0.2 + random() * 0.15
		}));

		const driven = driveLaps(laps, index * 3000, 0.3, 20 + index);

		cars.set(driverNumber, carOn(outline, driven));
		truths.set(driverNumber, driven.crossings);
		driven.crossings.slice(1).forEach((crossing, lap) => {
			crossings.push({ driverNumber, lap: lap + 1, at: crossing + LATENCY_MS });
		});
	});

	return { outline, cars, crossings, truths };
}

describe('median', () => {
	it('takes the middle, or the mean of the two in the middle', () => {
		assert.equal(median([5, 1, 3]), 3);
		assert.equal(median([4, 1, 3, 2]), 2.5);
	});
});

describe('locateStartFinish', () => {
	const { cars, crossings } = field();

	it('finds the delay of the feed and the line from where cars were when it published', () => {
		const found = locateStartFinish(LENGTH_M, cars, crossings);
		const fromLine = Math.min(found.distanceM, LENGTH_M - found.distanceM);

		assert.ok(Math.abs(found.latencyMs - LATENCY_MS) <= 100, `delay ${found.latencyMs} ms`);
		assert.ok(fromLine < 12, `line ${fromLine} m from where it is`);
	});

	it('finds only the delay when the line is known', () => {
		const found = locateStartFinish(LENGTH_M, cars, crossings, 0);

		assert.ok(Math.abs(found.latencyMs - LATENCY_MS) <= 100, `delay ${found.latencyMs} ms`);
		assert.equal(found.distanceM, 0);
	});

	it('will not place a line from a handful of crossings', () => {
		assert.throws(
			() => locateStartFinish(LENGTH_M, cars, crossings.slice(0, 3)),
			/Only 3 lap crossings/
		);
	});

	it('ignores crossings of cars it has no positions for', () => {
		const extra: Crossing[] = [...crossings, { driverNumber: '99', lap: 1, at: 5 }];

		assert.doesNotThrow(() => locateStartFinish(LENGTH_M, cars, extra));
	});
});

describe('crossingTime', () => {
	const { cars, truths } = field();

	it('finds the moment the car passed the line between two samples', () => {
		const car = cars.get('1');
		const truth = truths.get('1') ?? [];

		assert.ok(car !== undefined);

		for (const lap of [1, 4, 9]) {
			const found = crossingTime(car, LENGTH_M, 0, (truth[lap] ?? 0) + 300);

			assert.ok(
				Math.abs(found - (truth[lap] ?? 0)) < 80,
				`lap ${lap}: ${found - (truth[lap] ?? 0)} ms`
			);
		}
	});

	it('gives the time it was asked about when the car did not pass the line near it', () => {
		const car = cars.get('1');

		assert.ok(car !== undefined);
		assert.equal(crossingTime(car, LENGTH_M, 0, 41_000), 41_000);
	});
});
