import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { h2hFacts } from './h2h-facts.ts';
import { headToHead, sharedEvents, type Side } from './head-to-head.ts';
import { fixtureSeasons } from './history-fixture.ts';

const SEASONS = fixtureSeasons();

function facts(a: Side, b: Side, from: number, to: number) {
	const events = sharedEvents(SEASONS, a, b, {
		from: { season: from, round: 1 },
		to: { season: to, round: 99 }
	});

	return h2hFacts(events, headToHead(events, { a, b }), { a: 'A', b: 'B' });
}

describe('h2hFacts on real results', () => {
	const hamiltonBottas = facts(
		{ kind: 'driver', id: 'lewis-hamilton' },
		{ kind: 'driver', id: 'valtteri-bottas' },
		2018,
		2021
	);

	it('leads with the longest streak, from the first session of it to the last', () => {
		const [top] = hamiltonBottas;

		assert.equal(top?.id, 'race-streak-a');
		assert.equal(top?.text, 'A beat B in 13 races in a row, 2018 French to 2018 Abu Dhabi');
		assert.deepEqual(
			top?.evidence.map((item) => item.label),
			['2018 French Race', '2018 Abu Dhabi Race']
		);
	});

	it('finds the closest qualifying gap and the one-two finishes', () => {
		const byId = new Map(hamiltonBottas.map((fact) => [fact.id, fact]));

		assert.equal(
			byId.get('closest-gap')?.text,
			'Closest qualifying gap: B by 0.006 s at 2019 British'
		);
		assert.equal(
			byId.get('one-two')?.text,
			'18 one-two finishes together, the first at 2018 Spanish'
		);
		assert.equal(
			byId.get('comeback')?.text,
			'Biggest comeback: B from P20 to P4 at 2019 Abu Dhabi'
		);
	});

	it('ranks facts by score and links each to a session', () => {
		const norrisPiastri = facts(
			{ kind: 'driver', id: 'lando-norris' },
			{ kind: 'driver', id: 'oscar-piastri' },
			2023,
			2025
		);

		assert.ok(norrisPiastri.length >= 5);
		assert.ok(
			norrisPiastri.every(
				(fact, index, all) => index === 0 || (all[index - 1]?.score ?? 0) >= fact.score
			)
		);
		assert.ok(
			norrisPiastri.every((fact) => fact.evidence.length > 0 && fact.evidence[0]?.session.key)
		);
	});
});
