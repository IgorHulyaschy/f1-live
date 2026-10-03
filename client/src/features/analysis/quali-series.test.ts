import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fixtureSession } from '../../insights/test-fixtures.ts';
import { bestKey, partSpans, qualiLapPoints, qualiPartPoints } from './quali-series.ts';

// 2026 Bahrain qualifying: Verstappen fastest in all three parts, 1:35.130 for pole.
const bahrain = fixtureSession('11730');

const drivers = bahrain.drivers.filter((driver) => ['3', '44', '16'].includes(driver.number));

describe('qualifying charts', () => {
	it('lays the three parts out on the session clock', () => {
		const spans = partSpans(bahrain);

		assert.deepEqual(
			spans.map((span) => span.part),
			[1, 2, 3]
		);
		assert.equal(spans[0]?.from, 0);
		assert.ok(spans.every((span) => span.to > span.from));
	});

	it('plots push laps only, within a few per cent of pole, never a cool-down lap', () => {
		const points = qualiLapPoints(bahrain, drivers);

		const times = points.flatMap((point) =>
			['VER', 'HAM', 'LEC'].flatMap((code) => (point[code] === undefined ? [] : [point[code]]))
		);

		assert.ok(times.length >= 9, `${times.length}`);
		assert.ok(Math.max(...times) < 95.13 * 1.12);
		assert.equal(Math.min(...times), 95.13);
	});

	it('steps each best-so-far line down at an improvement and never up', () => {
		const line = qualiLapPoints(bahrain, drivers).flatMap((point) => {
			const value = point[bestKey('VER', 3)];

			return value === undefined ? [] : [value];
		});

		assert.ok(line.length >= 2);
		assert.deepEqual(
			line,
			line.toSorted((a, b) => b - a)
		);
		assert.equal(line.at(-1), 95.13);
	});

	it('gives each part its own gap to the fastest and its own order', () => {
		const gaps = qualiPartPoints(bahrain, drivers, 'gap');
		const order = qualiPartPoints(bahrain, drivers, 'position');

		assert.deepEqual(
			gaps.map((point) => point.VER),
			[0, 0, 0]
		);
		// Hamilton was second in Q3, 0.298 s back.
		assert.equal(gaps[2]?.HAM, 0.298);
		assert.equal(order[2]?.HAM, 2);
	});
});
