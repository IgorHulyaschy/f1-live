/**
 * Replays the whole 2025 Las Vegas race (archive key 9858) through the decoder and the reducer,
 * and checks the snapshot against the official results. It needs the raw files, which
 * `npm run fetch:f1 -w server -- 9858` downloads; without them it is skipped.
 *
 * Sources for the expected values:
 * - result: https://www.formula1.com/en/results/2025/races/1274/las-vegas/race-result
 * - pit stops: https://www.formula1.com/en/results/2025/races/1274/las-vegas/pit-stop-summary
 * - fastest laps: https://www.formula1.com/en/results/2025/races/1274/las-vegas/fastest-laps
 * - tyres: https://press.pirelli.com/verstappen-keeps-the-championship-alive/ (Antonelli the only
 *   driver on softs; Hulkenberg, Bortoleto, Albon, Colapinto and Hamilton on hards; everyone
 *   else on mediums; the top eight finished on hards)
 * - grid, and Norris second and Piastri fourth before their disqualification:
 *   https://en.wikipedia.org/wiki/2025_Las_Vegas_Grand_Prix
 * - penalties and VSC periods: the FIA race control messages quoted with each test.
 *
 * The McLaren disqualifications came after the feed ended, so they are not in the archive.
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { before, describe, it } from 'node:test';

import { EMPTY_SNAPSHOT, applyEvent } from '@f1-live/shared';
import type { RaceSnapshot } from '@f1-live/shared';

import { RAW_DATA_DIR, readArchive } from './archive.ts';
import { F1Decoder } from './decode.ts';

const SESSION_DIR = path.join(RAW_DATA_DIR, '2025/2025-11-22_Las_Vegas_Grand_Prix/2025-11-22_Race');

const skip =
	!existsSync(path.join(SESSION_DIR, 'TimingData.jsonStream')) &&
	`no raw data in ${SESSION_DIR}; run npm run fetch:f1 -w server -- 9858`;

/** Order as the feed ended, with the official laps and gaps; null where the result has none. */
const FINISH: readonly (readonly [string, number, number | null])[] = [
	['1', 50, 0],
	['4', 50, null],
	['63', 50, 23_546],
	['81', 50, null],
	['12', 50, 30_488],
	['16', 50, 30_678],
	['55', 50, 34_924],
	['6', 50, 45_257],
	['27', 50, 51_134],
	['44', 50, 59_369],
	['31', 50, 60_635],
	['87', 50, 70_549],
	['14', 50, 85_308],
	['22', 50, 86_974],
	['10', 50, 91_702],
	['30', 49, null],
	['43', 49, null],
	['23', 35, null],
	['5', 2, null],
	['18', 0, null]
];

/** Car, lap and pit lane time of every stop, in the official order. */
const PIT_STOPS: readonly (readonly [string, number, number])[] = [
	['22', 1, 21_383],
	['5', 1, 33_230],
	['12', 2, 21_968],
	['30', 2, 32_736],
	['10', 2, 23_903],
	['23', 13, 23_361],
	['23', 14, 30_065],
	['14', 16, 21_068],
	['63', 17, 20_929],
	['87', 17, 21_491],
	['6', 20, 21_324],
	['81', 21, 21_371],
	['4', 22, 21_049],
	['55', 22, 21_164],
	['16', 24, 21_351],
	['1', 25, 21_708],
	['43', 25, 22_842],
	['31', 27, 22_389],
	['22', 27, 20_680],
	['30', 28, 21_287],
	['44', 29, 21_638],
	['27', 30, 22_333],
	['23', 34, 29_308]
];

/** Each driver's stints: compound and first lap; a stint starts on the lap after a stop. */
const STINTS = {
	'1': [
		['MEDIUM', 1],
		['HARD', 26]
	],
	'4': [
		['MEDIUM', 1],
		['HARD', 23]
	],
	'63': [
		['MEDIUM', 1],
		['HARD', 18]
	],
	'81': [
		['MEDIUM', 1],
		['HARD', 22]
	],
	'12': [
		['SOFT', 1],
		['HARD', 3]
	],
	'16': [
		['MEDIUM', 1],
		['HARD', 25]
	],
	'55': [
		['MEDIUM', 1],
		['HARD', 23]
	],
	'6': [
		['MEDIUM', 1],
		['HARD', 21]
	],
	'27': [
		['HARD', 1],
		['MEDIUM', 31]
	],
	'44': [
		['HARD', 1],
		['MEDIUM', 30]
	],
	'31': [
		['MEDIUM', 1],
		['HARD', 28]
	],
	'87': [
		['MEDIUM', 1],
		['HARD', 18]
	],
	'14': [
		['MEDIUM', 1],
		['HARD', 17]
	],
	'22': [
		['MEDIUM', 1],
		['HARD', 2],
		['MEDIUM', 28]
	],
	'10': [
		['MEDIUM', 1],
		['HARD', 3]
	],
	'30': [
		['MEDIUM', 1],
		['HARD', 3],
		['HARD', 29]
	],
	'43': [
		['HARD', 1],
		['MEDIUM', 26]
	],
	'23': [
		['HARD', 1],
		['MEDIUM', 14],
		['HARD', 15],
		['MEDIUM', 35]
	],
	'5': [
		['HARD', 1],
		['MEDIUM', 2]
	],
	'18': [['MEDIUM', 1]]
} satisfies Record<string, readonly (readonly [string, number])[]>;

/** Each driver's fastest lap and the lap it was set on. */
const FASTEST_LAPS: readonly (readonly [string, number, number])[] = [
	['1', 93_365, 50],
	['4', 93_965, 41],
	['12', 93_998, 48],
	['16', 94_304, 43],
	['81', 94_086, 47],
	['55', 94_496, 42],
	['87', 94_519, 50],
	['44', 94_553, 49],
	['31', 94_557, 48],
	['27', 94_592, 49],
	['63', 94_592, 50],
	['6', 94_620, 50],
	['30', 94_837, 47],
	['22', 94_967, 49],
	['23', 95_184, 26],
	['14', 95_629, 41],
	['10', 95_674, 44],
	['43', 95_780, 38]
];

/** Grid slots 1 to 19; Tsunoda started from the pit lane, which the feed lists as 20th. */
const GRID = [
	'4',
	'1',
	'55',
	'63',
	'81',
	'30',
	'14',
	'6',
	'16',
	'10',
	'27',
	'18',
	'31',
	'87',
	'43',
	'23',
	'12',
	'5',
	'44',
	'22'
];

describe('2025 Las Vegas race from the archive', { skip }, () => {
	let race: RaceSnapshot = EMPTY_SNAPSHOT;

	before(async () => {
		const decoder = new F1Decoder();
		const frames = await readArchive(SESSION_DIR);

		race = frames.flatMap((frame) => decoder.decode(frame)).reduce(applyEvent, EMPTY_SNAPSHOT);
	});

	it('names the session and follows it to the end', () => {
		assert.deepEqual(race.session, {
			id: '9858',
			name: 'Race',
			meetingName: 'Las Vegas Grand Prix',
			circuit: 'Las Vegas',
			countryCode: 'USA',
			type: 'race',
			startsAt: '2025-11-23T04:00:00.000Z',
			totalLaps: 50
		});
		assert.equal(race.status, 'ended');
		assert.equal(race.startedAt, '2025-11-23T04:04:08.477Z');
		assert.equal(race.currentLap, 50);
		assert.equal(race.drivers.length, 20);
		assert.deepEqual(
			race.startingGrid.map((slot) => slot.driverNumber),
			GRID
		);
	});

	it('ends with the order the feed published at the flag, Verstappen first', () => {
		const standings = race.standings ?? [];

		assert.deepEqual(
			standings.map((standing) => standing.driverNumber),
			FINISH.map(([driverNumber]) => driverNumber)
		);

		for (const [driverNumber, laps, gapMs] of FINISH) {
			const standing = standings.find((entry) => entry.driverNumber === driverNumber);

			assert.equal(standing?.lapsCompleted, laps, `laps of car ${driverNumber}`);

			if (gapMs !== null) {
				assert.equal(standing?.gapToLeaderMs, gapMs, `gap of car ${driverNumber}`);
			}
		}

		assert.deepEqual(
			standings.filter((standing) => standing.retired).map((standing) => standing.driverNumber),
			['23', '5', '18']
		);
	});

	it('adds Verstappen’s laps up to his race time, 1:21:08.429', () => {
		const totalMs = race.laps
			.filter((lap) => lap.driverNumber === '1')
			.reduce((sum, lap) => sum + lap.lapTimeMs, 0);

		// Lap 1 has no published time; it is timed from the start, to within the feed's delay.
		assert.ok(Math.abs(totalMs - 4_868_429) < 1000, `total ${totalMs}`);
	});

	it('has every lap once, with unique positions on each lap', () => {
		assert.equal(race.laps.length, 885);

		for (let lap = 1; lap <= 50; lap++) {
			const positions = race.laps
				.filter((entry) => entry.lap === lap)
				.map((entry) => entry.position);

			assert.deepEqual(
				positions,
				positions.map((_, index) => index + 1),
				`positions on lap ${lap}`
			);
		}

		assert.ok(race.laps.every((lap) => lap.compound !== 'UNKNOWN'));
	});

	it('reproduces the official pit stops', () => {
		assert.equal(race.pitStops.length, PIT_STOPS.length);

		for (const [driverNumber, lap, laneTimeMs] of PIT_STOPS) {
			const stop = race.pitStops.find(
				(entry) => entry.driverNumber === driverNumber && entry.lap === lap
			);

			// PitStopSeries has them to the millisecond; one stop missing there comes from
			// PitLaneTimeCollection, which cuts them to a tenth.
			assert.ok(
				stop && Math.abs(stop.laneTimeMs - laneTimeMs) < 50,
				`stop of car ${driverNumber} on lap ${lap}`
			);
		}

		const inLaps = race.laps
			.filter((lap) => lap.pitIn)
			.map((lap) => `${lap.driverNumber}/${lap.lap}`);

		// Albon and Bortoleto also drove into the pits to retire.
		assert.deepEqual(
			inLaps.toSorted(),
			[
				...PIT_STOPS.map(([driverNumber, lap]) => `${driverNumber}/${lap}`),
				'23/35',
				'5/2'
			].toSorted()
		);
	});

	it('reproduces each driver’s stints, one per stop', () => {
		for (const [driverNumber, expected] of Object.entries(STINTS)) {
			assert.deepEqual(
				race.stints
					.filter((stint) => stint.driverNumber === driverNumber)
					.map((stint) => [stint.compound, stint.startLap]),
				expected,
				`stints of car ${driverNumber}`
			);
		}
	});

	it('reads the penalties from race control', () => {
		// "FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 12 (ANT) - FALSE START - MOVING BEFORE SIGNAL"
		// "FIA STEWARDS: PENALTY SERVED - 5 SECOND TIME PENALTY FOR CAR 23 (ALB) - CAUSING A COLLISION"
		assert.deepEqual(race.penalties, [
			{
				driverNumber: '12',
				kind: 'time',
				seconds: 5,
				reason: 'FALSE START - MOVING BEFORE SIGNAL',
				lap: 15,
				status: 'issued'
			},
			{
				driverNumber: '23',
				kind: 'time',
				seconds: 5,
				reason: 'CAUSING A COLLISION',
				lap: 20,
				status: 'served',
				servedLap: 37
			},
			{
				driverNumber: '23',
				kind: 'reprimand',
				reason: 'STARTING PROCEDURE INFRINGEMENT',
				lap: 21,
				status: 'issued'
			}
		]);
	});

	it('marks the leader’s laps under the two virtual safety cars', () => {
		// "VIRTUAL SAFETY CAR DEPLOYED" on laps 2 and 16, "ENDING" on laps 4 and 16.
		const leaderLaps = race.laps.filter((lap) => lap.position === 1);

		assert.deepEqual(
			leaderLaps.filter((lap) => lap.trackStatus === 'vsc').map((lap) => lap.lap),
			[2, 3, 4, 16]
		);
		assert.ok(
			race.laps.every((lap) => lap.trackStatus !== 'safety_car' && lap.trackStatus !== 'red')
		);
	});

	it('retires Stroll, Bortoleto and Albon on the laps they stopped', () => {
		assert.deepEqual(
			race.retirements.map((retirement) => [retirement.driverNumber, retirement.lap]),
			[
				['18', 1],
				['5', 2],
				['23', 35]
			]
		);
	});

	it('keeps each driver’s fastest lap', () => {
		for (const [driverNumber, lapTimeMs, lap] of FASTEST_LAPS) {
			const best = race.personalBests?.find((entry) => entry.driverNumber === driverNumber);

			assert.deepEqual(
				[best?.lapTimeMs, best?.lap],
				[lapTimeMs, lap],
				`best of car ${driverNumber}`
			);
		}
	});
});
