import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { snapshotAtLap } from '../data/snapshot-at-lap.ts';
import { duel, duelVerdict, lapRangeText } from './duel.ts';
import { paceNow } from './pace-now.ts';
import { standingsAt } from './standings.ts';
import { fixtureSession } from './test-fixtures.ts';

const lasVegas = fixtureSession('9858');

const lap38 = snapshotAtLap(lasVegas, 38);

const lapsLeft = lap38.session.totalLaps - lap38.currentLap;

function numberOf(code: string): string {
	return standingsAt(lap38).find((row) => row.driver.code === code)?.driver.number ?? '';
}

describe('lapRangeText', () => {
	it('reads a range as words', () => {
		assert.equal(lapRangeText([1, 1], 10), 'in about 1 lap');
		assert.equal(lapRangeText([3, 5], 10), 'in 3 to 5 laps');
		assert.equal(lapRangeText([3, null], 10), 'in 3 laps or more');
		assert.equal(lapRangeText([8, 14], 10), 'in 8 laps or more');
		assert.equal(lapRangeText([12, 14], 10), 'not before the flag');
	});
});

describe('duelVerdict', () => {
	it('says who is faster, by how much, and when the chaser gets within a second', () => {
		const pair = duel(lap38, numberOf('PIA'), numberOf('LEC'));

		assert.ok(pair);
		assert.equal(
			duelVerdict(pair, lapsLeft, 'DRS')?.text,
			'LEC is 0.28 s a lap faster over the last 5 laps and 0.2 s behind: in DRS range now.'
		);
	});

	it('reads the same whichever driver is picked first', () => {
		const forward = duel(lap38, numberOf('PIA'), numberOf('LEC'));
		const backward = duel(lap38, numberOf('LEC'), numberOf('PIA'));

		assert.ok(forward && backward);
		assert.equal(
			duelVerdict(backward, lapsLeft, 'DRS')?.text,
			duelVerdict(forward, lapsLeft, 'DRS')?.text
		);
	});

	it('projects a catch for a faster car further back', () => {
		const pair = duel(lap38, numberOf('GAS'), numberOf('TSU'));

		assert.ok(pair);
		assert.match(
			duelVerdict(pair, lapsLeft, 'DRS')?.text ?? '',
			/^TSU is 1\.26 s a lap faster .* in DRS range in about 3 laps\.$/
		);
	});

	it('compares each driver’s own clean laps when they have too few together', () => {
		const lap30 = snapshotAtLap(lasVegas, 30);
		const pair = duel(lap30, numberOf('HAM'), numberOf('ALO'));

		assert.ok(pair);
		assert.equal(pair.pace, null);
		assert.equal(
			duelVerdict(pair, 20, 'DRS')?.text,
			'ALO is 0.2 s behind HAM; HAM is 0.58 s a lap faster over their own last clean laps.'
		);
	});

	it('says pace is paused under a flag when there is none to compare', () => {
		const lap3 = snapshotAtLap(lasVegas, 3);
		const pair = duel(lap3, numberOf('VER'), numberOf('RUS'));

		assert.ok(pair);
		assert.equal(
			duelVerdict(pair, 47, 'DRS', 'Virtual Safety Car')?.text,
			'RUS is 1.6 s behind VER; pace is paused under the Virtual Safety Car.'
		);
	});

	it('marks pit laps rather than plotting them as pace', () => {
		const pair = duel(lap38, numberOf('VER'), numberOf('NOR'));
		const pits = pair?.laps.filter((lap) => lap.mark === 'pit') ?? [];

		assert.ok(pits.length > 0);
		assert.ok(pits.every((lap) => lap.gainSeconds === null));
	});

	it('only knows the laps up to the cursor', () => {
		const pair = duel(snapshotAtLap(lasVegas, 20), numberOf('VER'), numberOf('NOR'));

		assert.equal(pair?.laps.at(-1)?.lap, 20);
	});
});

describe('paceNow', () => {
	const list = paceNow(lap38);

	it('ranks running cars by their recent clean pace against the fastest', () => {
		assert.equal(list[0]?.deltaSeconds, 0);
		assert.deepEqual(
			list.map((entry) => entry.deltaSeconds),
			list.map((entry) => entry.deltaSeconds).toSorted((a, b) => a - b)
		);
		assert.ok(list.every((entry) => entry.row.state !== 'out'));
	});

	it('leaves pit and neutralised laps out', () => {
		assert.ok(
			list.every((entry) =>
				entry.laps.every((lap) => !lap.pitIn && !lap.pitOut && lap.trackStatus === 'green')
			)
		);
	});

	it('has no pace before any car has clean laps', () => {
		assert.deepEqual(paceNow(snapshotAtLap(lasVegas, 3)), []);
	});
});
