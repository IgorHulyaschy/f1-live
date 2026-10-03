import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { GapCar } from '../../insights/gap-distance.ts';
import { layoutStraight, tickStep } from './straight-layout.ts';

function car(position: number, metres: number): GapCar {
	return {
		driverNumber: String(position),
		position,
		lap: null,
		gapMs: metres * 13,
		metres,
		estimated: false
	};
}

describe('the straight', () => {
	it('picks about six ticks', () => {
		assert.deepEqual([tickStep(8), tickStep(22), tickStep(120), tickStep(240)], [5, 5, 25, 50]);
	});

	it('scales the furthest car to the end of a whole tick, and alternates the lanes', () => {
		const layout = layoutStraight([car(1, 0), car(2, 22), car(3, 28.5)], {
			lengthPx: 300,
			labelLengthPx: 30,
			tracks: 1
		});

		assert.deepEqual([layout.metres, layout.tickM, layout.scale], [30, 5, 10]);
		assert.deepEqual(
			layout.slots.map((slot) => [slot.lane, slot.at]),
			[
				[0, 0],
				[1, 220],
				[0, 285]
			]
		);
	});

	it('pushes a label back along its lane rather than over the one before it', () => {
		const layout = layoutStraight([car(1, 0), car(3, 1), car(5, 2)], {
			lengthPx: 100,
			labelLengthPx: 20,
			tracks: 1,
			gapPx: 2
		});

		// Pole's label starts at the line; the next two follow it down the same lane.
		assert.deepEqual(
			layout.slots.map((slot) => slot.labelAt),
			[10, 32, 54]
		);
	});

	it('uses a free row beside the lane before pushing back', () => {
		const layout = layoutStraight([car(1, 0), car(3, 1)], {
			lengthPx: 100,
			labelLengthPx: 20,
			tracks: 2
		});

		assert.deepEqual(
			layout.slots.map((slot) => [slot.track, slot.labelAt]),
			[
				[0, 10],
				[1, 10]
			]
		);
	});
});
