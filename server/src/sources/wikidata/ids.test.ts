import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { circuitIdOf } from '@f1-live/shared/facts';
import type { SeasonResults } from '@f1-live/shared/results';

import { readSeasonResults } from '../../results/season.js';
import { DEFAULT_DATA_DIR } from '../../sinks/files.js';
import { CIRCUIT_ITEMS, DRIVER_ITEMS, unmappedIds } from './ids.js';

const season = (drivers: string[], circuits: string[]): SeasonResults => ({
	season: 2025,
	drivers: Object.fromEntries(
		drivers.map((id) => [id, { code: 'XXX', firstName: id, lastName: id }])
	),
	teams: {},
	rounds: circuits.map((circuit, index) => ({
		round: index + 1,
		meetingKey: index,
		name: circuit,
		location: circuit,
		circuit,
		countryCode: 'XXX',
		startsAt: '2025-01-01T00:00:00Z',
		sessions: []
	})),
	adjustments: []
});

const dataDir = process.env['DATA_DIR'] ?? DEFAULT_DATA_DIR;

describe('Wikidata ids', () => {
	it('names the drivers and circuits the mapping lacks', () => {
		assert.deepEqual(
			unmappedIds([season(['max-verstappen', 'new-driver'], ['Yas Marina Circuit', 'New Ring'])]),
			{ drivers: ['new-driver'], circuits: ['new-ring'] }
		);
	});

	it('maps every circuit name to one id', () => {
		assert.equal(circuitIdOf('Nürburgring'), 'nurburgring');
		assert.ok(DRIVER_ITEMS.size >= 44 && CIRCUIT_ITEMS.size >= 35);
	});

	it(
		'covers every driver and circuit in the results index',
		{ skip: !existsSync(path.join(dataDir, 'out', 'results')) && `no results index in ${dataDir}` },
		async () => {
			assert.deepEqual(unmappedIds(await readSeasonResults(dataDir)), {
				drivers: [],
				circuits: []
			});
		}
	);
});
