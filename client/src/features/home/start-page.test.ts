import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isSessionLink, startRedirect } from './start-page.ts';

const IDS = ['live', 'quali', 'analysis', 'battle', 'mine-1'];

describe('startRedirect', () => {
	it('keeps the home by default', () => {
		assert.equal(startRedirect('home', IDS), null);
	});

	it('opens a session layout at the session address', () => {
		assert.equal(startRedirect('session', IDS), '/session');
		assert.equal(startRedirect('live', IDS), '/session');
		assert.equal(startRedirect('quali', IDS), '/session');
	});

	it('opens presets and own dashboards at theirs', () => {
		assert.equal(startRedirect('analysis', IDS), '/analysis');
		assert.equal(startRedirect('mine-1', IDS), '/d/mine-1');
	});

	it('falls back to the home when the dashboard is gone', () => {
		assert.equal(startRedirect('deleted', IDS), null);
	});
});

describe('isSessionLink', () => {
	it('sends old console links on to the session', () => {
		assert.equal(isSessionLink(new URLSearchParams('session=9858&lap=30')), true);
		assert.equal(isSessionLink(new URLSearchParams('edit=1')), true);
	});

	it('leaves a driver view or nothing on the home', () => {
		assert.equal(isSessionLink(new URLSearchParams('car=63')), false);
		assert.equal(isSessionLink(new URLSearchParams('')), false);
	});
});
