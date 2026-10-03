import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EMPTY_SNAPSHOT, type Lap, type RaceSnapshot } from '@f1-live/shared';

import {
	type Arrival,
	delayedSnapshot,
	feedClock,
	feedTimeOf,
	MAX_DELAY_SECONDS,
	recordArrival
} from './broadcast-delay.ts';
import { stepDelay } from './viewer-settings.ts';

const FEED_START = Date.UTC(2026, 9, 3, 8, 0, 0);

function lapAt(lapNumber: number, seconds: number): Lap {
	return {
		driverNumber: '1',
		lap: lapNumber,
		lapTimeMs: 90_000,
		sectorTimesMs: [30_000, 30_000, 30_000],
		position: 1,
		gapToLeaderMs: 0,
		intervalMs: 0,
		compound: 'SOFT',
		tyreAge: lapNumber,
		pitIn: false,
		pitOut: false,
		trackStatus: 'green',
		completedAt: new Date(FEED_START + seconds * 1000).toISOString()
	};
}

function withLaps(count: number): RaceSnapshot {
	const laps = Array.from({ length: count }, (_, index) => lapAt(index + 1, (index + 1) * 90));

	return { ...EMPTY_SNAPSHOT, laps, currentLap: count };
}

describe('broadcast delay', () => {
	it('shows the state that had arrived a delay ago', () => {
		const history: Arrival[] = [
			{ receivedAt: 1000, snapshot: withLaps(3) },
			{ receivedAt: 4000, snapshot: withLaps(4) },
			{ receivedAt: 7000, snapshot: withLaps(5) }
		];

		assert.equal(delayedSnapshot(history, 9000, 3000)?.currentLap, 4);
		assert.equal(delayedSnapshot(history, 9000, 0)?.currentLap, 5);
	});

	it('cuts the first state back by its own times for a viewer who joined late', () => {
		const joined = withLaps(5);
		const history: Arrival[] = [{ receivedAt: 100_000, snapshot: joined }];

		assert.equal(feedTimeOf(joined), FEED_START + 450_000);
		// 100 s before joining, the feed stood at 350 s: three laps done.
		assert.equal(delayedSnapshot(history, 130_000, 130_000)?.currentLap, 3);
	});

	it('keeps only what the longest delay needs', () => {
		let history: Arrival[] = [];

		for (let second = 0; second <= MAX_DELAY_SECONDS + 10; second += 5) {
			history = recordArrival(history, { receivedAt: second * 1000, snapshot: EMPTY_SNAPSHOT });
		}

		assert.equal(history[0]?.receivedAt, 10_000);
		assert.equal(history.at(-1)?.receivedAt, (MAX_DELAY_SECONDS + 10) * 1000);
	});

	it('steps by tenths without drift, between 0 and the maximum', () => {
		assert.equal(stepDelay(0.2, 0.1), 0.3);
		assert.equal(stepDelay(0.3, -1), 0);
		assert.equal(stepDelay(MAX_DELAY_SECONDS, 1), MAX_DELAY_SECONDS);
	});

	it('runs a replay on its own clock and a live feed on the wall clock', () => {
		const replayed: Arrival = { receivedAt: FEED_START + 400 * 86_400_000, snapshot: withLaps(3) };

		assert.equal(feedClock([replayed], replayed.receivedAt + 1500, 0), FEED_START + 270_000 + 1500);
		assert.equal(
			feedClock([replayed], replayed.receivedAt + 1500, 1000),
			FEED_START + 270_000 + 500
		);

		const live: Arrival = { receivedAt: FEED_START + 271_000, snapshot: withLaps(3) };

		assert.equal(feedClock([live], live.receivedAt + 2000, 1000), live.receivedAt + 1000);
	});
});
