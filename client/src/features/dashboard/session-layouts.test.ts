import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildDashboard, PRESETS, sessionKind } from './dashboards.ts';
import {
	appliesTo,
	AWAY_ROWS,
	dashboardNav,
	forSession,
	sessionLayoutId,
	tileApplies,
	wantsSessionOffer
} from './session-layouts.ts';

/** The viewer's own race dashboard: the order, a pit window and the stints under them. */
const mine = buildDashboard('mine-1', 'Race engineer', [
	['timing', 0, 0, 12, 20],
	['box-now', 12, 0, 12, 6],
	['race-control', 12, 6, 12, 14],
	['stints', 0, 20, 24, 12]
]);

function preset(id: string) {
	const found = PRESETS.find((dashboard) => dashboard.id === id);

	assert.ok(found);

	return found;
}

describe('session layouts', () => {
	it('open each kind of session on its own layout', () => {
		assert.equal(sessionLayoutId('race'), 'live');
		assert.equal(sessionLayoutId('sprint'), 'live');
		assert.equal(sessionLayoutId('qualifying'), 'quali');
		assert.equal(sessionLayoutId('sprint_qualifying'), 'quali');
		assert.equal(sessionLayoutId('practice'), 'practice');
	});

	it('hold only tiles that mean something in their session', () => {
		for (const [id, kind] of [
			['live', 'race'],
			['quali', 'quali'],
			['practice', 'practice']
		] as const) {
			for (const tile of preset(id).tiles) {
				assert.ok(tileApplies(tile, kind), `${id} ${tile.kind}`);
			}
		}
	});

	it('keep strategy, pit windows, battles, the undercut and the championship out of qualifying', () => {
		const away = ['stints', 'box-now', 'gaps', 'undercut', 'championship', 'pit-cost'] as const;

		for (const kind of away) {
			assert.equal(tileApplies({ id: kind, kind }, sessionKind('qualifying')), false, kind);
		}

		assert.equal(appliesTo({ id: 'b', kind: 'box-now' }), 'Races only');
		assert.equal(appliesTo({ id: 's', kind: 'stints' }), 'Races and practice');
		assert.equal(appliesTo({ id: 'k', kind: 'knockout' }), 'Qualifying only');
	});
});

describe('the top bar', () => {
	const dashboards = [...PRESETS, mine];

	it('puts Quali first in qualifying, with the race dashboards under More', () => {
		const { tabs, more } = dashboardNav(dashboards, 'qualifying');

		assert.deepEqual(
			tabs.map((entry) => [entry.label, entry.path]),
			[
				['Quali', '/'],
				['Analysis', '/analysis'],
				['Race engineer', '/d/mine-1']
			]
		);
		assert.deepEqual(
			more.map((entry) => entry.label),
			['Race', 'Practice', 'Strategy', 'Battle', 'Track', 'Drivers', 'Pit wall', 'Race story']
		);
	});

	it('puts Race or Sprint first on race day, then strategy and the battle', () => {
		assert.deepEqual(
			dashboardNav(dashboards, 'race').tabs.map((entry) => entry.label),
			['Race', 'Strategy', 'Battle', 'Analysis', 'Race engineer']
		);
		assert.equal(dashboardNav(dashboards, 'sprint').tabs[0]?.label, 'Sprint');
		assert.equal(dashboardNav(dashboards, 'sprint_qualifying').tabs[0]?.label, 'Sprint quali');
	});

	it('loses nothing: every dashboard is a tab or under More', () => {
		for (const type of ['race', 'qualifying', 'practice'] as const) {
			const { tabs, more } = dashboardNav(dashboards, type);

			assert.deepEqual(
				[...tabs, ...more].map((entry) => entry.dashboard.id).toSorted(),
				dashboards.map((dashboard) => dashboard.id).toSorted()
			);
		}
	});

	it('keeps a name the viewer gave the session layout', () => {
		const renamed = dashboards.map((dashboard) =>
			dashboard.id === 'quali' ? { ...dashboard, name: 'My quali' } : dashboard
		);

		assert.equal(dashboardNav(renamed, 'qualifying').tabs[0]?.label, 'My quali');
	});

	it('names an edited Live, saved under its old name, for the race on screen', () => {
		const edited = dashboards.map((dashboard) =>
			dashboard.id === 'live' ? { ...dashboard, name: 'Live' } : dashboard
		);

		assert.equal(dashboardNav(edited, 'sprint').tabs[0]?.label, 'Sprint');
	});
});

describe('a dashboard in another kind of session', () => {
	it('drops the tiles from a session layout and closes the gap they leave', () => {
		const edited = buildDashboard('quali', 'Quali', [
			['timing', 0, 0, 12, 20],
			['stints', 12, 0, 12, 10],
			['race-control', 12, 10, 12, 10]
		]);

		const { dashboard, away } = forSession(edited, 'quali');

		assert.equal(away.size, 0);
		assert.deepEqual(
			dashboard.tiles.map((tile) => tile.kind),
			['timing', 'race-control']
		);
		assert.equal(dashboard.layout.find((place) => place.i === 'quali-2')?.y, 0);
	});

	it('shrinks them to one line on the viewer’s own, moving the rest up', () => {
		const { dashboard, away } = forSession(mine, 'quali');

		assert.deepEqual([...away], ['mine-1-1', 'mine-1-3']);
		assert.deepEqual(
			dashboard.layout.map((place) => [place.i, place.y, place.h]),
			[
				['mine-1-0', 0, 20],
				['mine-1-1', 0, AWAY_ROWS],
				['mine-1-2', AWAY_ROWS, 14],
				['mine-1-3', 20, AWAY_ROWS]
			]
		);
	});

	it('changes nothing when every tile applies', () => {
		const shown = forSession(mine, 'race');

		assert.equal(shown.dashboard, mine);
		assert.equal(shown.away.size, 0);
	});

	it('offers the session’s layout over the viewer’s own until told not to', () => {
		assert.equal(wantsSessionOffer(mine, 'quali'), true);
		assert.equal(wantsSessionOffer(mine, 'race'), false);
		assert.equal(wantsSessionOffer({ ...mine, sessionOffer: false }, 'quali'), false);
		assert.equal(wantsSessionOffer(preset('strategy'), 'quali'), false);
	});
});
