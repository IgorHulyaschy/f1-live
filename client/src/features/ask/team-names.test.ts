import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolve } from '@f1-live/shared/ask';

import type { Catalog } from '../../data/catalog.ts';
import { fixtureSeasons } from '../../insights/history-fixture.ts';
import { fixtureJson } from '../../insights/test-fixtures.ts';
import { buildAskContext } from './ask-context.ts';
import { type AskData, richPart } from './ask-data.ts';
import { type Answer, answerQuery } from './answers.ts';

const SEASONS = fixtureSeasons();

const CATALOG = fixtureJson<Catalog>('catalog.json');

const NOW = Date.parse('2026-10-03T12:00:00Z');

const CONTEXT = buildAskContext(SEASONS, CATALOG, NOW);

function answer(question: string): Answer {
	const data: AskData = {
		seasons: SEASONS,
		context: CONTEXT,
		catalog: CATALOG,
		held: () => false,
		now: NOW,
		openKey: '9858'
	};

	const query = resolve(question, CONTEXT);

	assert.ok(query, `"${question}" parses`);

	const result = answerQuery(data, query, null);

	if (result.kind !== 'answer') {
		assert.fail(`"${question}" answers, not ${result.kind}`);
	}

	return result;
}

function everything(reply: Answer): string {
	const rich = [...reply.headline, ...(reply.detail ?? [])]
		.map((part) => richPart(part).text)
		.join('');

	const visual = reply.visual;

	const cells =
		visual?.kind === 'table'
			? visual.rows.flatMap((row) => row.cells)
			: visual?.kind === 'bars'
				? visual.bars.map((bar) => bar.label)
				: [];

	return [rich, ...cells].join('|');
}

describe('a season shows the team names it used', () => {
	it('2021 constructors: AlphaTauri and Alfa Romeo Racing, not today’s names', () => {
		const text = everything(answer('Constructors standings 2021'));

		assert.match(text, /AlphaTauri/);
		assert.match(text, /Alfa Romeo Racing/);
		assert.doesNotMatch(text, /Racing Bulls|Sauber/);
	});

	it('2021 team record: Alfa Romeo Racing scored 13 points', () => {
		assert.match(
			everything(answer('Alfa Romeo points 2021')),
			/^Alfa Romeo Racing scored 13 points/
		);
	});

	it('2024 team record: RB, not Racing Bulls', () => {
		const text = everything(answer('Racing Bulls 2024 results'));

		assert.match(text, /^RB in 2024/);
		assert.doesNotMatch(text, /Racing Bulls/);
	});

	it('2024 constructors: RB and Kick Sauber', () => {
		const text = everything(answer('Constructors standings 2024'));

		assert.match(text, /\bRB\b/);
		assert.match(text, /Kick Sauber/);
		assert.doesNotMatch(text, /Racing Bulls/);
	});

	it('2018 constructors: Toro Rosso, Renault and Racing Point', () => {
		const text = everything(answer('Constructors standings 2018'));

		assert.match(text, /Toro Rosso/);
		assert.match(text, /Renault/);
		assert.match(text, /Racing Point/);
	});

	it('a span names a team as its last season did', () => {
		const text = everything(answer('who has most points teams 2018 to 2021'));

		assert.match(text, /AlphaTauri/);
		assert.doesNotMatch(text, /Racing Bulls|Sauber/);
	});
});
