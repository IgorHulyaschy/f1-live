import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fixtureSession } from '../../insights/test-fixtures.ts';
import { flagRanges, pitLaps, versusPoints } from './lap-series.ts';

const race = fixtureSession('9858');

const drivers = race.drivers.filter((driver) => ['1', '4', '63'].includes(driver.number));

describe('versusPoints', () => {
	it('measures each car against the reference at every line crossing', () => {
		const points = versusPoints(race, drivers, '1');
		const last = points.at(-1);

		assert.equal(points.length, 50);
		assert.equal(last?.VER, 0);
		// Russell finished 23.546 s behind Verstappen
		// (https://www.formula1.com/en/results/2025/races/1274/las-vegas/race-result).
		assert.ok(Math.abs((last?.RUS ?? 0) - 23.546) < 0.01, `${last?.RUS}`);
		assert.ok(points.every((point) => (point.VER ?? 0) === 0));
	});
});

describe('pitLaps', () => {
	it('lists the laps each car came in on', () => {
		const laps = pitLaps(race);

		assert.deepEqual([...(laps.get('1') ?? [])], [25]);
		assert.deepEqual([...(laps.get('23') ?? [])], [13, 14, 34]);
	});
});

describe('flagRanges', () => {
	it('joins neighbouring laps under one flag and keeps the most serious one', () => {
		const ranges = flagRanges(race);

		// Virtual safety cars on laps 2 to 4 and 15 to 16 (race control).
		assert.deepEqual(
			ranges.filter((range) => range.status === 'vsc').map((range) => [range.from, range.to]),
			[
				[2, 4],
				[15, 16]
			]
		);
		assert.ok(ranges.every((range) => range.from <= range.to));
	});
});
