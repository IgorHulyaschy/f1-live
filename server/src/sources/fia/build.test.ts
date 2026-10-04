import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import type { SeasonResults } from '@f1-live/shared/results';

import { decisionsOf, isDecisionTitle, publishedAtOf } from './build.js';
import { parseDecisionText } from './decision-text.js';
import { parseEventDocuments } from './listing.js';

const documents = parseEventDocuments(
	readFileSync(new URL('fixtures/event-page.html', import.meta.url), 'utf8')
);

const results = {
	season: 2025,
	drivers: {
		'gabriel-bortoleto': { code: 'BOR', firstName: 'Gabriel', lastName: 'Bortoleto' }
	},
	teams: {},
	adjustments: [],
	rounds: [
		{
			round: 22,
			meetingKey: 1270,
			name: 'Las Vegas Grand Prix',
			location: 'Las Vegas',
			circuit: 'Las Vegas',
			countryCode: 'USA',
			startsAt: '2025-11-23T04:00:00Z',
			sessions: [
				{
					key: 9857,
					type: 'qualifying',
					name: 'Qualifying',
					startsAt: '2025-11-22T04:00:00Z',
					rows: []
				},
				{ key: 9858, type: 'race', name: 'Race', startsAt: '2025-11-23T04:00:00Z', rows: [] }
			]
		}
	]
} satisfies SeasonResults;

const gridDrop = documents[1];

describe('FIA decisions of a season', () => {
	it('keeps the call documents and drops the data ones', () => {
		assert.equal(isDecisionTitle('Doc 51 - Infringement - Car 5 - Causing a collision'), true);
		assert.equal(isDecisionTitle('Doc 61 - Championship Points'), false);
		assert.equal(isDecisionTitle('Correction - Replaces Document 46 (Car 18)'), true);
	});

	it('reads the FIA time as Paris time', () => {
		assert.equal(publishedAtOf('23.11.25 06:41'), '2025-11-23T05:41:00.000Z');
		assert.equal(publishedAtOf('10.09.22 13:39'), '2022-09-10T11:39:00.000Z');
	});

	it('matches an event to its round and a document to its session and driver', () => {
		assert.ok(gridDrop);

		const read = parseDecisionText(
			`Document 51\nNo / Driver 5 - Gabriel Bortoleto\nCompetitor Audi\nTime 20:04\nSession Race\nFact Collision\nInfringement Article 38.1\nDecision 5 second time penalty\nReason x`,
			false
		);

		const { decisions } = decisionsOf(
			2025,
			[{ event: 'Las Vegas Grand Prix', documents }],
			new Map([[gridDrop.url, read]]),
			results
		);

		const [decision] = decisions;

		assert.equal(decisions.length, 2);
		assert.equal(decision?.title.startsWith('Infringement - Car 12'), true);
		assert.equal(decision?.outcome, 'unreadable');

		const penalty = decisions.find((d) => d.document === 51);

		assert.equal(penalty?.sessionKey, 9858);
		assert.equal(penalty?.round, 22);
		assert.equal(penalty?.driver, 'gabriel-bortoleto');
		assert.deepEqual(penalty?.penalties, [{ kind: 'time', seconds: 5 }]);
	});

	it('keeps a document that could not be read, with its title and address', () => {
		const { decisions } = decisionsOf(
			2025,
			[{ event: 'Las Vegas Grand Prix', documents }],
			new Map(),
			null
		);

		assert.equal(
			decisions.every((d) => d.outcome === 'unreadable' && d.url.endsWith('.pdf')),
			true
		);
		assert.equal(decisions[0]?.meetingKey, null);
	});

	it('drops a document a correction replaces', () => {
		const listed = [
			{
				url: 'https://www.fia.com/a.pdf',
				title: 'Doc 10 - Offence - Car 18 - Track limits',
				published: '01.01.20 10:00'
			},
			{
				url: 'https://www.fia.com/b.pdf',
				title: 'Doc 11 - Correction - Replaces Document 10 (Car 18)',
				published: '01.01.20 11:00'
			}
		];

		const { decisions } = decisionsOf(
			2020,
			[{ event: 'Test Grand Prix', documents: listed }],
			new Map(),
			null
		);

		assert.deepEqual(
			decisions.map((d) => d.document),
			[11]
		);
	});
});
