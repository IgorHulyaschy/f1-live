import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolve } from '@f1-live/shared/ask';

import type { Catalog } from '../../data/catalog.ts';
import { fixtureSeasons } from '../../insights/history-fixture.ts';
import { fixtureJson, fixtureSession } from '../../insights/test-fixtures.ts';
import { buildAskContext } from './ask-context.ts';
import { type AskData, type Rich, richPart } from './ask-data.ts';
import { answerTile } from './answer-tile.ts';
import { type Answer, type AskOutcome, answerQuery } from './answers.ts';
import { examples, surprise } from './surprise.ts';

const SEASONS = fixtureSeasons();

const CATALOG = fixtureJson<Catalog>('catalog.json');

const NOW = Date.parse('2026-10-03T12:00:00Z');

const CONTEXT = buildAskContext(SEASONS, CATALOG, NOW);

const FIXTURE_SESSIONS = ['9852', '9854', '9858', '11373', '11730'] as const;

function dataWith(held: readonly string[] = []): AskData {
	return {
		seasons: SEASONS,
		context: CONTEXT,
		catalog: CATALOG,
		held: (key) => held.includes(key),
		now: NOW,
		openKey: '9858'
	};
}

function outcome(question: string, held: readonly string[] = []): AskOutcome {
	const query = resolve(question, CONTEXT);

	assert.ok(query, `"${question}" parses`);

	const first = answerQuery(dataWith(held), query, null);

	if (first.kind !== 'snapshot') {
		return first;
	}

	const key = FIXTURE_SESSIONS.find((candidate) => candidate === first.key);

	assert.ok(key, `session ${first.key} is in the fixture`);

	return answerQuery(dataWith(held), query, fixtureSession(key));
}

function answer(question: string, held: readonly string[] = []): Answer {
	const result = outcome(question, held);

	if (result.kind !== 'answer') {
		assert.fail(`"${question}" answers, not ${result.kind}`);
	}

	return result;
}

/** The same numbers from 0 to 1 every run, for random picks a test can repeat. */
function seeded(seed: number) {
	let state = seed;

	return () => {
		state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;

		return state / 2_147_483_648;
	};
}

function text(rich: Rich | null): string {
	return (rich ?? []).map((part) => richPart(part).text).join('');
}

function links(rich: Rich): string[] {
	return rich.flatMap((part) => richPart(part).href ?? []);
}

describe('answers match the official tables', () => {
	it('2021: Verstappen champion on 395.5, Hamilton 8 behind', () => {
		const reply = answer('Drivers standings 2021');

		assert.equal(
			text(reply.headline),
			"Verstappen won the 2021 drivers' championship with 395.5 points"
		);
		assert.match(text(reply.detail), /Hamilton finished second, 8 points behind/);
		assert.equal(reply.proof.href, '/standings?season=2021&round=22');
	});

	it('2024 constructors: McLaren 666, Ferrari 652', () => {
		const reply = answer('Constructors standings 2024');

		assert.match(text(reply.headline), /^McLaren won .* with 666 points$/);
		assert.match(text(reply.detail), /Ferrari finished second, 14 points behind/);
	});

	it('2025: Norris 423, Verstappen 421, Piastri 410', () => {
		const reply = answer('Standings 2025');

		assert.equal(reply.visual?.kind, 'bars');
		assert.deepEqual(
			reply.visual.kind === 'bars' &&
				reply.visual.bars.slice(0, 3).map((bar) => [bar.label, bar.value]),
			[
				['Norris', 423],
				['Verstappen', 421],
				['Piastri', 410]
			]
		);
	});

	it('Hamilton 2018: 11 wins, 11 poles, 17 podiums, 408 points', () => {
		assert.equal(
			text(answer('Hamilton stats 2018').headline),
			'Hamilton in 2018: 11 wins, 11 poles, 17 podiums, 408 points'
		);
	});

	it('a record answer carries the driver as the last season of the span names them', () => {
		const picture = answer('Verstappen wins 2023').picture;

		assert.equal(picture?.kind, 'driver');
		assert.equal(picture?.kind === 'driver' ? picture.face.lastName : null, 'Verstappen');
		assert.equal(picture?.kind === 'driver' ? picture.face.season : null, 2023);
	});

	it('Verstappen: 19 wins in 2023 and 8 in 2025', () => {
		assert.match(text(answer('Verstappen wins 2023').headline), /19 wins in 2023/);
		assert.match(text(answer('Verstappen wins 2025').headline), /8 wins in 2025/);
	});

	it('constructors points: Mercedes 573 in 2020, Red Bull 860 in 2023', () => {
		assert.match(text(answer('Mercedes points 2020').headline), /573 points in 2020/);
		assert.match(text(answer('Red Bull points 2023').headline), /860 points in 2023/);
	});

	it('2024 Italian GP: Leclerc from Piastri by 2.664, Norris third', () => {
		const reply = answer('Who won the Italian GP 2024');

		assert.equal(text(reply.headline), 'Leclerc won the 2024 Italian GP Race');
		assert.match(text(reply.detail), /Piastri second, Norris third/);
		assert.equal(reply.visual?.kind === 'table' && reply.visual.rows[1]?.cells[3], '+2.664');
	});

	it('Verstappen led 1,003 laps in 2023', () => {
		assert.match(text(answer('Who has the most laps led in 2023').headline), /Verstappen .*1,003/);
	});

	it('2026 poles: Russell in Baku, Verstappen in Bahrain', () => {
		assert.match(text(answer('Who was on pole at Azerbaijan GP 2026').headline), /^Russell/);
		assert.match(text(answer('Who was on pole at Bahrain GP 2026').headline), /^Verstappen/);
	});
});

describe('session insights match the timing data', () => {
	it('2025 Las Vegas race: fastest lap Verstappen 1:33.365 on lap 50, linked to that lap', () => {
		const reply = answer('Fastest lap at Las Vegas GP 2025 race');

		assert.match(text(reply.headline), /^Verstappen .*1:33\.365 on lap 50$/);
		assert.equal(reply.proof.href, '/session?session=9858&car=1&carLap=50');
	});

	it('the fastest lap agrees with the results index flag', () => {
		const race = SEASONS.find((season) => season.season === 2025)
			?.rounds.flatMap((round) => round.sessions)
			.find((session) => session.key === 9858);

		const flagged = race?.rows.find((row) => row.fastestLap);

		assert.equal(flagged?.driver, 'max-verstappen');
	});

	it('2025 Las Vegas race: Tsunoda 358 km/h, Red Bull quickest stop 2.2 s', () => {
		assert.match(
			text(answer('Top speed at Las Vegas GP 2025 race').headline),
			/^Tsunoda.*358 km\/h$/
		);
		assert.match(
			text(answer('Pit stops at Las Vegas GP 2025 race').headline),
			/^Red Bull Racing had the quickest stop.*2\.2 s$/
		);
	});

	it('2025 Las Vegas race: Verstappen ran Medium then Hard', () => {
		assert.equal(
			text(answer('Tyres of Verstappen at Las Vegas GP 2025 race').headline),
			'Verstappen: Medium 1–25, Hard 26–50'
		);
	});

	it('2025 Las Vegas FP2: Norris 1:33.602', () => {
		assert.match(
			text(answer('Fastest lap at Las Vegas GP 2025 FP2').headline),
			/^Norris.*1:33\.602/
		);
	});
});

describe('the gap to the leader', () => {
	it('2024: Leclerc 81 behind Verstappen and 18 behind Norris, the season done', () => {
		const reply = answer('how many points is leclerc behind in 2024');

		assert.equal(
			text(reply.headline),
			'Leclerc is 81 points behind the leader, Verstappen, and 18 points behind Norris in P2'
		);
		assert.match(text(reply.detail), /no race left to count, Verstappen has the title/);
		assert.equal(reply.proof.href, '/standings?season=2024&round=24');
	});

	it('2025 before Abu Dhabi is seen: Piastri 16 behind with 25 points open, one session hidden', () => {
		const reply = answer('can piastri still win the title 2025', ['9839']);

		assert.equal(
			text(reply.headline),
			'Piastri is 16 points behind the leader, Norris, and 4 points behind Verstappen in P2'
		);
		assert.match(
			text(reply.detail),
			/25 points are still available, so Piastri can still win the title\. 1 session you have not seen is left out/
		);
		assert.deepEqual(
			reply.hidden.map((session) => session.key),
			['9839']
		);
	});

	it('with no subject, second place against the leader', () => {
		assert.equal(
			text(answer('gap to the leader 2025').headline),
			'Verstappen is 2 points behind the leader, Norris'
		);
	});
});

describe('the schedule', () => {
	it('the next race is the 2026 Bahrain GP, 19 hours away, with its weekend', () => {
		const reply = answer('when is the next race');

		assert.match(text(reply.headline), /^2026 Bahrain GP Race starts .+, in 19 h 0 min$/);
		assert.equal(reply.proof.href, '/calendar?season=2026');
		assert.equal(reply.visual?.kind, 'table');
		assert.deepEqual(
			reply.visual.kind === 'table' &&
				reply.visual.rows.filter((row) => row.mark).map((row) => row.cells[0]),
			['Race']
		);
	});

	it('says so when nothing like that is on the calendar', () => {
		assert.equal(outcome('when is quali').kind, 'missing');
	});
});

function tileOf(question: string) {
	const query = resolve(question, CONTEXT);

	assert.ok(query, `"${question}" parses`);

	return answerTile(dataWith(), query);
}

describe('Add to dashboard', () => {
	it('offers the tile that keeps showing a question about the open session or its season', () => {
		assert.equal(tileOf('fastest lap at Las Vegas GP 2025 race'), 'fastest-laps');
		assert.equal(tileOf('pit stops in this session'), 'pit-stops');
		assert.equal(tileOf('standings 2025'), 'season-standings');
		assert.equal(tileOf('how many points is piastri behind in 2025'), 'season-standings');
	});

	it('offers none for another session, another season or history', () => {
		assert.equal(tileOf('fastest lap monza 2024'), null);
		assert.equal(tileOf('standings 2021'), null);
		assert.equal(tileOf('who won monza 2024'), null);
		assert.equal(tileOf('norris vs piastri 2024'), null);
	});
});

describe('every number links to where it came from', () => {
	for (const question of [
		'Drivers standings 2021',
		'Hamilton stats 2018',
		'Norris vs Piastri as teammates 2024',
		'Who won the Italian GP 2024',
		'Pit stops at Las Vegas GP 2025 race'
	]) {
		it(question, () => {
			const reply = answer(question);

			const numbers = reply.headline.filter(
				(part) =>
					richPart(part).href === null &&
					/\d{2,}/.test(richPart(part).text.replaceAll(/\b20\d\d\b/g, ''))
			);

			assert.deepEqual(numbers, [], 'no bare figure in the headline');
			assert.ok(links(reply.headline).length > 0);
			assert.ok(reply.proof.href.startsWith('/'));
		});
	}
});

describe('spoilers', () => {
	it('a held session is not answered, only offered to reveal', () => {
		for (const question of [
			'Who won the Las Vegas GP 2025',
			'Fastest lap at Las Vegas GP 2025 race'
		]) {
			const result = outcome(question, ['9858']);

			assert.equal(result.kind, 'held');
			assert.deepEqual(result.kind === 'held' && result.sessions.map((session) => session.label), [
				'2025 Las Vegas GP Race'
			]);
		}
	});

	it('a count leaves a held session out and names it', () => {
		const reply = answer('Verstappen wins 2025', ['9858']);

		assert.match(text(reply.headline), /7 wins in 2025/);
		assert.deepEqual(
			reply.hidden.map((session) => session.key),
			['9858']
		);
	});
});

describe('Surprise me and the examples', () => {
	it('every surprise answers and reads back to its own query', () => {
		const random = seeded(7);

		for (let index = 0; index < 20; index++) {
			const pick = surprise(dataWith(), random);

			assert.ok(pick);
			assert.deepEqual(resolve(pick.text, CONTEXT), pick.query, pick.text);
			assert.equal(answerQuery(dataWith(), pick.query, null).kind, 'answer');
		}
	});

	it('every example reads back to its own query', () => {
		const random = seeded(11);

		for (let index = 0; index < 10; index++) {
			for (const example of examples(dataWith(), random, 8)) {
				assert.deepEqual(resolve(example.text, CONTEXT), example.query, example.text);
			}
		}
	});
});
