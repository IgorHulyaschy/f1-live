import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fightsHeadline, leaderHeadline, messageHeadline, stintsHeadline } from './headlines.ts';

describe('leaderHeadline', () => {
	it('names the leader and the gap to second', () => {
		assert.equal(
			leaderHeadline([
				{ code: 'AAA', gapToLeaderMs: 0 },
				{ code: 'BBB', gapToLeaderMs: 3240 }
			]),
			'AAA leads BBB by 3.2 s'
		);
	});

	it('is empty without cars', () => {
		assert.equal(leaderHeadline([]), null);
	});
});

describe('fightsHeadline', () => {
	it('names the closest pair and counts the rest', () => {
		assert.equal(
			fightsHeadline([
				{ ahead: 'AAA', behind: 'BBB', gapSeconds: 0.84 },
				{ ahead: 'CCC', behind: 'DDD', gapSeconds: 0.3 }
			]),
			'DDD is 0.3 s behind CCC, and 1 more fight'
		);
	});

	it('says so when nobody fights', () => {
		assert.equal(fightsHeadline([]), 'No car is in a fight');
	});
});

describe('messageHeadline', () => {
	it('quotes the latest message', () => {
		assert.equal(
			messageHeadline([
				{ lap: 3, category: 'flag', message: 'YELLOW IN TURN 4' },
				{ lap: 9, category: 'flag', message: 'CLEAR IN TURN 4' }
			]),
			'Lap 9: CLEAR IN TURN 4'
		);
	});
});

describe('stintsHeadline', () => {
	it('names the longest stint', () => {
		const stints = [
			{ driverNumber: '1', stint: 1, compound: 'SOFT', startLap: 1, endLap: 12 },
			{ driverNumber: '2', stint: 1, compound: 'MEDIUM', startLap: 1, endLap: 43 }
		] as const;

		assert.equal(
			stintsHeadline(
				stints,
				(number) => (number === '2' ? 'BBB' : 'AAA'),
				(compound) => (compound === 'MEDIUM' ? 'Medium' : 'Soft')
			),
			'BBB ran the longest stint so far, 43 laps on medium tyres'
		);
	});

	it('says "1 lap" for a one-lap stint', () => {
		const stints = [
			{ driverNumber: '2', stint: 1, compound: 'MEDIUM', startLap: 5, endLap: 5 }
		] as const;

		assert.equal(
			stintsHeadline(
				stints,
				() => 'BBB',
				() => 'Medium'
			),
			'BBB ran the longest stint so far, 1 lap on medium tyres'
		);
	});
});
