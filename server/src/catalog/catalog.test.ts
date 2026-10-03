import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildCatalog, sessionStatus } from './catalog.js';
import { parseSeasonIndex } from './season-index.js';

/** The shape of the archive's `<year>/Index.json`, with one meeting of two sessions and one without a path. */
const INDEX = `﻿${JSON.stringify({
	Year: 2025,
	Meetings: [
		{
			Sessions: [
				{
					Key: 9858,
					Type: 'Race',
					Number: 1,
					Name: 'Race',
					StartDate: '2025-11-22T20:00:00',
					EndDate: '2025-11-22T22:00:00',
					GmtOffset: '-08:00:00',
					Path: '2025/2025-11-22_Las_Vegas_Grand_Prix/2025-11-22_Race/'
				},
				{
					Key: 9854,
					Type: 'Qualifying',
					Number: 1,
					Name: 'Qualifying',
					StartDate: '2025-11-21T20:00:00',
					EndDate: '2025-11-21T21:00:00',
					GmtOffset: '-08:00:00',
					Path: '2025/2025-11-22_Las_Vegas_Grand_Prix/2025-11-21_Qualifying/'
				}
			],
			Key: 1274,
			Number: 22,
			Location: 'Las Vegas',
			OfficialName: 'FORMULA 1 HEINEKEN SILVER LAS VEGAS GRAND PRIX 2025',
			Name: 'Las Vegas Grand Prix',
			Country: { Key: 19, Code: 'USA', Name: 'United States' },
			Circuit: { Key: 152, ShortName: 'Las Vegas' }
		},
		{
			Sessions: [
				{
					Key: 9900,
					Type: 'Practice',
					Number: 1,
					Name: 'Practice 1',
					StartDate: '2025-11-28T13:30:00',
					EndDate: '2025-11-28T14:30:00',
					GmtOffset: '03:00:00'
				}
			],
			Key: 1275,
			Number: 23,
			Location: 'Lusail',
			OfficialName: 'FORMULA 1 QATAR AIRWAYS QATAR GRAND PRIX 2025',
			Name: 'Qatar Grand Prix',
			Country: { Key: 1, Code: 'QAT', Name: 'Qatar' },
			Circuit: { Key: 20, ShortName: 'Lusail' }
		}
	]
})}`;

const NO_OUTPUTS = {
	raw: new Set<number>(),
	events: new Set<number>(),
	snapshots: new Set<number>()
};

describe('parseSeasonIndex', () => {
	it('reads a file that starts with a BOM and puts session times in UTC', () => {
		const [meeting] = parseSeasonIndex(INDEX).meetings;
		const race = meeting?.sessions.find((session) => session.key === 9858);

		assert.equal(race?.startsAt, '2025-11-23T04:00:00.000Z');
		assert.equal(race?.endsAt, '2025-11-23T06:00:00.000Z');
		assert.equal(race?.type, 'race');
		assert.equal(race?.path, '2025/2025-11-22_Las_Vegas_Grand_Prix/2025-11-22_Race/');
	});

	it('keeps a session the archive lists without a path', () => {
		const lusail = parseSeasonIndex(INDEX).meetings[1];

		assert.equal(lusail?.sessions[0]?.path, null);
	});

	it('rejects an index that does not match the format', () => {
		assert.throws(() => parseSeasonIndex('{"Year":2025}'));
	});
});

describe('sessionStatus', () => {
	const [race] =
		parseSeasonIndex(INDEX).meetings[0]?.sessions.filter((session) => session.key === 9858) ?? [];

	it('is upcoming before the start, live until an hour after the scheduled end, then finished', () => {
		assert.ok(race);
		assert.equal(sessionStatus(race, new Date('2025-11-23T03:59:59Z')), 'upcoming');
		assert.equal(sessionStatus(race, new Date('2025-11-23T04:00:00Z')), 'live');
		assert.equal(sessionStatus(race, new Date('2025-11-23T06:59:59Z')), 'live');
		assert.equal(sessionStatus(race, new Date('2025-11-23T07:00:00Z')), 'finished');
	});
});

describe('buildCatalog', () => {
	const now = new Date('2025-11-25T00:00:00Z');

	it('lists seasons, meetings and sessions in calendar order, upcoming ones too', () => {
		const catalog = buildCatalog([parseSeasonIndex(INDEX)], NO_OUTPUTS, now);

		assert.deepEqual(
			catalog.seasons[0]?.meetings.map((meeting) => [
				meeting.name,
				meeting.sessions.map((session) => [session.key, session.status])
			]),
			[
				[
					'Las Vegas Grand Prix',
					[
						[9854, 'finished'],
						[9858, 'finished']
					]
				],
				['Qatar Grand Prix', [[9900, 'upcoming']]]
			]
		);
	});

	it('carries the circuit, the country and the start time of each session', () => {
		const session = buildCatalog([parseSeasonIndex(INDEX)], NO_OUTPUTS, now).seasons[0]?.meetings[0]
			?.sessions[1];

		assert.deepEqual(session, {
			key: 9858,
			type: 'race',
			name: 'Race',
			startsAt: '2025-11-23T04:00:00.000Z',
			status: 'finished',
			circuit: 'Las Vegas',
			country: { code: 'USA', name: 'United States' },
			outputs: { raw: false, events: false, snapshot: false }
		});
	});

	it('marks the outputs each session has', () => {
		const catalog = buildCatalog(
			[parseSeasonIndex(INDEX)],
			{ raw: new Set([9858, 9854]), events: new Set([9858]), snapshots: new Set([9858]) },
			now
		);

		const [qualifying, race] = catalog.seasons[0]?.meetings[0]?.sessions ?? [];

		assert.deepEqual(qualifying?.outputs, { raw: true, events: false, snapshot: false });
		assert.deepEqual(race?.outputs, { raw: true, events: true, snapshot: true });
	});

	it('orders seasons by year whatever the order given', () => {
		const later = { ...parseSeasonIndex(INDEX), year: 2026 };
		const catalog = buildCatalog([later, parseSeasonIndex(INDEX)], NO_OUTPUTS, now);

		assert.deepEqual(
			catalog.seasons.map((season) => season.year),
			[2025, 2026]
		);
	});
});
