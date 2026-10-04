import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ageOfDriver, penaltiesOf, youngestRaceWinner } from './answers.ts';
import { type Decision, decisionSchema } from './decisions.ts';
import type { Facts } from './facts.ts';
import { seasonResultsSchema } from './results.ts';

const facts: Facts = {
	fetchedAt: '2026-10-01',
	drivers: {
		'max-verstappen': {
			wikidata: 'Q1',
			birthDate: '1997-09-30',
			birthPlace: null,
			nationality: null
		},
		'oscar-piastri': {
			wikidata: 'Q2',
			birthDate: '2001-04-06',
			birthPlace: null,
			nationality: null
		},
		'no-date': { wikidata: 'Q3', birthDate: null, birthPlace: null, nationality: null }
	},
	circuits: {}
};

function race(winner: string, startsAt: string, round: number) {
	return {
		round,
		meetingKey: round,
		name: `Round ${round} Grand Prix`,
		location: '',
		circuit: '',
		countryCode: 'XX',
		startsAt,
		sessions: [
			{
				key: round * 10,
				type: 'race' as const,
				name: 'Race',
				startsAt,
				rows: [
					{
						driver: winner,
						number: '1',
						team: 'T',
						position: 1,
						status: 'finished' as const,
						classified: true,
						laps: 50,
						points: 25,
						bestLapMs: null
					}
				]
			}
		]
	};
}

test('age counts the birthday', () => {
	assert.equal(ageOfDriver(facts, 'max-verstappen', new Date('2026-09-29T12:00:00Z'))?.age, 28);
	assert.equal(ageOfDriver(facts, 'max-verstappen', new Date('2026-09-30T00:00:00Z'))?.age, 29);
	assert.equal(ageOfDriver(facts, 'no-date', new Date('2026-09-30'))?.age, undefined);
	assert.equal(ageOfDriver(facts, 'nobody', new Date('2026-09-30')), null);
});

test('the youngest winner is the one with the fewest days lived, and seasons before `since` are skipped', () => {
	const seasons = [
		{ season: 2017, rounds: [race('oscar-piastri', '2017-05-01T12:00:00Z', 1)] },
		{
			season: 2025,
			rounds: [
				race('max-verstappen', '2025-03-16T05:00:00Z', 1),
				race('oscar-piastri', '2025-04-13T15:00:00Z', 2)
			]
		}
	].map((season) =>
		seasonResultsSchema.parse({ ...season, drivers: {}, teams: {}, adjustments: [] })
	);

	const youngest = youngestRaceWinner(seasons, facts, 2018);

	assert.equal(youngest?.driver, 'oscar-piastri');
	assert.equal(youngest?.ageYears, 24);
	assert.equal(youngest?.proof, 'https://www.wikidata.org/wiki/Q2');
});

function decision(
	driver: string,
	event: string,
	outcome: Decision['outcome'],
	publishedAt: string
) {
	return decisionSchema.parse({
		id: `${driver}-${outcome}-${publishedAt}`,
		season: 2025,
		event,
		meetingKey: null,
		round: null,
		sessionKey: null,
		session: null,
		document: null,
		title: 'Decision',
		url: 'https://www.fia.com/sample.pdf',
		publishedAt,
		outcome,
		car: null,
		driver,
		driverName: null,
		team: null,
		time: null,
		fact: null,
		infringement: null,
		decision: null,
		penalties: []
	});
}

const decisions = {
	season: 2025,
	decisions: [
		decision('lando-norris', 'Las Vegas', 'investigation', '2025-11-23T04:00:00.000Z'),
		decision('lando-norris', 'Las Vegas', 'penalty', '2025-11-23T05:00:00.000Z'),
		decision('max-verstappen', 'Qatar', 'penalty', '2025-11-30T05:00:00.000Z')
	]
};

test('penalties are the decisions that penalised the driver, of one season when asked', () => {
	assert.equal(penaltiesOf([decisions], 'lando-norris').length, 1);
	assert.equal(penaltiesOf([decisions], 'lando-norris', 2024).length, 0);
});
