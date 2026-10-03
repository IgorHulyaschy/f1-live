import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildPitLane } from './pitlane.js';
import type { PitPass } from './pitlane.js';
import type { PositionTrack } from './series.js';
import { LENGTH_M, stadiumOutline } from './test-circuit.js';

const outline = stadiumOutline();

/** A car going 20 m/s along y = -330 (30 m beside the track) from x = -300, a sample every 250 ms. */
function lane(startAt: number, seconds: number, standStillFrom?: number): PositionTrack {
	const count = Math.round(seconds * 4) + 1;
	const at = Float64Array.from({ length: count }, (_, index) => startAt + index * 250);
	let x = -300;

	return {
		at,
		x: Float64Array.from(at, (_, index) => {
			if (standStillFrom === undefined || index < standStillFrom * 4) {
				x += 5;
			}

			return x;
		}),
		y: at.map(() => -330),
		offTrack: new Uint8Array(count)
	};
}

describe('buildPitLane', () => {
	const latency = 200;

	it('takes the lane from the pass that did not stop, and says where along the lap it runs', () => {
		const tracks = new Map([
			['1', lane(0, 30, 10)],
			['4', lane(0, 20)]
		]);

		const passes: PitPass[] = [
			{ driverNumber: '1', entryAt: latency, exitAt: 30_000 + latency },
			{ driverNumber: '4', entryAt: latency, exitAt: 20_000 + latency }
		];

		const found = buildPitLane(outline, tracks, passes, latency);

		assert.ok(found !== null);
		assert.ok(found.points.length >= 70, `${found.points.length} points`);
		assert.deepEqual(found.points[0], [-295, -330]);
		assert.ok(Math.abs((found.points.at(-1)?.[0] ?? 0) - 100) < 10, 'ran for 20 s at 20 m/s');
		assert.ok(Math.abs(found.entryM - (LENGTH_M - 295)) < 10, `entry at ${found.entryM}`);
		assert.ok(Math.abs(found.exitM - 100) < 10, `exit at ${found.exitM}`);
	});

	it('gives up when no pass is long enough to be a pit lane', () => {
		const tracks = new Map([['1', lane(0, 4)]]);

		assert.equal(
			buildPitLane(outline, tracks, [{ driverNumber: '1', entryAt: 0, exitAt: 4000 }], 0),
			null
		);
		assert.equal(buildPitLane(outline, tracks, [], 0), null);
	});

	it('gives up when the car has no positions', () => {
		assert.equal(
			buildPitLane(outline, new Map(), [{ driverNumber: '1', entryAt: 0, exitAt: 20_000 }], 0),
			null
		);
	});
});
