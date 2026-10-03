import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	availability,
	type Catalog,
	catalogSchema,
	defaultSessionKey,
	findSession,
	nextSession
} from './catalog.ts';

function session(key: number, name: string, startsAt: string, snapshot: boolean) {
	return {
		key,
		type: name === 'Race' ? ('race' as const) : ('practice' as const),
		name,
		startsAt,
		status: 'finished' as const,
		circuit: 'Sakhir',
		country: { code: 'BRN', name: 'Bahrain' },
		outputs: { raw: snapshot, events: snapshot, snapshot }
	};
}

const catalog: Catalog = catalogSchema.parse({
	seasons: [
		{
			year: 2026,
			meetings: [
				{
					key: 1300,
					name: 'Bahrain Grand Prix',
					officialName: 'Bahrain Grand Prix 2026',
					location: 'Sakhir',
					sessions: [
						session(11001, 'Practice 1', '2026-04-10T11:30:00.000Z', true),
						session(11002, 'Race', '2026-04-12T15:00:00.000Z', true)
					]
				},
				{
					key: 1301,
					name: 'Saudi Arabian Grand Prix',
					officialName: 'Saudi Arabian Grand Prix 2026',
					location: 'Jeddah',
					sessions: [
						session(11010, 'Practice 1', '2026-04-17T13:30:00.000Z', false),
						session(11011, 'Race', '2026-04-19T17:00:00.000Z', false)
					]
				}
			]
		}
	]
});

const SATURDAY = Date.parse('2026-04-18T12:00:00.000Z');

function entry(key: string) {
	const found = findSession(catalog, key);

	assert.ok(found);

	return found;
}

describe('catalog', () => {
	it('refuses a catalogue of another shape', () => {
		assert.equal(catalogSchema.safeParse({ seasons: [{ year: '2026' }] }).success, false);
	});

	it('opens the live session first, else the latest saved one', () => {
		assert.equal(defaultSessionKey(catalog, '11011'), '11011');
		assert.equal(defaultSessionKey(catalog, null), '11002');
		assert.equal(defaultSessionKey(catalog, '99999'), '11002');
	});

	it('tells live, saved, upcoming and missing sessions apart', () => {
		assert.equal(availability(entry('11011'), '11011', SATURDAY), 'live');
		assert.equal(availability(entry('11002'), '11011', SATURDAY), 'saved');
		assert.equal(availability(entry('11011'), null, SATURDAY), 'upcoming');
		assert.equal(availability(entry('11010'), null, SATURDAY), 'missing');
	});

	it('finds the next session to start', () => {
		assert.equal(nextSession(catalog, SATURDAY)?.key, '11011');
		assert.equal(nextSession(catalog, Date.parse('2026-05-01T00:00:00.000Z')), null);
	});
});
