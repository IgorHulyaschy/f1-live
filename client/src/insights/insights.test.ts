import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { simulateLasVegas2025 } from '../data/mock/simulate-race.ts';
import { snapshotAtLap } from '../data/snapshot-at-lap.ts';
import { battleAhead } from './battle.ts';
import { pitPenalties, timePenalties } from './penalties.ts';
import { PIT_LOSS_MS, pitLossOf, predictRejoin } from './pit-window.ts';
import { oneSecondAid } from './rules.ts';
import { outLabel, standingsAt } from './standings.ts';
import { stintPaces } from './tyre-pace.ts';

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

	it('names the lap a retired car stopped on', () => {
		const snapshot = snapshotAtLap(race, 40);
		const [retirement] = snapshot.retirements;
		const row = standingsAt(snapshot).find((candidate) => candidate.out === 'retired');

		assert.ok(retirement && row, 'a car has retired by lap 40');
		assert.equal(
			row.retiredLap,
			snapshot.retirements.find((r) => r.driverNumber === row.driver.number)?.lap
		);
		assert.match(outLabel({ out: 'retired', retiredLap: row.retiredLap }), /^DNF L\d+$/);
		assert.equal(outLabel({ out: 'retired', retiredLap: null }), 'DNF');
		assert.equal(outLabel({ out: 'disqualified', retiredLap: null }), 'DSQ');
	});

	describe('after a disqualification', () => {
		const final = snapshotAtLap(race, 50);
		const [first, second, third] = standingsAt(final);

		const without = (driverNumber: string | undefined) => ({
			...final,
			corrections: [
				{
					driverNumber: driverNumber ?? '',
					kind: 'disqualified' as const,
					reason: 'Plank wear',
					at: '2025-11-23T12:00:00.000Z'
				}
			]
		});

		it('measures the car behind the excluded one to the car ahead of it', () => {
			const corrected = without(second?.driver.number);
			const rows = standingsAt(corrected);

			assert.equal(rows[1]?.driver.number, third?.driver.number);
			assert.equal(rows[1]?.intervalMs, (third?.gapToLeaderMs ?? 0) - (first?.gapToLeaderMs ?? 0));
			assert.equal(rows[1]?.gapToLeaderMs, third?.gapToLeaderMs);
			assert.equal(
				battleAhead(corrected, third?.driver.number ?? '')?.ahead.code,
				first?.driver.code
			);
		});

		it('measures every gap to the new leader when the leader is excluded', () => {
			const rows = standingsAt(without(first?.driver.number));

			assert.equal(rows[0]?.driver.number, second?.driver.number);
			assert.equal(rows[0]?.gapToLeaderMs, 0);
			assert.equal(rows[1]?.intervalMs, (third?.gapToLeaderMs ?? 0) - (second?.gapToLeaderMs ?? 0));
			assert.equal(rows[1]?.gapToLeaderMs, rows[1]?.intervalMs);
		});
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

	it('measures the stop on the session’s own green-flag stops once there are some', () => {
		const snapshot = snapshotAtLap(race, 40);
		const measured = pitLossOf(snapshot);

		assert.ok(measured.stops > 0);
		assert.equal(predictRejoin(snapshot, '1')?.pitLossMs, measured.greenMs);
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

describe('oneSecondAid', () => {
	it('is DRS until 2025 and follows race control switching it on and off', () => {
		assert.deepEqual(oneSecondAid(snapshotAtLap(race, 1)).code, 'DRS');
		assert.equal(oneSecondAid(snapshotAtLap(race, 30)).enabled, true);
	});

	it('is overtake mode from 2026', () => {
		const snapshot = {
			...snapshotAtLap(race, 30),
			session: { ...race.session, startsAt: '2026-10-04T07:00:00.000Z' },
			raceControl: [{ lap: 3, category: 'other' as const, message: 'OVERTAKE DISABLED' }]
		};

		assert.deepEqual(oneSecondAid(snapshot), {
			code: 'OVT',
			name: 'overtake mode',
			enabled: false
		});
	});
});
