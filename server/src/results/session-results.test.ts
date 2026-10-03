import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EMPTY_SNAPSHOT } from '@f1-live/shared';
import type { Driver, Lap, RaceSnapshot, Standing } from '@f1-live/shared';

import { sessionResults } from './session-results.js';

function driver(number: string, firstName: string, lastName: string): Driver {
	return {
		number,
		code: lastName.slice(0, 3).toUpperCase(),
		firstName,
		lastName,
		team: 'Team',
		teamColour: '000000'
	};
}

function standing(
	driverNumber: string,
	position: number,
	lapsCompleted: number,
	flags: Partial<Standing> = {}
): Standing {
	return {
		driverNumber,
		position,
		gapToLeaderMs: position === 1 ? 0 : position * 1000,
		intervalMs: 1000,
		lapsCompleted,
		inPit: false,
		retired: false,
		disqualified: false,
		...flags
	};
}

function lap(
	driverNumber: string,
	number: number,
	lapTimeMs: number,
	extra: Partial<Lap> = {}
): Lap {
	return {
		driverNumber,
		lap: number,
		lapTimeMs,
		sectorTimesMs: [0, 0, 0],
		position: 1,
		gapToLeaderMs: 0,
		intervalMs: 0,
		compound: 'SOFT',
		tyreAge: 1,
		pitIn: false,
		pitOut: false,
		trackStatus: 'green',
		...extra
	};
}

const DRIVERS = [
	driver('44', 'Lewis', 'Hamilton'),
	driver('5', 'Sebastian', 'Vettel'),
	driver('7', 'Kimi', 'Räikkönen'),
	driver('33', 'Max', 'Verstappen'),
	driver('77', 'Valtteri', 'Bottas'),
	driver('3', 'Daniel', 'Ricciardo')
];

function race(overrides: Partial<RaceSnapshot>): RaceSnapshot {
	return {
		...EMPTY_SNAPSHOT,
		session: {
			id: '5394',
			meetingName: 'Test',
			circuit: 'Test',
			countryCode: 'AUS',
			type: 'race',
			totalLaps: 58,
			startsAt: '2019-03-17T05:10:00.000Z'
		},
		drivers: DRIVERS,
		startedAt: '2019-03-17T05:10:00.000Z',
		...overrides
	};
}

describe('sessionResults', () => {
	it('classifies cars by the 90% rule, a retired one too, and pays points, the fastest lap point in 2019', () => {
		const results = sessionResults(
			race({
				startingGrid: [
					{ driverNumber: '77', position: 2 },
					{ driverNumber: '44', position: 1 }
				],
				standings: [
					standing('77', 1, 58),
					standing('44', 2, 58),
					standing('7', 3, 53, { retired: true }),
					standing('5', 4, 51),
					standing('33', 5, 20, { retired: true }),
					standing('3', 6, 0, { disqualified: true })
				],
				personalBests: [
					{
						driverNumber: '77',
						lapTimeMs: 85_580,
						lap: 57,
						sectorTimesMs: [null, null, null],
						topSpeedsKph: {
							intermediate1: null,
							intermediate2: null,
							finishLine: null,
							speedTrap: null
						}
					},
					{
						driverNumber: '44',
						lapTimeMs: 86_057,
						lap: 57,
						sectorTimesMs: [null, null, null],
						topSpeedsKph: {
							intermediate1: null,
							intermediate2: null,
							finishLine: null,
							speedTrap: null
						}
					}
				],
				laps: [lap('77', 1, 90_000), lap('77', 2, 89_000), lap('44', 1, 90_500, { position: 2 })]
			}),
			2019
		);

		assert.deepEqual(
			results?.rows.map((row) => [
				row.driver,
				row.status,
				row.classified,
				row.points,
				row.grid,
				row.lapsLed ?? 0
			]),
			[
				['valtteri-bottas', 'finished', true, 26, 2, 2],
				['lewis-hamilton', 'finished', true, 18, 1, 0],
				['kimi-raikkonen', 'dnf', true, 15, null, 0],
				['sebastian-vettel', 'nc', false, 0, null, 0],
				['max-verstappen', 'dnf', false, 0, null, 0],
				['daniel-ricciardo', 'dsq', false, 0, null, 0]
			]
		);
		assert.equal(results?.rows[0]?.fastestLap, true);
	});

	it('marks a car that stopped before the start as not started', () => {
		const results = sessionResults(
			race({
				standings: [standing('44', 1, 58), standing('5', 2, 0, { retired: true })],
				retirements: [
					{ driverNumber: '5', lap: 0, reason: 'Retired', at: '2019-03-17T05:00:00.000Z' }
				]
			}),
			2019
		);

		assert.equal(results?.rows[1]?.status, 'dns');
	});

	it('gives each qualifying part’s best, leaving out out-laps, in-laps and deleted laps', () => {
		const results = sessionResults(
			race({
				session: { ...race({}).session, type: 'qualifying' },
				statusLog: [
					{ at: '2019-03-16T06:00:00.000Z', status: 'started' },
					{ at: '2019-03-16T06:18:00.000Z', status: 'finished' },
					{ at: '2019-03-16T06:25:00.000Z', status: 'started' },
					{ at: '2019-03-16T06:40:00.000Z', status: 'finished' }
				],
				standings: [standing('44', 1, 6), standing('5', 2, 4)],
				laps: [
					lap('44', 1, 95_000, { pitOut: true, completedAt: '2019-03-16T06:02:00.000Z' }),
					lap('44', 2, 82_000, { completedAt: '2019-03-16T06:04:00.000Z' }),
					lap('44', 3, 81_500, { completedAt: '2019-03-16T06:30:00.000Z' }),
					lap('44', 4, 80_900, { completedAt: '2019-03-16T06:32:00.000Z' }),
					lap('5', 1, 82_400, { completedAt: '2019-03-16T06:05:00.000Z' }),
					lap('5', 2, 79_000, { pitIn: true, completedAt: '2019-03-16T06:27:00.000Z' })
				],
				raceControl: [
					{
						lap: 4,
						category: 'other',
						message: 'CAR 44 (HAM) TIME 1:20.900 DELETED',
						driverNumber: '44',
						lapTimeRuling: { lapTimeMs: 80_900, reinstated: false }
					}
				]
			}),
			2019
		);

		assert.deepEqual(
			results?.rows.map((row) => [row.driver, row.parts, row.points]),
			[
				['lewis-hamilton', [82_000, 81_500], 0],
				['sebastian-vettel', [82_400, null], 0]
			]
		);
	});

	it('has nothing for practice', () => {
		assert.equal(
			sessionResults(
				race({
					session: { ...race({}).session, type: 'practice' },
					standings: [standing('44', 1, 20)]
				}),
				2019
			),
			null
		);
	});
});
