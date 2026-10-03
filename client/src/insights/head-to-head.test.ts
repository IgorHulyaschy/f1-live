/**
 * Head-to-head totals on the real results index (e2e fixture), checked against the same totals
 * computed from the Jolpica F1 API (api.jolpi.ca, the Ergast successor), an independent public
 * source, on 2026-10-03: race, qualifying and sprint results of each round.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	breakdowns,
	headToHead,
	hiddenSessions,
	rollingGap,
	sharedEvents,
	type Side
} from './head-to-head.ts';
import { fixtureSeasons } from './history-fixture.ts';

const SEASONS = fixtureSeasons();

const HAMILTON: Side = { kind: 'driver', id: 'lewis-hamilton' };

const BOTTAS: Side = { kind: 'driver', id: 'valtteri-bottas' };

const NORRIS: Side = { kind: 'driver', id: 'lando-norris' };

const PIASTRI: Side = { kind: 'driver', id: 'oscar-piastri' };

function totals(a: Side, b: Side, from: number, to: number) {
	return headToHead(
		sharedEvents(SEASONS, a, b, {
			from: { season: from, round: 1 },
			to: { season: to, round: 99 }
		}),
		{ a, b }
	);
}

describe('headToHead', () => {
	it('matches Hamilton and Bottas at Mercedes, 2018 to 2021', () => {
		const result = totals(HAMILTON, BOTTAS, 2018, 2021);

		assert.equal(result.racesTogether, 80);
		assert.deepEqual(result.qualifying, { a: 57, b: 23 });
		assert.deepEqual(result.race, { a: 62, b: 17 });
		assert.deepEqual(result.sprint, { a: 1, b: 2 });
		assert.deepEqual([result.a.wins, result.b.wins], [41, 7]);
		assert.deepEqual([result.a.podiums, result.b.podiums], [65, 45]);
		assert.deepEqual([result.a.poles, result.b.poles], [34, 14]);
		assert.deepEqual([result.a.points, result.b.points], [1555.5, 1018]);
		// Jolpica also counts Bottas's retirement in 2018 Baku, classified 14th after 48 of 51 laps;
		// a retirement past the 90% distance is a classified finish here.
		assert.deepEqual([result.a.dnfs, result.b.dnfs], [2, 8]);
	});

	it('matches Norris and Piastri at McLaren, 2023 to 2025', () => {
		const result = totals(NORRIS, PIASTRI, 2023, 2025);

		assert.equal(result.racesTogether, 70);
		assert.deepEqual(result.qualifying, { a: 48, b: 22 });
		assert.deepEqual(result.race, { a: 46, b: 23 });
		assert.deepEqual(result.sprint, { a: 8, b: 9 });
		assert.deepEqual([result.a.wins, result.b.wins], [11, 9]);
		assert.deepEqual([result.a.podiums, result.b.podiums], [38, 26]);
		assert.deepEqual([result.a.poles, result.b.poles], [15, 6]);
		assert.deepEqual([result.a.dnfs, result.b.dnfs], [1, 4]);
		assert.deepEqual([result.a.points, result.b.points], [1002, 799]);
	});

	it('measures the teammates’ qualifying gap in the last part both set a time in', () => {
		const result = totals(NORRIS, PIASTRI, 2023, 2025);

		assert.equal(result.gaps.length, 70);
		assert.ok(result.medianGapMs !== null && result.medianGapMs < 0 && result.medianGapMs > -200);
		assert.ok(result.gaps.every((gap) => Math.abs(gap.pct) < 5));
		assert.equal(rollingGap(result.gaps).length, result.gaps.length);
	});

	it('breaks the totals down by season, adding up to the whole', () => {
		const events = sharedEvents(SEASONS, NORRIS, PIASTRI, {
			from: { season: 2023, round: 1 },
			to: { season: 2025, round: 99 }
		});

		const bySeason = breakdowns(events, { a: NORRIS, b: PIASTRI }, 'season');

		assert.deepEqual(
			bySeason.map((group) => group.id),
			['2023', '2024', '2025']
		);
		assert.equal(
			bySeason.reduce((sum, group) => sum + group.totals.qualifying.a, 0),
			48
		);
	});

	it('leaves held-back sessions out and lists them to reveal', () => {
		const range = { from: { season: 2025, round: 1 }, to: { season: 2025, round: 99 } };
		const all = sharedEvents(SEASONS, NORRIS, PIASTRI, range);
		const lastRace = all.at(-1)?.race?.session.key;
		const include = (key: number) => key !== lastRace;

		assert.equal(sharedEvents(SEASONS, NORRIS, PIASTRI, range, include).at(-1)?.race, null);
		assert.deepEqual(
			hiddenSessions(SEASONS, NORRIS, PIASTRI, range, include).map((session) => session.key),
			[lastRace]
		);
	});

	it('compares teams across their names, Toro Rosso and Racing Bulls as one', () => {
		const result = totals(
			{ kind: 'team', id: 'racing-bulls' },
			{ kind: 'team', id: 'williams' },
			2018,
			2018
		);

		assert.equal(result.racesTogether, 21);
		assert.ok(result.a.points > result.b.points);
	});
});
