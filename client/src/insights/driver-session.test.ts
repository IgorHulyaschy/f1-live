import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { minuteTime, sessionClock, snapshotAtTime } from '../data/snapshot-at-time.ts';
import { bestDriverLap, driverLaps, qualifyingRuns } from './driver-session.ts';
import { fixtureSession } from './test-fixtures.ts';

/** 2026 Baku qualifying: Russell (63) on pole, Albon (23) out in Q2 after a deleted Q1 lap. */
const baku = fixtureSession('11373');

describe('driverLaps', () => {
	it('marks each lap as the timing screen did when it was set', () => {
		const laps = driverLaps(baku, '63');
		const marked = laps.filter((entry) => entry.lapMark !== 'none');

		assert.deepEqual(
			marked.map((entry) => `${entry.lap.lap} ${entry.lapMark}`),
			['4 personal-best', '6 fastest', '9 fastest', '18 fastest', '24 fastest', '26 fastest']
		);
		assert.deepEqual(laps.at(-1)?.sectorMarks, ['fastest', 'fastest', 'fastest']);
		assert.equal(bestDriverLap(laps)?.lap.lapTimeMs, 102_526);
	});

	it('keeps out-laps, cool-downs and deleted times out of the bests', () => {
		const laps = driverLaps(baku, '23');
		const deleted = laps.find((entry) => entry.deleted);

		assert.equal(deleted?.lap.lap, 4);
		assert.equal(deleted?.lapMark, 'none');
		assert.equal(laps.find((entry) => entry.lap.lap === 3)?.push, false);
		assert.equal(laps.find((entry) => entry.lap.lap === 6)?.lap.pitOut, true);
	});

	it('sees only the laps run by the moment on screen', () => {
		const early = snapshotAtTime(baku, minuteTime(sessionClock(baku), 12));
		const laps = driverLaps(early, '63');

		assert.ok(laps.length > 0);
		assert.ok(laps.every((entry) => entry.part === 1));
		assert.equal(bestDriverLap(laps)?.lap.lap, 6);
	});

	it('marks race laps from lap 2, after the standing start', () => {
		const laps = driverLaps(fixtureSession('9858'), '1');

		assert.equal(laps[0]?.lapMark, 'none');
		assert.equal(laps[1]?.lapMark, 'fastest');
		assert.equal(laps.length, 50);
	});
});

describe('qualifyingRuns', () => {
	it('splits the session into runs per part, push laps only', () => {
		const runs = qualifyingRuns(driverLaps(baku, '23'));

		assert.deepEqual(
			runs.map((run) => `Q${run.part} run ${run.number}: ${run.pushLaps.length} pushed`),
			['Q1 run 1: 1 pushed', 'Q1 run 2: 2 pushed', 'Q2 run 1: 1 pushed', 'Q2 run 2: 1 pushed']
		);
		// The only push lap of the first run was deleted, so it has no best.
		assert.equal(runs[0]?.best, null);
		assert.equal(runs[1]?.best?.lap.lapTimeMs, 105_031);
	});
});
