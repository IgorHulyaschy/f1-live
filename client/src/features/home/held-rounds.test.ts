import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fixtureSeasons } from '../../insights/history-fixture.ts';
import { heldRounds } from './held-rounds.ts';

const season = fixtureSeasons().find((entry) => entry.season === 2025);

describe('rounds the standings hold back', () => {
	it('names each round whose race or sprint is left out, once, with those sessions', () => {
		assert.ok(season);

		const last = season.rounds.slice(-3);

		const unseen = new Set(
			last.flatMap((round) =>
				round.sessions
					.filter((session) => session.type === 'race' || session.type === 'sprint')
					.map((session) => session.key)
			)
		);

		const held = heldRounds(season, (key) => !unseen.has(key));

		assert.deepEqual(
			held.rounds.map((round) => round.round),
			last.map((round) => round.round)
		);
		assert.deepEqual(new Set(held.sessions.map((session) => session.key)), unseen);
	});

	it('holds nothing back when every session counts', () => {
		assert.ok(season);
		assert.deepEqual(
			heldRounds(season, () => true),
			{ rounds: [], sessions: [] }
		);
	});
});
