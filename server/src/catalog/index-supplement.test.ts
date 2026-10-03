import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { supplementFile, withSupplement } from './index-supplement.js';
import type { SessionInfo } from './index-supplement.js';
import { parseSeasonIndex } from './season-index.js';

const MEETING = {
	Key: 980,
	Name: 'Bahrain Grand Prix',
	Location: 'Sakhir',
	Country: { Key: 36, Code: 'BRN', Name: 'Bahrain' },
	Circuit: { Key: 63, ShortName: 'Sakhir' }
};

function info(key: number, name: string, type: string, day: string): SessionInfo {
	return {
		Meeting: MEETING,
		Key: key,
		Type: type,
		Name: name,
		StartDate: `2018-04-${day}T18:00:00`,
		EndDate: `2018-04-${day}T19:00:00`,
		GmtOffset: '03:00:00',
		Path: `2018/2018-04-08_Bahrain_Grand_Prix/2018-04-${day}_${name}/`
	};
}

/** 2018 as the archive lists it: Bahrain qualifying without a path, Australia left out. */
const OFFICIAL = `﻿${JSON.stringify({
	Year: 2018,
	Meetings: [
		{
			...MEETING,
			OfficialName: 'FORMULA 1 2018 GULF AIR BAHRAIN GRAND PRIX',
			Sessions: [
				{ ...info(5078, 'Qualifying', 'Qualifying', '07'), Path: undefined },
				info(5074, 'Race', 'Race', '08')
			]
		}
	]
})}`;

describe('withSupplement', () => {
	it('adds left-out meetings and gives a pathless session the path the archive serves', () => {
		const supplement = parseSeasonIndex(
			supplementFile(2018, [
				info(5078, 'Qualifying', 'Qualifying', '07'),
				{
					...info(5066, 'Race', 'Race', '25'),
					Meeting: { ...MEETING, Key: 979, Name: 'Australian Grand Prix', Location: 'Melbourne' },
					StartDate: '2018-03-25T16:10:00',
					EndDate: '2018-03-25T18:10:00',
					GmtOffset: '11:00:00',
					Path: '2018/2018-03-25_Australian_Grand_Prix/2018-03-25_Race/'
				}
			])
		);

		const season = withSupplement(parseSeasonIndex(OFFICIAL), supplement);

		assert.deepEqual(
			season.meetings.map((meeting) => [meeting.name, meeting.officialName]),
			[
				['Australian Grand Prix', 'Australian Grand Prix'],
				['Bahrain Grand Prix', 'FORMULA 1 2018 GULF AIR BAHRAIN GRAND PRIX']
			]
		);
		assert.deepEqual(
			season.meetings[1]?.sessions.map((session) => [session.key, session.path]),
			[
				[5078, '2018/2018-04-08_Bahrain_Grand_Prix/2018-04-07_Qualifying/'],
				[5074, '2018/2018-04-08_Bahrain_Grand_Prix/2018-04-08_Race/']
			]
		);
	});
});
