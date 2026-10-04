import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { screenFactor } from './screen-factor.ts';

describe('screen factor', () => {
	it('keeps phones, laptops and 1080p at the base size', () => {
		assert.equal(screenFactor(390, 844), 1);
		assert.equal(screenFactor(1440, 900), 1);
		assert.equal(screenFactor(1920, 1080), 1);
	});

	it('grows text on 1440p and ultrawide screens by their height', () => {
		assert.equal(screenFactor(2560, 1440), 1.1875);
		assert.equal(screenFactor(3440, 1440), 1.1875);
	});

	it('stops at one and a half', () => {
		assert.equal(screenFactor(7680, 4320), 1.5);
	});
});
