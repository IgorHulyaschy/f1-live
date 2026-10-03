import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { RaceSnapshot } from '@f1-live/shared';

import { minuteTime, sessionClock, snapshotAtTime } from '../data/snapshot-at-time.ts';
import {
	gapToCut,
	gapToPole,
	improvements,
	knockout,
	onTrack,
	recentImprovements,
	stillToRun
} from './knockout.ts';
import { standingsAt } from './standings.ts';
import { fixtureSession } from './test-fixtures.ts';

/** 2026 Baku qualifying, 22 cars: Q1 runs minutes 0 to 18, Q2 25 to 40, Q3 47 to 60. */
const baku = fixtureSession('11373');

type Moment = { snapshot: RaceSnapshot; time: number };

function at(minute: number): Moment {
	const time = minuteTime(sessionClock(baku), minute);

	return { snapshot: snapshotAtTime(baku, time), time };
}

function stateAt(minute: number) {
	const { snapshot } = at(minute);
	const rows = standingsAt(snapshot);
	const state = knockout(snapshot, rows);

	assert.ok(state);

	return { rows, state };
}

describe('knockout', () => {
	it('is for qualifying only', () => {
		const practice = fixtureSession('9852');

		assert.equal(knockout(practice, standingsAt(practice)), null);
	});

	it('puts the last six of 22 in the Q1 drop zone, behind the cut at 16', () => {
		const { state } = stateAt(12);

		assert.equal(state.part, 1);
		assert.equal(state.running, true);
		assert.equal(state.cutAfter, 16);
		assert.equal(state.cutRow?.position, 16);
		assert.deepEqual(
			state.dropZone.map((row) => `${row.position} ${row.driver.code}`),
			['17 PER', '18 ALB', '19 GAS', '20 ALO', '21 BOT', '22 STR']
		);
	});

	it('measures each car to the cut and to the top of the part', () => {
		const { rows, state } = stateAt(12);
		const [first] = rows;
		const out = state.dropZone[0];

		assert.ok(first && out);
		assert.ok((gapToCut(first, state) ?? 0) < 0, 'ahead of the cut');
		assert.equal(gapToCut(out, state), 293);
		assert.equal(gapToPole(first, state), 0);
	});

	it('moves the cut to 10 in Q2, with the cars out in Q1 no longer in the field', () => {
		const { state } = stateAt(33);

		assert.equal(state.part, 2);
		assert.equal(state.cutAfter, 10);
		assert.equal(state.field.length, 16);
		assert.deepEqual(
			state.dropZone.map((row) => row.driver.code),
			['LAW', 'LIN', 'BEA', 'GAS', 'COL', 'ANT']
		);
		// Three of them have no Q2 time yet, so nothing to measure to the cut.
		assert.deepEqual(
			state.dropZone.map((row) => gapToCut(row, state)),
			[216, 325, 328, null, null, null]
		);
	});

	it('has no drop zone between parts or in Q3', () => {
		assert.equal(stateAt(41).state.cutAfter, null);
		assert.deepEqual(stateAt(41).state.dropZone, []);
		assert.equal(stateAt(55).state.running, true);
		assert.deepEqual(stateAt(55).state.dropZone, []);
	});

	it('counts the cars that can still change the order: out on track or without a time', () => {
		const { snapshot, time } = at(33);
		const rows = standingsAt(snapshot);
		const state = knockout(snapshot, rows);

		assert.ok(state);
		assert.equal(stillToRun(state, onTrack(snapshot, rows, time)).length, 16);
		assert.deepEqual(
			stillToRun(state, new Set()).map((row) => row.driver.code),
			['GAS', 'COL', 'ANT']
		);
	});

	it('takes the feed’s own pit flags when it has them', () => {
		const rows = standingsAt(baku);
		const inPit = new Set(['63', '16']);

		const snapshot: RaceSnapshot = {
			...baku,
			standings: rows.map((row) => ({
				driverNumber: row.driver.number,
				position: row.position,
				gapToLeaderMs: null,
				intervalMs: null,
				lapsCompleted: row.lapsCompleted,
				inPit: inPit.has(row.driver.number),
				retired: false,
				disqualified: false
			}))
		};

		assert.equal(onTrack(snapshot, rows, 0).size, rows.length - 2);
		assert.equal(onTrack(snapshot, rows, 0).has('63'), false);
	});
});

describe('improvements', () => {
	it('lists laps that took a car up its part, newest first', () => {
		const { snapshot } = at(33);
		const found = improvements(snapshot);
		const [newest, next] = found;

		assert.ok(newest && next);
		assert.equal(`${newest.driver.code} ${newest.from}->${newest.to}`, 'RUS 13->1');
		assert.equal(newest.part, 2);
		assert.equal(newest.fastest, true);
		assert.ok((newest.lap.completedAt ?? '') >= (next.lap.completedAt ?? ''));
	});

	it('never counts a lap that was slower than the car’s own best of the part', () => {
		const found = improvements(baku);
		const best = new Map<string, number>();

		for (const entry of found.toReversed()) {
			const key = `${entry.driver.number}-${entry.part}`;
			const previous = best.get(key);

			assert.ok(previous === undefined || entry.lap.lapTimeMs < previous, key);
			best.set(key, entry.lap.lapTimeMs);
		}
	});

	it('keeps the newest per car within a window', () => {
		const { snapshot, time } = at(33);
		const recent = recentImprovements(improvements(snapshot), time, 60_000);

		assert.ok(recent.size > 0);

		for (const entry of recent.values()) {
			assert.ok(time - Date.parse(entry.lap.completedAt ?? '') <= 60_000);
		}
	});
});
