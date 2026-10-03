import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Catalog } from '../data/catalog.ts';
import { calendarIcs, currentRound, seasonCalendar } from './calendar.ts';

function session(
	key: number,
	type: 'practice' | 'qualifying' | 'race',
	name: string,
	startsAt: string
) {
	return {
		key,
		type,
		name,
		startsAt,
		status: 'upcoming' as const,
		circuit: 'Kuala Lumpur',
		country: { code: 'BRN', name: 'Bahrain' },
		outputs: { raw: false, events: false, snapshot: false }
	};
}

const CATALOG: Catalog = {
	seasons: [
		{
			year: 2026,
			meetings: [
				{
					key: 1,
					name: 'Pre-Season Testing',
					officialName: 'Testing',
					location: 'Sakhir',
					sessions: [session(10, 'practice', 'Day 1', '2026-02-11T07:00:00.000Z')]
				},
				{
					key: 1308,
					name: 'Bahrain Grand Prix',
					officialName: 'FORMULA 1 GULF AIR BAHRAIN GRAND PRIX IN MALAYSIA 2026',
					location: 'Kuala Lumpur',
					sessions: [
						session(11730, 'qualifying', 'Qualifying', '2026-10-03T08:00:00.000Z'),
						{
							...session(11731, 'race', 'Race', '2026-10-04T07:00:00.000Z'),
							endsAt: '2026-10-04T09:00:00.000Z'
						}
					]
				}
			]
		}
	]
};

describe('seasonCalendar', () => {
	it('numbers the race weekends and leaves testing unnumbered', () => {
		const rounds = seasonCalendar(CATALOG, 2026);

		assert.deepEqual(
			rounds.map((round) => [round.round, round.meeting.name, round.endsAt]),
			[
				[null, 'Pre-Season Testing', '2026-02-11T08:00:00.000Z'],
				[1, 'Bahrain Grand Prix', '2026-10-04T09:00:00.000Z']
			]
		);
		assert.equal(currentRound(rounds, Date.parse('2026-10-03T12:00:00Z'))?.round, 1);
	});
});

describe('calendarIcs', () => {
	it('writes one event per session in UTC with its link, escaped and CRLF-separated', () => {
		const text = calendarIcs(seasonCalendar(CATALOG, 2026).slice(1), {
			name: 'Pitwall 2026',
			origin: 'https://pitwall.example',
			host: 'pitwall.example',
			stamp: '2026-10-03T12:00:00.000Z'
		});

		assert.ok(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
		assert.ok(text.endsWith('END:VCALENDAR\r\n'));
		assert.equal(text.match(/BEGIN:VEVENT/g)?.length, 2);
		assert.ok(text.includes('UID:11731@pitwall.example\r\n'));
		assert.ok(text.includes('DTSTART:20261004T070000Z\r\nDTEND:20261004T090000Z\r\n'));
		assert.ok(text.includes('DTEND:20261003T090000Z'), 'qualifying without an end runs an hour');
		assert.ok(text.includes('LOCATION:Kuala Lumpur\\, Bahrain'));
		assert.ok(text.includes('URL:https://pitwall.example/?session=11731'));
	});
});
