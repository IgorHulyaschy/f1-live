import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { checkHandle, hasBlockedWord, type Policy } from './moderation.js';

const NONE: Policy = { reservedHandles: [], blockedWords: [] };

describe('handles', () => {
	it('takes lower-case letters, digits and underscores, from 3 to 20, starting with a letter', () => {
		assert.deepEqual(checkHandle('  @Box_Box_42 ', NONE), { ok: true, handle: 'box_box_42' });

		for (const bad of ['ab', '1abc', 'has space', 'dash-ed', 'a'.repeat(21), 'émile', '']) {
			assert.deepEqual(checkHandle(bad, NONE), { ok: false, reason: 'format' }, bad);
		}
	});

	it('keeps names that pass for the product, its staff or the sport', () => {
		for (const reserved of ['admin', 'Pitwall', 'pitwall_news', 'official_f1', 'formula1', 'fia']) {
			assert.deepEqual(checkHandle(reserved, NONE), { ok: false, reason: 'reserved' }, reserved);
		}

		assert.deepEqual(checkHandle('pitstop', NONE), { ok: true, handle: 'pitstop' });
	});

	it('refuses the owner’s additions to both lists', () => {
		const policy: Policy = { reservedHandles: ['ferrari'], blockedWords: ['mclaren'] };

		assert.deepEqual(checkHandle('ferrari', policy), { ok: false, reason: 'reserved' });
		assert.deepEqual(checkHandle('mclaren_fan', policy), { ok: false, reason: 'profanity' });
	});

	it('refuses profanity, in leetspeak and inside a longer name, but not innocent look-alikes', () => {
		for (const bad of ['sh1thead', 'big_fuck', 'xxfuckxx', 'n4zi_hunter', 'the_ass']) {
			assert.deepEqual(checkHandle(bad, NONE), { ok: false, reason: 'profanity' }, bad);
		}

		// Short blocked words count as whole parts only: Essex and Cassidy are fine.
		for (const fine of ['essex_fan', 'cassidy', 'scunthorpe', 'class_of_2025', 'assen_fan']) {
			assert.equal(checkHandle(fine, NONE).ok, true, fine);
		}
	});
});

describe('free text', () => {
	it('refuses a blocked word as a whole word, through punctuation and digits', () => {
		for (const bad of ['This is shit', 'sh1t.', 'what the fuck!', 'Total SH!T']) {
			assert.equal(hasBlockedWord(bad, NONE), true, bad);
		}
	});

	it('leaves real descriptions alone', () => {
		for (const fine of [
			'Gaps around your driver, tyres and the flags',
			'Assen, Essex and Scunthorpe',
			'Race day 2025, laptop next to the TV'
		]) {
			assert.equal(hasBlockedWord(fine, NONE), false, fine);
		}
	});
});
