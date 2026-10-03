import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Catalog } from '../../data/catalog.ts';
import { fixtureSeasons } from '../../insights/history-fixture.ts';
import { fixtureJson } from '../../insights/test-fixtures.ts';
import { buildAskContext } from './ask-context.ts';
import type { AskData } from './ask-data.ts';
import { historyIndex, rank, rankGroups } from './ask-index.ts';

const SEASONS = fixtureSeasons();

const CATALOG = fixtureJson<Catalog>('catalog.json');

const NOW = Date.parse('2026-10-03T12:00:00Z');

const DATA: AskData = {
	seasons: SEASONS,
	context: buildAskContext(SEASONS, CATALOG, NOW),
	catalog: CATALOG,
	held: () => false,
	now: NOW,
	openKey: '9858'
};

const INDEX = historyIndex(DATA);

function first(text: string) {
	return rank(INDEX, text)[0];
}

describe('the palette index', () => {
	it('finds drivers by name, code and typo', () => {
		for (const text of ['Leclerc', 'lecler', 'LEC', 'charles']) {
			assert.equal(first(text)?.id, 'driver-charles-leclerc', text);
		}

		assert.equal(first('Leclerc')?.href, '/drivers/charles-leclerc');
	});

	it('finds a grand prix by its circuit and opens its latest race', () => {
		const monza = first('monza');

		assert.equal(monza?.id, 'event-italian');
		assert.match(monza?.href ?? '', /^\/session\?session=\d+$/);
	});

	it('finds seasons and pages', () => {
		assert.equal(first('2021')?.id, 'season-2021');
		assert.equal(first('calendr')?.id, 'calendar');
		assert.equal(first('h2h')?.id, 'h2h');
	});

	it('groups matches, the best group first', () => {
		const groups = rankGroups(INDEX, 'ferrari');

		assert.equal(groups[0]?.group, 'Teams');
		assert.ok(groups.every((group) => group.entries.length <= 4));
	});

	it('matches nothing for noise', () => {
		assert.deepEqual(rank(INDEX, 'qqqzzx'), []);
	});
});
