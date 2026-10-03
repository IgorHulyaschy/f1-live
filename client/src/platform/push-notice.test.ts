import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { noticeFrom, noticeUrl, sameSiteUrl } from './push-notice.ts';

describe('noticeFrom', () => {
	it('reads what the server sends', () => {
		assert.deepEqual(
			noticeFrom(
				JSON.stringify({
					title: 'NOR is in the pits',
					body: 'Stop 1, lap 18',
					tag: 'pit:11731:4:17',
					kind: 'pit_stop',
					url: '/'
				})
			),
			{ title: 'NOR is in the pits', body: 'Stop 1, lap 18', tag: 'pit:11731:4:17', url: '/' }
		);
	});

	it('still shows something for a push that is empty, not JSON or the wrong shape', () => {
		for (const raw of [null, '', 'not json', '42', 'null', '{}']) {
			const notice = noticeFrom(raw);

			assert.ok(notice.title.length > 0, String(raw));
			assert.equal(notice.url, '/');
		}
	});
});

describe('sameSiteUrl', () => {
	it('keeps an address on this site and sends anything else home', () => {
		assert.equal(sameSiteUrl('/alerts', 'https://pitwall.test'), '/alerts');
		assert.equal(sameSiteUrl('/?session=11731', 'https://pitwall.test'), '/?session=11731');
		assert.equal(sameSiteUrl('https://pitwall.test/d/wall', 'https://pitwall.test'), '/d/wall');
		assert.equal(sameSiteUrl('https://evil.example/phish', 'https://pitwall.test'), '/');
		assert.equal(sameSiteUrl('javascript:alert(1)', 'https://pitwall.test'), '/');
	});
});

describe('noticeUrl', () => {
	it('reads the address the notice carries, and goes home without one', () => {
		assert.equal(noticeUrl({ url: '/alerts' }), '/alerts');
		assert.equal(noticeUrl(null), '/');
		assert.equal(noticeUrl({}), '/');
	});
});
