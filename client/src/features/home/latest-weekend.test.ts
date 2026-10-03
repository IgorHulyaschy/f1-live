import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Catalog, CatalogSession } from '../../data/catalog.ts';

import { latestWeekend, sessionTitle } from './latest-weekend.ts';

function session(key: number, name: string, startsAt: string, saved: boolean): CatalogSession {
	return {
		key,
		type: name === 'Race' ? 'race' : name === 'Qualifying' ? 'qualifying' : 'practice',
		name,
		startsAt,
		status: saved ? 'finished' : 'upcoming',
		circuit: 'Sakhir',
		country: { code: 'BRN', name: 'Bahrain' },
		outputs: { raw: saved, events: saved, snapshot: saved }
	};
}

const CATALOG: Catalog = {
	seasons: [
		{
			year: 2026,
			meetings: [
				{
					key: 1,
					name: 'Bahrain Grand Prix',
					officialName: 'Bahrain Grand Prix 2026',
					location: 'Sakhir',
					sessions: [
						session(12, 'Race', '2026-04-12T15:00:00.000Z', true),
						session(11, 'Qualifying', '2026-04-11T16:00:00.000Z', true)
					]
				},
				{
					key: 2,
					name: 'Saudi Arabian Grand Prix',
					officialName: 'Saudi Arabian Grand Prix 2026',
					location: 'Jeddah',
					sessions: [
						session(21, 'Practice 1', '2026-04-17T13:30:00.000Z', true),
						session(22, 'Qualifying', '2026-04-18T17:00:00.000Z', false)
					]
				}
			]
		}
	]
};

describe('latestWeekend', () => {
	it('holds the weekend of the latest saved session, in running order', () => {
		assert.deepEqual(
			latestWeekend(CATALOG, null).map((entry) => entry.key),
			['21', '22']
		);
	});

	it('follows the live session', () => {
		assert.deepEqual(
			latestWeekend(CATALOG, '11').map((entry) => entry.key),
			['11', '12']
		);
	});

	it('is empty without a saved or live session', () => {
		assert.deepEqual(latestWeekend({ seasons: [] }, null), []);
	});
});

describe('sessionTitle', () => {
	it('names the place and the session', () => {
		const [race] = latestWeekend(CATALOG, '12').toReversed();

		assert.equal(race && sessionTitle(race), 'Bahrain Race');
	});
});
