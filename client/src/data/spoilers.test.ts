import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	isRevealed,
	MAX_REVEALED,
	mergeRevealed,
	resultsHidden,
	spoilerSafeStep,
	withRevealed
} from './spoilers.ts';

const protectedViewer = { protect: true, revealed: ['9858'] };

describe('isRevealed', () => {
	it('shows a session the viewer revealed and hides the rest', () => {
		assert.equal(isRevealed(protectedViewer, '9858'), true);
		assert.equal(isRevealed(protectedViewer, '11373'), false);
	});

	it('shows everything with protection off', () => {
		assert.equal(isRevealed({ protect: false, revealed: [] }, '11373'), true);
	});
});

describe('resultsHidden', () => {
	it('never hides a session watched live', () => {
		assert.equal(resultsHidden(protectedViewer, '11730', true), false);
		assert.equal(resultsHidden(protectedViewer, '11730', false), true);
	});
});

describe('spoilerSafeStep', () => {
	it('opens a hidden session at its start and a revealed one where the source says', () => {
		assert.equal(
			spoilerSafeStep({ requested: null, hidden: true, lastStep: 62, revealedStep: 62 }),
			1
		);
		assert.equal(
			spoilerSafeStep({ requested: null, hidden: false, lastStep: 50, revealedStep: 50 }),
			50
		);
	});

	it('lets a position in the link win, clamped to the steps there are', () => {
		assert.equal(
			spoilerSafeStep({ requested: '30', hidden: true, lastStep: 50, revealedStep: 50 }),
			30
		);
		assert.equal(
			spoilerSafeStep({ requested: '99', hidden: true, lastStep: 50, revealedStep: 50 }),
			50
		);
	});

	it('ignores a position that is not a step', () => {
		for (const requested of ['0', '-3', '2.5', 'end', '']) {
			assert.equal(spoilerSafeStep({ requested, hidden: true, lastStep: 50, revealedStep: 50 }), 1);
		}
	});
});

describe('withRevealed', () => {
	it('moves a session to the newest end without repeating it', () => {
		assert.deepEqual(withRevealed(['a', 'b', 'c'], 'a'), ['b', 'c', 'a']);
	});

	it('drops the oldest past the limit', () => {
		const full = Array.from({ length: MAX_REVEALED }, (_, index) => String(index));
		const next = withRevealed(full, 'new');

		assert.equal(next.length, MAX_REVEALED);
		assert.equal(next[0], '1');
		assert.equal(next.at(-1), 'new');
	});
});

describe('mergeRevealed', () => {
	it('keeps every session revealed on either device, this one newest', () => {
		assert.deepEqual(mergeRevealed(['b', 'c'], ['a', 'b']), ['a', 'b', 'c']);
	});
});
