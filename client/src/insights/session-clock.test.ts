import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EMPTY_SNAPSHOT } from '@f1-live/shared';

import { minuteTime, sessionClock, snapshotAtTime } from '../data/snapshot-at-time.ts';
import { clockAt, formatCountdown } from './session-clock.ts';
import { fixtureSession } from './test-fixtures.ts';

const START = Date.parse('2026-09-25T12:04:01.011Z');

const snapshot = {
	...EMPTY_SNAPSHOT,
	clockLog: [
		{ at: '2026-09-25T11:47:16.007Z', remainingMs: 1_080_000, running: false },
		{ at: '2026-09-25T12:04:01.011Z', remainingMs: 1_079_000, running: true },
		{ at: '2026-09-25T12:10:00.000Z', remainingMs: 720_000, running: false }
	]
};

describe('session clock', () => {
	it('has no reading before the feed sets it', () => {
		assert.equal(clockAt(snapshot, Date.parse('2026-09-25T11:00:00.000Z')), null);
	});

	it('holds while stopped and counts down while running', () => {
		assert.deepEqual(clockAt(snapshot, START - 60_000), { remainingMs: 1_080_000, running: false });
		assert.deepEqual(clockAt(snapshot, START + 79_000), { remainingMs: 1_000_000, running: true });
		assert.deepEqual(clockAt(snapshot, START + 3_600_000), {
			remainingMs: 720_000,
			running: false
		});
	});

	it('never reads below zero', () => {
		const late = { ...snapshot, clockLog: snapshot.clockLog.slice(0, 2) };

		assert.equal(clockAt(late, START + 7_200_000)?.remainingMs, 0);
	});

	it('prints minutes and seconds, and hours when there are any', () => {
		assert.equal(formatCountdown(522_000), '8:42');
		assert.equal(formatCountdown(59_400), '1:00');
		assert.equal(formatCountdown(3_723_000), '1:02:03');
		assert.equal(formatCountdown(0), '0:00');
	});

	it('reads the second part of Baku qualifying from the saved session, minute by minute', () => {
		const race = fixtureSession('11373');
		const time = minuteTime(sessionClock(race), 33);
		const cut = snapshotAtTime(race, time);

		// Q2 ran from 12:29:01 with 14:59 to go; minute 33 of the session is 7 minutes before its end.
		const reading = clockAt(cut, time);

		assert.equal(reading?.running, true);
		assert.equal(formatCountdown(reading?.remainingMs ?? 0), '7:00');
	});
});
