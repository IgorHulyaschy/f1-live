import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolve } from '@f1-live/shared/ask';

import type { Catalog } from '../../data/catalog.ts';
import { fixtureSeasons } from '../../insights/history-fixture.ts';
import { fixtureJson } from '../../insights/test-fixtures.ts';
import { buildAskContext, eventIdOf } from './ask-context.ts';

const CONTEXT = buildAskContext(
	fixtureSeasons(),
	fixtureJson<Catalog>('catalog.json'),
	Date.parse('2026-10-03T12:00:00Z')
);

describe('buildAskContext', () => {
	it('keeps one id for a grand prix across its names', () => {
		assert.equal(eventIdOf('Italian Grand Prix'), 'italian');
		assert.equal(eventIdOf('Brazilian Grand Prix'), 'sao-paulo');
		assert.equal(eventIdOf('São Paulo Grand Prix'), 'sao-paulo');
		assert.equal(eventIdOf('Mexico City Grand Prix'), 'mexico-city');
	});

	it('knows the season under way', () => {
		assert.equal(CONTEXT.season, 2026);
	});

	it('reads what fans call them', () => {
		const cases: [string, unknown][] = [
			['Who won at Monza 2024', { kind: 'event', event: 'italian' }],
			['Who won in Vegas 2025', { kind: 'event', event: 'las-vegas' }],
			['Who won at Interlagos 2024', { kind: 'event', event: 'sao-paulo' }],
			['Checo wins 2023', { kind: 'driver', id: 'sergio-perez' }],
			['Red Bull points 2023', { kind: 'team', id: 'red-bull' }],
			['Kimi wins 2026', { kind: 'driver', id: 'kimi-antonelli' }]
		];

		for (const [question, expected] of cases) {
			const query = resolve(question, CONTEXT);

			const found =
				query?.kind === 'result'
					? query.session.kind === 'event' && { kind: 'event', event: query.session.event }
					: query?.kind === 'record' && query.subject;

			assert.deepEqual(found, expected, question);
		}
	});
});
