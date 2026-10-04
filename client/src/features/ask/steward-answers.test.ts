import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolve } from '@f1-live/shared/ask';
import { seasonDecisionsSchema } from '@f1-live/shared/decisions';
import { factsSchema } from '@f1-live/shared/facts';

import type { Catalog } from '../../data/catalog.ts';
import decisionsJson from '../../data/mock/decisions-2025.json' with { type: 'json' };
import factsJson from '../../data/mock/facts-2025.json' with { type: 'json' };
import { fixtureSeasons } from '../../insights/history-fixture.ts';
import { fixtureJson } from '../../insights/test-fixtures.ts';
import { buildAskContext } from './ask-context.ts';
import type { AskData } from './ask-data.ts';
import { type AskOutcome, answerQuery } from './answers.ts';
import { isStewardsQuery, type Stewards } from './steward-answers.ts';

const SEASONS = fixtureSeasons();

const CATALOG = fixtureJson<Catalog>('catalog.json');

const NOW = Date.parse('2026-10-03T12:00:00Z');

const CONTEXT = buildAskContext(SEASONS, CATALOG, NOW);

const STEWARDS: Stewards = {
	status: 'ready',
	decisions: [seasonDecisionsSchema.parse(decisionsJson)],
	facts: factsSchema.parse(factsJson)
};

function ask(question: string, held: readonly string[] = [], stewards = STEWARDS): AskOutcome {
	const query = resolve(question, CONTEXT);

	assert.ok(isStewardsQuery(query), `"${question}" is a stewards question`);

	const data: AskData = {
		seasons: SEASONS,
		context: CONTEXT,
		catalog: CATALOG,
		held: (key) => held.includes(key),
		now: NOW,
		openKey: '9858'
	};

	return answerQuery(data, query, null, stewards);
}

describe('stewards questions', () => {
	it('a penalty at an event answers with the FIA document as its proof', () => {
		const result = ask('why was norris penalised in las vegas');

		assert.equal(result.kind, 'answer');

		if (result.kind === 'answer') {
			assert.match(result.proof.href, /^https:\/\/www\.fia\.com\/.*\.pdf$/);
			assert.match(result.source, /^FIA stewards/);
		}
	});

	it('a quoted infringement ends with one full stop', () => {
		const result = ask('why was norris penalised in las vegas');

		assert.equal(result.kind, 'answer');

		if (result.kind === 'answer') {
			const text = JSON.stringify(result.detail);

			assert.match(text, /Alleged breach|Article|infring/i);
			assert.doesNotMatch(text, /\.\./);
		}
	});

	it('penalties of a season that the viewer has not seen are held, not listed', () => {
		const result = ask('why was norris penalised in las vegas', ['9858']);

		assert.equal(result.kind, 'held');
	});

	it('a driver with no decisions gets a plain message', () => {
		assert.equal(ask('penalties for alonso 2025').kind, 'missing');
	});

	it('the age comes from Wikidata with its page as the proof', () => {
		const result = ask('how old is alonso');

		assert.equal(result.kind, 'answer');

		if (result.kind === 'answer') {
			assert.match(result.proof.href, /^https:\/\/www\.wikidata\.org\/wiki\/Q\d+$/);
		}
	});

	it('the youngest winner leaves out a race the viewer has not seen', () => {
		const all = ask('youngest race winner since 2018');
		const held = ask('youngest race winner since 2018', ['9858']);

		assert.equal(all.kind, 'answer');
		assert.notDeepEqual(held, all);
	});

	it('documents still loading ask the reader to wait', () => {
		assert.equal(ask('how old is alonso', [], { status: 'loading' }).kind, 'loading');
	});
});
