import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { plural } from './format.ts';

describe('plural', () => {
	it('uses the singular for exactly one', () => {
		assert.equal(plural(1, 'lap'), '1 lap');
	});

	it('uses the plural for zero and for more than one', () => {
		assert.equal(plural(0, 'lap'), '0 laps');
		assert.equal(plural(2, 'lap'), '2 laps');
	});

	it('takes an irregular plural and groups thousands', () => {
		assert.equal(
			plural(1, 'stop-and-go penalty', 'stop-and-go penalties'),
			'1 stop-and-go penalty'
		);
		assert.equal(plural(1204, 'lap'), '1,204 laps');
	});
});
