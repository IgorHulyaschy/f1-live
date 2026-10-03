import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MAX_REVEALED, mergeRevealed, mergeViewerSettings } from './viewer.ts';

describe('mergeRevealed', () => {
	it('keeps every session revealed on either device, the newer ones last', () => {
		assert.deepEqual(mergeRevealed(['b', 'c'], ['a', 'b']), ['a', 'b', 'c']);
	});

	it('drops the oldest past the limit', () => {
		const older = Array.from({ length: MAX_REVEALED }, (_, index) => String(index));
		const merged = mergeRevealed(['new'], older);

		assert.equal(merged.length, MAX_REVEALED);
		assert.equal(merged.at(-1), 'new');
		assert.equal(merged[0], '1');
	});
});

describe('mergeViewerSettings', () => {
	const stored = {
		protect: true,
		protectUpdatedAt: '2026-10-03T08:00:00.000Z',
		revealed: ['9858']
	};

	it('takes the newer protection change and every reveal', () => {
		const merged = mergeViewerSettings(stored, {
			protect: false,
			protectUpdatedAt: '2026-10-03T09:00:00.000Z',
			revealed: ['11373']
		});

		assert.deepEqual(merged, {
			protect: false,
			protectUpdatedAt: '2026-10-03T09:00:00.000Z',
			revealed: ['9858', '11373']
		});
	});

	it('keeps the stored protection against an older or unchanged device', () => {
		for (const protectUpdatedAt of [null, '2026-10-03T07:00:00.000Z', stored.protectUpdatedAt]) {
			const merged = mergeViewerSettings(stored, {
				protect: false,
				protectUpdatedAt,
				revealed: []
			});

			assert.equal(merged.protect, true);
			assert.deepEqual(merged.revealed, ['9858']);
		}
	});

	it('takes a first device as it is', () => {
		assert.deepEqual(mergeViewerSettings(null, stored), stored);
	});
});
