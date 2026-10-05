import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fixtureSession } from './test-fixtures.ts';
import { adjacentEventStep, markKind, matchesFilter, timelineEvents } from './timeline.ts';

describe('timeline events', () => {
	const race = timelineEvents(fixtureSession('9858'));

	it('mark the start and each flag as it comes out, not every lap it stays', () => {
		assert.deepEqual(
			race
				.filter((event) => event.lane === 'start' || event.lane === 'flags')
				.map((event) => `${event.step} ${event.text}`),
			['1 Start', '1 Yellow flag', '2 Virtual Safety Car', '15 Virtual Safety Car']
		);
	});

	it('give each marker one meaning a legend can name, and leave passes off the track', () => {
		const kinds = new Set(race.map(markKind));

		assert.deepEqual(
			[...kinds].toSorted(),
			['fastest', 'flag', 'lead', 'red', 'start', 'stop', null].toSorted()
		);
		assert.ok(
			race.filter((event) => event.lane === 'passes').every((event) => markKind(event) === null)
		);
		assert.equal(
			markKind({ id: 'f', step: 3, lane: 'flags', tone: 'red', text: 'Red flag' }),
			'red'
		);
	});

	it('jump to the next or previous event the filter keeps', () => {
		assert.equal(adjacentEventStep(race, 10, 1, 'stops', '16'), 13);
		assert.equal(adjacentEventStep(race, 10, 1, 'flags', '16'), 15);
		assert.equal(adjacentEventStep(race, 15, -1, 'flags', '16'), 2);
		assert.equal(adjacentEventStep(race, 20, 1, 'mine', '16'), 22);
		assert.equal(adjacentEventStep(race, 15, 1, 'flags', '16'), null);
	});

	it('keep a followed driver’s own moments under Mine', () => {
		const mine = race.filter((event) => matchesFilter(event, 'mine', '16'));

		assert.ok(mine.length > 0);
		assert.ok(mine.every((event) => event.driverNumber === '16'));
		assert.ok(mine.some((event) => event.text === 'LEC stops for hards, 2.7 s still'));
	});

	it('mark where each part of qualifying starts, by the minute', () => {
		assert.deepEqual(
			timelineEvents(fixtureSession('11373'))
				.filter((event) => event.lane === 'start')
				.map((event) => `${event.step} ${event.text}`),
			['1 Q1 starts', '25 Q2 starts', '48 Q3 starts']
		);
	});
});
