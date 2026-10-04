import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fixtureSession } from '../../insights/test-fixtures.ts';
import {
	battlePoints,
	flagRanges,
	pitLaps,
	robustRange,
	toPoints,
	versusPoints
} from './lap-series.ts';

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

describe('toPoints', () => {
	it('reads lap times as seconds off the quickest car on each lap', () => {
		const points = toPoints(race, race.drivers, 'lapTime');

		const values = points.flatMap((point) =>
			Object.entries(point).flatMap(([key, value]) => (key === 'lap' ? [] : [value]))
		);

		assert.ok(values.every((value) => value >= 0));
		assert.ok(points.every((point) => Object.values(point).includes(0)));
	});
});

describe('battlePoints', () => {
	it('names the car ahead and breaks the line at a pass and at a stop', () => {
		const { points, ahead } = battlePoints(race, '16');

		const broken = new Set(
			points.filter((point) => point.interval === undefined).map((point) => point.lap)
		);

		// Leclerc ran behind Piastri from lap 5, then Hadjar, Sainz and Verstappen until his stop.
		assert.deepEqual(
			ahead.slice(0, 4).map((entry) => [entry.lap, entry.code]),
			[
				[1, 'BEA'],
				[5, 'PIA'],
				[12, 'HAD'],
				[13, 'SAI']
			]
		);

		for (const entry of ahead.slice(1)) {
			assert.ok(broken.has(entry.lap), `${entry.lap}`);
		}

		assert.ok([...(pitLaps(race).get('16') ?? [])].every((lap) => broken.has(lap)));
	});
});

describe('robustRange', () => {
	it('runs through 0 in about four nice steps and leaves the outliers out', () => {
		const laps = [0, 0.1, 0.2, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 6];

		assert.deepEqual(robustRange(laps, 0.9), { domain: [0, 0.8], ticks: [0, 0.2, 0.4, 0.6, 0.8] });
		assert.deepEqual(robustRange([-3.2, 0, 1.1, 8]).domain, [-4, 2]);
		assert.deepEqual(robustRange([]).domain, [0, 0.1]);
	});
});
