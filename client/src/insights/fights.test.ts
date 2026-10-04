import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { snapshotAtLap } from '../data/snapshot-at-lap.ts';
import { fights, lapsToReach, pairPace } from './battle.ts';
import { standingsAt } from './standings.ts';
import { fixtureSession } from './test-fixtures.ts';

const lasVegas = fixtureSession('9858');

function numberOf(snapshot: ReturnType<typeof snapshotAtLap>, code: string): string {
	return standingsAt(snapshot).find((row) => row.driver.code === code)?.driver.number ?? '';
}

function steady(secondsPerLap: number, spreadSeconds: number) {
	return { secondsPerLap, spreadSeconds, laps: [1, 2, 3] };
}

describe('lapsToReach', () => {
	it('is there already within a second', () => {
		assert.deepEqual(lapsToReach(0.8, steady(0.3, 0.1)), [0, 0]);
	});

	it('gives a range from the spread of the pace', () => {
		assert.deepEqual(lapsToReach(3, steady(0.5, 0.1)), [4, 5]);
	});

	it('leaves the far end open when the slow case barely closes', () => {
		assert.deepEqual(lapsToReach(3, steady(0.1, 0.1)), [10, null]);
	});

	it('makes no projection for a car that is not closing', () => {
		assert.equal(lapsToReach(3, steady(0.04, 0.05)), null);
		assert.equal(lapsToReach(3, steady(-0.4, 0.05)), null);
	});
});

describe('fights in the 2025 Las Vegas race', () => {
	it('has none under the Virtual Safety Car', () => {
		const snapshot = snapshotAtLap(lasVegas, 3);

		assert.equal(snapshot.trackStatus, 'vsc');
		assert.deepEqual(fights(snapshot), []);
	});

	it('lists the fights now first, then the ones coming, soonest first', () => {
		const list = fights(snapshotAtLap(lasVegas, 22));

		assert.deepEqual(
			list.map((fight) => fight.within[0]),
			list.map((fight) => fight.within[0]).toSorted((a, b) => a - b)
		);
		assert.ok(
			list.filter((fight) => fight.within[0] === 0).every((fight) => fight.gapSeconds <= 1)
		);
	});

	it('sees a car on fresh tyres coming within a second in a few laps', () => {
		const coming = fights(snapshotAtLap(lasVegas, 22)).find(
			(fight) => fight.behind.driver.code === 'RUS'
		);

		assert.equal(coming?.ahead.driver.code, 'LEC');
		assert.deepEqual(coming?.within, [2, 3]);
		assert.deepEqual(coming?.reason, { kind: 'fresh-tyres', lapsSinceStop: 4 });
	});

	it('pairs only neighbours on track on the same lap', () => {
		const snapshot = snapshotAtLap(lasVegas, 38);
		const rows = standingsAt(snapshot);

		for (const fight of fights(snapshot, rows)) {
			assert.equal(rows.indexOf(fight.behind) - rows.indexOf(fight.ahead), 1);
			assert.equal(fight.behind.state, 'running');
			assert.equal(fight.ahead.state, 'running');
			assert.equal(fight.behind.lapsDown, fight.ahead.lapsDown);
		}
	});

	it('names the softer tyre as the reason a car is closing', () => {
		const coming = fights(snapshotAtLap(lasVegas, 38)).find(
			(fight) => fight.behind.driver.code === 'TSU'
		);

		assert.equal(coming?.ahead.driver.code, 'GAS');
		assert.deepEqual(coming?.reason, { kind: 'compound', behind: 'MEDIUM', ahead: 'HARD' });
	});
});

describe('fights in the 2026 Bahrain race', () => {
	const bahrain = fixtureSession('11731');

	it('has none behind the Safety Car', () => {
		const snapshot = snapshotAtLap(bahrain, 8);

		assert.equal(snapshot.trackStatus, 'safety_car');
		assert.deepEqual(fights(snapshot), []);
	});

	it('sees a fight now: NOR within a second of HUL', () => {
		const now = fights(snapshotAtLap(bahrain, 20)).find(
			(fight) => fight.behind.driver.code === 'NOR'
		);

		assert.ok(now);
		assert.equal(now.ahead.driver.code, 'HUL');
		assert.deepEqual(now?.within, [0, 0]);
		assert.ok(now.gapSeconds < 1);
	});

	it('sees a fight coming: GAS on mediums within a second of SAI on softs in 2 to 3 laps', () => {
		const coming = fights(snapshotAtLap(bahrain, 20)).find(
			(fight) => fight.behind.driver.code === 'GAS'
		);

		assert.ok(coming);
		assert.equal(coming.ahead.driver.code, 'SAI');
		assert.ok(coming.gapSeconds > 1);
		assert.deepEqual(coming.within, [2, 3]);
		assert.equal(coming.reason, null);
	});

	it('names the tyres as the reason: LEC on softs behind NOR on hards', () => {
		const fight = fights(snapshotAtLap(bahrain, 20)).find(
			(entry) => entry.behind.driver.code === 'LEC'
		);

		assert.deepEqual(fight?.reason, { kind: 'compound', behind: 'SOFT', ahead: 'HARD' });
	});

	it('splits a pair at a stop: COL is compared only on the laps since', () => {
		const snapshot = snapshotAtLap(bahrain, 36);
		const pace = pairPace(snapshot, numberOf(snapshot, 'SAI'), numberOf(snapshot, 'COL'));

		const stop = snapshot.pitStops.findLast(
			(entry) => entry.driverNumber === numberOf(snapshot, 'COL')
		);

		assert.equal(stop?.lap, 31);
		assert.ok(pace);
		assert.ok(pace.laps.every((lap) => lap > 31));
		assert.ok(pace.secondsPerLap > 1);
	});
});

describe('pairPace', () => {
	it('compares only laps since either car last stopped', () => {
		const snapshot = snapshotAtLap(lasVegas, 22);
		const pace = pairPace(snapshot, numberOf(snapshot, 'LEC'), numberOf(snapshot, 'RUS'));

		assert.ok(pace);
		assert.ok(pace.laps.every((lap) => lap > 18));
		assert.ok(pace.secondsPerLap > 0.5);
	});
});
