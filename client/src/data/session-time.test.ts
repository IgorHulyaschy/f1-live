import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EMPTY_SNAPSHOT, type Lap, type RaceSnapshot } from '@f1-live/shared';

import { ReplayClock } from './replay-clock.ts';
import { crossingTimes, replayTimeline, stepAt, stepShowing, stepTime } from './session-time.ts';

const START = Date.UTC(2025, 10, 23, 4, 4, 8);

function lapOf(driverNumber: string, lapNumber: number, lapTimeMs: number, crossedS?: number): Lap {
	return {
		driverNumber,
		lap: lapNumber,
		lapTimeMs,
		sectorTimesMs: [30_000, 30_000, lapTimeMs - 60_000],
		position: driverNumber === '1' ? 1 : 2,
		gapToLeaderMs: 0,
		intervalMs: 0,
		compound: 'HARD',
		tyreAge: lapNumber,
		pitIn: false,
		pitOut: false,
		trackStatus: 'green',
		completedAt:
			crossedS === undefined ? undefined : new Date(START + crossedS * 1000).toISOString()
	};
}

function race(laps: readonly Lap[], currentLap: number): RaceSnapshot {
	return {
		...EMPTY_SNAPSHOT,
		session: { ...EMPTY_SNAPSHOT.session, type: 'race', startsAt: '2025-11-23T04:00:00.000Z' },
		startedAt: new Date(START).toISOString(),
		laps,
		currentLap
	};
}

describe('replay timeline', () => {
	it('ends each lap when its first car crosses the line, and starts at the start signal', () => {
		const timeline = replayTimeline(
			race(
				[
					lapOf('1', 1, 100_000, 100),
					lapOf('4', 1, 101_000, 101),
					lapOf('4', 2, 95_000, 196),
					lapOf('1', 2, 96_500, 196.5)
				],
				2
			)
		);

		assert.deepEqual(timeline, { unit: 'lap', times: [START, START + 100_000, START + 196_000] });
	});

	it('adds up lap times where laps carry no crossing time, as in the modelled replay', () => {
		const crossings = crossingTimes(race([lapOf('1', 1, 100_000), lapOf('1', 2, 95_000)], 2));

		assert.deepEqual(crossings.get('1'), [START, START + 100_000, START + 195_000]);
	});

	it('steps on the clock by the minute in timed sessions', () => {
		const practice: RaceSnapshot = {
			...race([lapOf('1', 1, 90_000, 150)], 1),
			session: { ...EMPTY_SNAPSHOT.session, type: 'practice', startsAt: '' }
		};

		const timeline = replayTimeline(practice);

		assert.equal(timeline.unit, 'minute');
		assert.deepEqual(timeline.times, [START, START + 60_000, START + 120_000, START + 180_000]);
		assert.equal(stepTime(timeline, 2), START + 120_000);
		assert.equal(stepAt(timeline, START + 150_000), 2);
	});

	it('shows a lap as it ended, the first from the start, and counts laps done by a time', () => {
		const timeline = { unit: 'lap', times: [0, 100, 200, 300] } as const;

		assert.equal(stepTime(timeline, 1), 0);
		assert.equal(stepTime(timeline, 2), 200);
		assert.equal(stepTime(timeline, 9), 300);
		assert.deepEqual(
			[-5, 0, 99, 100, 199, 250, 300, 400].map((time) => stepAt(timeline, time)),
			[1, 1, 1, 1, 1, 2, 3, 3]
		);
	});
});

describe('ReplayClock', () => {
	it('holds still, runs at a rate from where it was set, and tells listeners', () => {
		const clock = new ReplayClock();
		let heard = 0;

		clock.subscribe(() => {
			heard++;
		});
		clock.set(1000, 0, 0);
		assert.equal(clock.now(5000), 1000);
		clock.set(1000, 10, 5000);
		assert.equal(clock.now(5500), 6000);
		assert.equal(clock.running, true);
		assert.equal(heard, 2);
		// Stepped once a second of real time from when it was set, never before that.
		assert.equal(clock.stepped(6900, 1000), 11_000);
		assert.equal(clock.stepped(5400, 1000), 1000);
		assert.equal(clock.stepped(4000, 1000), 1000);
	});
});

describe('stepShowing', () => {
	const minutes = { unit: 'minute' as const, times: [0, 60_000, 120_000, 180_000] };

	it('takes a race moment by its lap, within the laps run', () => {
		const laps = { unit: 'lap' as const, times: [0, 90_000, 180_000] };

		assert.equal(stepShowing(laps, { lap: 2 }), 2);
		assert.equal(stepShowing(laps, { lap: 9 }), 2);
	});

	it('takes a timed moment to the minute by whose end it happened', () => {
		assert.equal(stepShowing(minutes, { lap: 4, at: new Date(90_000).toISOString() }), 2);
		assert.equal(stepShowing(minutes, { lap: 4, at: new Date(120_000).toISOString() }), 2);
		assert.equal(stepShowing(minutes, { lap: 1, at: new Date(0).toISOString() }), 1);
		assert.equal(stepShowing(minutes, { lap: 9, at: new Date(999_000).toISOString() }), 3);
		assert.equal(stepShowing(minutes, { lap: 1 }), null);
	});
});
