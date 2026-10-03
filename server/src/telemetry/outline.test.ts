import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LENGTH_M, driveLaps, stadiumOutline } from './test-circuit.js';
import { loopFromLap, longSideRotationDeg, provisionalOutline, rotateStart } from './outline.js';

/** Positive for a loop driven counter-clockwise. */
function signedArea(points: readonly (readonly [number, number])[]): number {
	return (
		points.reduce((sum, [x, y], index) => {
			const [nextX, nextY] = points[(index + 1) % points.length] ?? [x, y];

			return sum + (x * nextY - nextX * y);
		}, 0) / 2
	);
}

describe('loopFromLap', () => {
	const driven = driveLaps([{ lapSeconds: 80, swing: 0.1 }], 0, 0.4, 3);
	const [startAt = 0, endAt = 0] = driven.crossings;
	const loop = loopFromLap(driven.track, startAt, endAt);

	it('draws a closed line as long as the circuit, within 1%', () => {
		assert.ok(Math.abs(loop.lengthM - LENGTH_M) / LENGTH_M < 0.01, `length ${loop.lengthM}`);

		const [first, last] = [loop.points[0], loop.points.at(-1)];
		const step = loop.lengthM / loop.points.length;

		assert.ok(first !== undefined && last !== undefined);
		assert.ok(
			Math.hypot(first[0] - last[0], first[1] - last[1]) < 1.5 * step,
			'the last point joins the first'
		);
	});

	it('spaces its points evenly, about 5 m apart', () => {
		const gaps = loop.points.map(([x, y], index) => {
			const [nextX, nextY] = loop.points[(index + 1) % loop.points.length] ?? [x, y];

			return Math.hypot(nextX - x, nextY - y);
		});

		assert.ok(
			Math.min(...gaps) > 4 && Math.max(...gaps) < 6,
			`${Math.min(...gaps)} to ${Math.max(...gaps)}`
		);
	});

	it('keeps the direction the car drove', () => {
		assert.ok(signedArea(loop.points) > 0);
	});

	it('refuses a lap with too few samples', () => {
		assert.throws(
			() => loopFromLap(driven.track, startAt, startAt + 3000),
			/too few position samples/
		);
	});
});

describe('rotateStart', () => {
	it('starts the loop at the point nearest the shift and says how far it moved', () => {
		const outline = stadiumOutline();
		const { outline: moved, shiftedM } = rotateStart(outline, 1000);
		const step = outline.lengthM / outline.points.length;

		assert.ok(Math.abs(shiftedM - 1000) <= step / 2 + 1e-9);
		assert.deepEqual(moved.points[0], outline.points[Math.round(shiftedM / step)]);
		assert.equal(moved.points.length, outline.points.length);
	});

	it('moves a negative shift backwards round the loop', () => {
		const outline = stadiumOutline();
		const { outline: moved } = rotateStart(outline, -5);

		assert.deepEqual(moved.points[0], outline.points.at(-1));
	});
});

describe('longSideRotationDeg', () => {
	it('is 0 for a circuit already lying along x and 90 once turned', () => {
		const outline = stadiumOutline();
		const turned = outline.points.map(([x, y]): [number, number] => [-y, x]);

		assert.equal(Math.abs(longSideRotationDeg(outline.points)), 0);
		assert.equal(Math.abs(longSideRotationDeg(turned)), 90);
	});

	it('turns a diagonal circuit by the angle that levels it', () => {
		const angle = Math.PI / 6;

		const diagonal = stadiumOutline().points.map(([x, y]): [number, number] => [
			x * Math.cos(angle) - y * Math.sin(angle),
			x * Math.sin(angle) + y * Math.cos(angle)
		]);

		assert.ok(Math.abs(longSideRotationDeg(diagonal) + 30) < 0.5);
	});
});

describe('provisionalOutline', () => {
	it('wraps the loop with thirds for sectors until they are placed', () => {
		const driven = driveLaps([{ lapSeconds: 80, swing: 0.1 }], 0, 0.4, 3);
		const [startAt = 0, endAt = 0] = driven.crossings;
		const loop = loopFromLap(driven.track, startAt, endAt);

		const outline = provisionalOutline(loop, {
			circuitKey: 'x',
			name: 'X',
			source: { sessionKey: 1, driverNumber: '1', lap: 2, lapTimeMs: 80_000, miniSectors: 'even' }
		});

		assert.equal(outline.lengthM, loop.lengthM);
		assert.equal(outline.sectorBoundariesM[0], loop.lengthM / 3);
		assert.equal(outline.miniSectorStartsM.length, 3);
	});
});
