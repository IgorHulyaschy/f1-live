import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { crewLeague, pitStopCost } from './pit-cost.ts';
import { fixtureSession } from './test-fixtures.ts';

const race = fixtureSession('9858');

describe('pitStopCost on the 2025 Las Vegas race', () => {
	const cost = pitStopCost(race);

	it('costs every official stop and leaves the opening-lap and slow ones out of the typical', () => {
		// 23 stops (https://www.formula1.com/en/results/2025/races/1274/las-vegas/pit-stop-summary).
		assert.equal(cost.stops.length, 23);
		assert.deepEqual(
			cost.stops
				.filter((entry) => entry.unusual === 'opening-lap')
				.map((entry) => entry.stop.driverNumber)
				.toSorted(),
			['22', '5']
		);
		// Bortoleto's 14.2 s, Lawson's 13.1 s and Albon's two long stops, one serving a penalty.
		assert.deepEqual(
			cost.stops
				.filter((entry) => entry.unusual === 'slow')
				.map((entry) => `${entry.stop.driverNumber}/${entry.stop.lap}`),
			['30/2', '23/14', '23/34']
		);
	});

	it('puts a green-flag stop at about 21.6 s of race time, a little over its pit lane', () => {
		assert.ok(cost.greenMs !== null && Math.abs(cost.greenMs - 21_600) < 200, `${cost.greenMs}`);
		assert.ok(cost.laneMs !== null && Math.abs(cost.laneMs - 21_371) < 1, `${cost.laneMs}`);
		assert.equal(cost.stationaryMs, 2800);
	});

	it('has Antonelli’s stop under the first VSC as the cheapest', () => {
		const cheapest = cost.stops
			.filter((entry) => entry.costMs !== null && entry.unusual === null)
			.toSorted((a, b) => (a.costMs ?? 0) - (b.costMs ?? 0))[0];

		assert.deepEqual(
			[cheapest?.stop.driverNumber, cheapest?.stop.lap, cheapest?.neutralised],
			['12', 2, true]
		);
		assert.ok((cheapest?.costMs ?? 0) < (cost.greenMs ?? 0) - 5000);
	});
});

describe('crewLeague on the 2025 Las Vegas race', () => {
	const league = crewLeague(race);

	it('ranks Red Bull first, its best stop Tsunoda’s on lap 27', () => {
		// The DHL fastest stop of the race: Red Bull, 1.99 s, Tsunoda on lap 27
		// (https://www.formula1.com/en/results/2025/awards/fastest-pit-stops). The feed times it
		// 2.2 s, level with Russell's lap-17 stop for Mercedes.
		assert.equal(league[0]?.team, 'Red Bull Racing');
		assert.deepEqual(league[0]?.stops[0], {
			driverNumber: '22',
			lap: 27,
			stationaryMs: 2200,
			slow: false
		});
		assert.equal(league.find((row) => row.team === 'Mercedes')?.bestMs, 2200);
	});

	it('marks slow stops and leaves them out of the team’s usual stop', () => {
		const williams = league.find((row) => row.team === 'Williams');

		assert.deepEqual(
			williams?.stops.map((stop) => [stop.lap, stop.slow]),
			[
				[22, false],
				[13, false],
				[34, true],
				[14, true]
			]
		);
		assert.equal(williams?.medianMs, 3250);
		// Bortoleto's only stop, 14.2 s with damage, leaves Sauber no usual time.
		assert.deepEqual([league.at(-1)?.team, league.at(-1)?.medianMs], ['Kick Sauber', null]);
	});
});
