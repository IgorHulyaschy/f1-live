import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bestSectors } from './sectors.ts';
import { fixtureSession } from './test-fixtures.ts';

describe('best sectors', () => {
	const { fastest, ideal } = bestSectors(fixtureSession('9854'));

	it('names who holds each fastest sector of 2025 Las Vegas qualifying', () => {
		assert.deepEqual(
			fastest.map((holder) => holder && `${holder.driver.code} ${holder.timeMs}`),
			['NOR 30430', 'NOR 36842', 'SAI 39794']
		);
	});

	it('adds each driver’s best sectors into an ideal lap, never slower than their best', () => {
		const [first] = ideal;

		assert.ok(first);
		assert.equal(first.driver.code, 'NOR');
		assert.equal(first.idealMs, 107_656);
		assert.equal(first.bestMs, 107_934);

		for (const entry of ideal) {
			assert.equal(entry.idealMs, entry.sectorsMs[0] + entry.sectorsMs[1] + entry.sectorsMs[2]);
			assert.ok(entry.bestMs === null || entry.idealMs <= entry.bestMs, entry.driver.code);
		}

		assert.deepEqual(
			ideal.map((entry) => entry.idealMs),
			ideal.map((entry) => entry.idealMs).toSorted((a, b) => a - b)
		);
	});
});
