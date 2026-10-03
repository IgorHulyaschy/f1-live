import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { simulateLasVegas2025 } from '../data/mock/simulate-race.ts';
import { snapshotAtLap } from '../data/snapshot-at-lap.ts';
import { battleAhead } from './battle.ts';
import { pitPenalties, timePenalties } from './penalties.ts';
import { PIT_LOSS_MS, predictRejoin } from './pit-window.ts';
import { standingsAt } from './standings.ts';
import { stintPaces, tyreCorrectedPace } from './tyre-pace.ts';

const race = simulateLasVegas2025();

describe('standingsAt', () => {
	it('orders running cars first and retired cars last', () => {
		const rows = standingsAt(snapshotAtLap(race, 40));

		assert.deepEqual(
			rows.map((row) => row.position),
			rows.map((_, index) => index + 1)
		);
		assert.deepEqual(
			rows
				.filter((row) => row.state === 'out')
				.map((row) => row.driver.code)
				.toSorted(),
			['ALB', 'BOR', 'STR']
		);
		assert.ok(rows.slice(0, 17).every((row) => row.state !== 'out'));
	});

	it('marks exactly one holder of the fastest lap', () => {
		const rows = standingsAt(snapshotAtLap(race, 50));

		assert.equal(rows.filter((row) => row.hasFastestLap).length, 1);
	});
});

describe('predictRejoin', () => {
	it('drops the driver back by roughly a pit stop under green', () => {
		const snapshot = snapshotAtLap(race, 12);
		const prediction = predictRejoin(snapshot, '1');

		assert.ok(prediction);
		assert.equal(prediction.pitLossMs, PIT_LOSS_MS.green);
		assert.equal(prediction.cheapStop, false);
		assert.ok(prediction.rejoinPosition > prediction.currentPosition);
	});

	it('flags a cheap stop under the VSC', () => {
		const prediction = predictRejoin(snapshotAtLap(race, 3), '4');

		assert.equal(prediction?.cheapStop, true);
		assert.equal(prediction?.pitLossMs, PIT_LOSS_MS.neutralised);
	});

	it('returns null for a retired driver', () => {
		assert.equal(predictRejoin(snapshotAtLap(race, 40), '23'), null);
	});
});

describe('tyre pace', () => {
	it('finds positive degradation on medium stints', () => {
		const mediums = stintPaces(snapshotAtLap(race, 50)).filter(
			(stint) => stint.compound === 'MEDIUM'
		);

		assert.ok(mediums.length > 5);
		assert.ok(mediums.every((stint) => stint.degradationSecondsPerLap > 0));
	});

	it('ranks drivers with the best at zero delta', () => {
		const ranking = tyreCorrectedPace(snapshotAtLap(race, 45));

		assert.ok(ranking.length >= 15);
		assert.equal(ranking[0]?.deltaToBestSeconds, 0);
		assert.ok(ranking.every((entry, index) => index === 0 || entry.deltaToBestSeconds >= 0));
	});
});

describe('battleAhead', () => {
	it('has no battle for the leader', () => {
		assert.equal(battleAhead(snapshotAtLap(race, 30), '1'), null);
	});

	it('reports the interval to the car ahead', () => {
		const battle = battleAhead(snapshotAtLap(race, 48), '16');

		assert.ok(battle);
		assert.ok(battle.intervalSeconds > 0);
	});
});

describe('timePenalties', () => {
	it('shows a penalty once and clears it when served', () => {
		assert.equal(timePenalties(snapshotAtLap(race, 30)).get('23'), 5);
		assert.equal(timePenalties(snapshotAtLap(race, 40)).has('23'), false);
	});
});

describe('pitPenalties', () => {
	it('shows a drive-through until the lap it is served', () => {
		const snapshot = {
			...snapshotAtLap(race, 30),
			penalties: [
				{
					driverNumber: '11',
					kind: 'drive_through' as const,
					reason: 'Unsafe release',
					lap: 9,
					status: 'served' as const,
					servedLap: 12
				}
			]
		};

		assert.equal(pitPenalties({ ...snapshot, currentLap: 10 }).get('11'), 'DT');
		assert.equal(pitPenalties({ ...snapshot, currentLap: 12 }).has('11'), false);
	});
});
