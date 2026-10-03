import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseSeasonIndex } from '../catalog/season-index.js';
import { chooseBySelection, meetingMatches } from './select.js';

const season = parseSeasonIndex(
	JSON.stringify({
		Year: 2025,
		Meetings: [
			{
				Key: 1274,
				Name: 'Las Vegas Grand Prix',
				OfficialName: 'FORMULA 1 HEINEKEN SILVER LAS VEGAS GRAND PRIX 2025',
				Location: 'Las Vegas',
				Country: { Code: 'USA', Name: 'United States' },
				Circuit: { ShortName: 'Las Vegas' },
				Sessions: [
					{
						Key: 9858,
						Type: 'Race',
						Name: 'Race',
						StartDate: '2025-11-22T20:00:00',
						EndDate: '2025-11-22T22:00:00',
						GmtOffset: '-08:00:00',
						Path: '2025/2025-11-22_Las_Vegas_Grand_Prix/2025-11-22_Race/'
					},
					{
						Key: 9859,
						Type: 'Practice',
						Name: 'Practice 4',
						StartDate: '2025-11-23T20:00:00',
						EndDate: '2025-11-23T21:00:00',
						GmtOffset: '-08:00:00'
					}
				]
			},
			{
				Key: 1275,
				Name: 'Qatar Grand Prix',
				OfficialName: 'FORMULA 1 QATAR AIRWAYS QATAR GRAND PRIX 2025',
				Location: 'Lusail',
				Country: { Code: 'QAT', Name: 'Qatar' },
				Circuit: { ShortName: 'Lusail' },
				Sessions: [
					{
						Key: 9900,
						Type: 'Race',
						Name: 'Race',
						StartDate: '2025-12-30T20:00:00',
						EndDate: '2025-12-30T22:00:00',
						GmtOffset: '03:00:00',
						Path: '2025/2025-12-30_Qatar_Grand_Prix/2025-12-30_Race/'
					}
				]
			}
		]
	})
);

const NOW = new Date('2025-12-01T00:00:00Z');

describe('meetingMatches', () => {
	const [vegas] = season.meetings;

	it('matches a name, location or country without case or accents', () => {
		assert.ok(vegas);
		assert.equal(meetingMatches(vegas, 'las vegas'), true);
		assert.equal(meetingMatches(vegas, 'UNITED states'), true);
		assert.equal(meetingMatches(vegas, 'Qatar'), false);
	});
});

describe('chooseBySelection', () => {
	it('picks the sessions of the meeting by name and gives the archive path without the slash', () => {
		const { targets, skipped } = chooseBySelection(
			[season],
			{ kind: 'meeting', years: [2025], meeting: 'Las Vegas' },
			NOW
		);

		assert.deepEqual(
			targets.map((target) => [target.key, target.path, target.label]),
			[
				[
					9858,
					'2025/2025-11-22_Las_Vegas_Grand_Prix/2025-11-22_Race',
					'Las Vegas Grand Prix 2025, Race'
				]
			]
		);
		assert.deepEqual(
			skipped.map((session) => [session.key, session.reason]),
			[[9859, 'the archive lists no path']]
		);
	});

	it('skips sessions that have not started, as upcoming', () => {
		const { targets, skipped } = chooseBySelection(
			[season],
			{ kind: 'meeting', years: [2025] },
			NOW
		);

		assert.deepEqual(
			targets.map((target) => target.key),
			[9858]
		);
		assert.deepEqual(
			skipped.map((session) => [session.key, session.reason]),
			[
				[9859, 'the archive lists no path'],
				[9900, 'upcoming']
			]
		);
	});

	it('finds one session by key', () => {
		const { targets } = chooseBySelection([season], { kind: 'key', key: 9858 }, NOW);

		assert.deepEqual(
			targets.map((target) => target.key),
			[9858]
		);
	});

	it('throws for a key or a meeting that matches nothing', () => {
		assert.throws(
			() => chooseBySelection([season], { kind: 'key', key: 1 }, NOW),
			/not in the season/
		);
		assert.throws(
			() => chooseBySelection([season], { kind: 'meeting', years: [2025], meeting: 'Monaco' }, NOW),
			/matches "Monaco"/
		);
	});

	it('ignores seasons that were not asked for', () => {
		assert.throws(
			() => chooseBySelection([season], { kind: 'meeting', years: [2024] }, NOW),
			/2024/
		);
	});
});
