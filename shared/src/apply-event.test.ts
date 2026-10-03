import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EMPTY_SNAPSHOT, applyEvent } from './apply-event.ts';
import type { RaceEvent } from './events.ts';
import type { PenaltyStatus, RaceSnapshot } from './race.ts';

const RACE_START_MS = Date.UTC(2025, 10, 23, 4, 4, 8);

/** ISO time `seconds` after the start signal. */
function at(seconds: number): string {
	return new Date(RACE_START_MS + seconds * 1000).toISOString();
}

function replay(events: readonly RaceEvent[], from: RaceSnapshot = EMPTY_SNAPSHOT): RaceSnapshot {
	return events.reduce(applyEvent, from);
}

function started(): RaceEvent[] {
	return [
		{
			kind: 'session_info',
			at: at(-3600),
			session: {
				id: '9858',
				name: 'Race',
				meetingName: 'Las Vegas Grand Prix',
				circuit: 'Las Vegas',
				countryCode: 'USA',
				type: 'race',
				startsAt: '2025-11-23T04:00:00.000Z'
			}
		},
		{ kind: 'race_distance', at: at(-3600), totalLaps: 50 },
		{ kind: 'session_status', at: at(0), status: 'started' }
	];
}

function standing(
	seconds: number,
	driverNumber: string,
	position: number,
	gapToLeaderMs: number | null,
	intervalMs: number | null = gapToLeaderMs
): RaceEvent {
	return {
		kind: 'standing',
		at: at(seconds),
		driverNumber,
		position,
		gapToLeaderMs,
		intervalMs
	};
}

function correction(
	driverNumber: string,
	kind: 'disqualified' | 'time_penalty' | 'lap_penalty',
	seconds?: number
): RaceEvent {
	return {
		kind: 'classification_correction',
		at: at(9000),
		correction:
			seconds === undefined
				? { driverNumber, kind, reason: 'Stewards' }
				: { driverNumber, kind, seconds, reason: 'Stewards' }
	};
}

function order(snapshot: RaceSnapshot) {
	return snapshot.standings?.map((entry) => entry.driverNumber);
}

/** Driver, place, gap and interval of each entry, as the timing screens show them. */
function table(snapshot: RaceSnapshot) {
	return snapshot.standings?.map((entry) => [
		entry.driverNumber,
		entry.position,
		entry.gapToLeaderMs,
		entry.intervalMs
	]);
}

function lap(
	seconds: number,
	driverNumber: string,
	lapNumber: number,
	lapTimeMs: number | null = 96_000
): RaceEvent {
	return {
		kind: 'lap_completed',
		at: at(seconds),
		driverNumber,
		lap: lapNumber,
		lapTimeMs,
		sectorTimesMs: lapTimeMs === null ? [null, 32_000, 37_000] : [27_000, 32_000, 37_000]
	};
}

function weather(seconds: number, airTempC: number): RaceEvent {
	return {
		kind: 'weather',
		at: at(seconds),
		sample: { airTempC, trackTempC: 18, humidityPct: 38, windSpeedMs: 0.7, rainfall: false }
	};
}

function timePenalty(driverNumber: string, lapNumber: number, status: PenaltyStatus): RaceEvent {
	return {
		kind: 'penalty',
		at: at(lapNumber * 96),
		penalty: {
			driverNumber,
			kind: 'time',
			seconds: 5,
			reason: 'CAUSING A COLLISION',
			lap: lapNumber,
			status
		}
	};
}

function place(points: number, predictedPoints: number) {
	return { points, position: 1, predictedPoints, predictedPosition: 1 };
}

function deepFreeze<T>(value: T): T {
	if (value instanceof Object) {
		for (const nested of Object.values(value)) {
			deepFreeze(nested);
		}

		Object.freeze(value);
	}

	return value;
}

describe('applyEvent', () => {
	it('names the session and remembers when it started', () => {
		const snapshot = replay(started());

		assert.equal(snapshot.session.id, '9858');
		assert.equal(snapshot.session.name, 'Race');
		assert.equal(snapshot.session.totalLaps, 50);
		assert.equal(snapshot.status, 'started');
		assert.equal(snapshot.startedAt, at(0));

		const finished = replay(
			[{ kind: 'session_status', at: at(5000), status: 'finished' }],
			snapshot
		);

		assert.equal(finished.status, 'finished');
		assert.equal(finished.startedAt, at(0));
	});

	it('never changes the state it is given', () => {
		const before = deepFreeze(replay([...started(), standing(90, '1', 1, 0), lap(102, '1', 1)]));

		assert.doesNotThrow(() =>
			replay(
				[
					standing(190, '1', 1, 0),
					lap(198, '1', 2),
					{ kind: 'track_status', at: at(199), status: 'vsc' },
					{ kind: 'retirement', at: at(200), driverNumber: '1', reason: 'Retired' }
				],
				before
			)
		);
	});

	it('derives the first lap from the start and fills the missing sector', () => {
		const snapshot = replay([...started(), standing(102, '1', 1, 0), lap(102.3, '1', 1, null)]);
		const [first] = snapshot.laps;

		assert.equal(first?.lapTimeMs, 102_300);
		assert.deepEqual(first?.sectorTimesMs, [33_300, 32_000, 37_000]);
		assert.equal(first?.completedAt, at(102.3));
		assert.equal(snapshot.currentLap, 1);
	});

	it('ranks a lap by the gaps at the line, even when the order changes after a car crosses', () => {
		const snapshot = replay([
			...started(),
			standing(95, '1', 1, 0),
			lap(96, '1', 50),
			standing(121, '12', 4, 25_488),
			lap(121.5, '12', 50),
			// The feed adds car 12's five seconds before car 81 crosses.
			standing(122, '12', 5, 30_488),
			standing(123, '81', 4, 27_650),
			lap(123.7, '81', 50),
			standing(125, '30', 6, null),
			lap(190, '30', 49)
		]);

		const lap50 = snapshot.laps.filter((entry) => entry.lap === 50);

		assert.deepEqual(
			lap50.map((entry) => [
				entry.driverNumber,
				entry.position,
				entry.gapToLeaderMs,
				entry.intervalMs
			]),
			[
				['1', 1, 0, 0],
				['12', 2, 25_488, 25_488],
				['81', 3, 27_650, 2_162]
			]
		);
		assert.deepEqual(
			snapshot.standings?.map((entry) => entry.driverNumber),
			['1', '81', '12', '30']
		);
		assert.equal(snapshot.standings?.[0]?.lapsCompleted, 50);
	});

	it('times a lapped car against the first car to complete that lap', () => {
		const snapshot = replay([
			...started(),
			standing(90, '1', 1, 0),
			lap(96, '1', 10),
			standing(97, '43', 17, null),
			lap(120.5, '43', 10)
		]);

		assert.equal(snapshot.laps.find((entry) => entry.driverNumber === '43')?.gapToLeaderMs, 24_500);
	});

	it('keys stints by their first lap, so a repeated stint corrects the first', () => {
		const snapshot = replay([
			...started(),
			{
				kind: 'tyres_fitted',
				at: at(-600),
				driverNumber: '63',
				startLap: 1,
				compound: 'MEDIUM',
				tyreAgeAtStart: 0
			},
			standing(10, '63', 2, 1000),
			lap(100, '63', 17),
			{ kind: 'pit_entry', at: at(101), driverNumber: '63', lap: 18 },
			{
				kind: 'tyres_fitted',
				at: at(110),
				driverNumber: '63',
				startLap: 19,
				compound: 'UNKNOWN',
				tyreAgeAtStart: 0
			},
			{ kind: 'pit_exit', at: at(120), driverNumber: '63', lap: 18, laneTimeMs: 20_872 },
			lap(121, '63', 18),
			{
				kind: 'tyres_fitted',
				at: at(125),
				driverNumber: '63',
				startLap: 19,
				compound: 'HARD',
				tyreAgeAtStart: 2
			},
			lap(220, '63', 19)
		]);

		assert.deepEqual(
			snapshot.stints.map((stint) => [stint.stint, stint.compound, stint.startLap, stint.endLap]),
			[
				[1, 'MEDIUM', 1, 18],
				[2, 'HARD', 19, 19]
			]
		);

		const lap19 = snapshot.laps.find((entry) => entry.lap === 19);

		assert.equal(lap19?.compound, 'HARD');
		assert.equal(lap19?.tyreAge, 3);
		assert.equal(snapshot.laps.find((entry) => entry.lap === 17)?.tyreAge, 17);
	});

	it('marks in- and out-laps and lets the published lane time replace the measured one', () => {
		const snapshot = replay([
			...started(),
			standing(10, '22', 20, 11_529),
			{ kind: 'pit_entry', at: at(90), driverNumber: '22', lap: 1 },
			lap(97, '22', 1),
			{ kind: 'pit_exit', at: at(112), driverNumber: '22', lap: 1, laneTimeMs: 21_312 },
			{
				kind: 'pit_lane_time',
				at: at(112.1),
				stop: { driverNumber: '22', lap: 1, laneTimeMs: 21_383, stationaryMs: 2_500 }
			},
			lap(210, '22', 2)
		]);

		assert.deepEqual(snapshot.pitStops, [
			{ driverNumber: '22', lap: 1, laneTimeMs: 21_383, stationaryMs: 2_500 }
		]);
		assert.deepEqual(
			snapshot.laps.map((entry) => [entry.lap, entry.pitIn, entry.pitOut]),
			[
				[1, true, false],
				[2, false, true]
			]
		);
		assert.equal(snapshot.standings?.[0]?.inPit, false);
	});

	it('counts no stop for a car that enters the pits and retires there', () => {
		const snapshot = replay([
			...started(),
			standing(10, '5', 19, null),
			lap(100, '5', 1),
			{ kind: 'pit_entry', at: at(190), driverNumber: '5', lap: 2 },
			lap(200, '5', 2),
			{ kind: 'retirement', at: at(300), driverNumber: '5', reason: 'Retired' },
			standing(10, '18', 20, null),
			{ kind: 'retirement', at: at(90), driverNumber: '18', reason: 'Retired' }
		]);

		assert.deepEqual(snapshot.pitStops, []);
		assert.deepEqual(
			snapshot.retirements.map((retirement) => [retirement.driverNumber, retirement.lap]),
			[
				['5', 2],
				['18', 1]
			]
		);
		assert.ok(snapshot.standings?.every((entry) => entry.retired));
	});

	it('gives each lap the most serious track status during it', () => {
		const snapshot = replay([
			...started(),
			{ kind: 'track_status', at: at(-1000), status: 'green' },
			{ kind: 'track_status', at: at(13), status: 'yellow' },
			{ kind: 'track_status', at: at(26), status: 'green' },
			standing(90, '1', 1, 0),
			lap(102, '1', 1),
			{ kind: 'track_status', at: at(180), status: 'vsc' },
			lap(210, '1', 2),
			lap(343, '1', 3),
			{ kind: 'track_status', at: at(345), status: 'green' },
			lap(440, '1', 4),
			lap(536, '1', 5)
		]);

		assert.deepEqual(
			snapshot.laps.map((entry) => entry.trackStatus),
			['yellow', 'vsc', 'vsc', 'vsc', 'green']
		);
		assert.equal(snapshot.trackStatusLog?.length, 5);
		assert.equal(snapshot.trackStatus, 'green');
	});

	it('logs every session status, so the parts of a qualifying session can be told apart', () => {
		const snapshot = replay([
			...started(),
			{ kind: 'session_status', at: at(1080), status: 'finished' },
			{ kind: 'session_status', at: at(1500), status: 'inactive' },
			{ kind: 'session_status', at: at(1860), status: 'started' }
		]);

		assert.deepEqual(
			snapshot.statusLog?.map((change) => change.status),
			['started', 'finished', 'inactive', 'started']
		);
		assert.equal(snapshot.startedAt, at(0));
	});

	it('logs the session clock, stopped and running', () => {
		const snapshot = replay([
			...started(),
			{ kind: 'session_clock', at: at(-60), remainingMs: 1_080_000, running: false },
			{ kind: 'session_clock', at: at(1), remainingMs: 1_079_000, running: true }
		]);

		assert.deepEqual(snapshot.clockLog, [
			{ at: at(-60), remainingMs: 1_080_000, running: false },
			{ at: at(1), remainingMs: 1_079_000, running: true }
		]);
	});

	it('keeps the latest weather sample of each lap', () => {
		const snapshot = replay([
			...started(),
			weather(-60, 16.9),
			weather(30, 16.8),
			standing(90, '1', 1, 0),
			lap(102, '1', 1),
			weather(150, 16.7)
		]);

		assert.deepEqual(
			snapshot.weather.map((entry) => [entry.lap, entry.airTempC]),
			[
				[1, 16.8],
				[2, 16.7]
			]
		);
	});

	it('puts a pass and a radio clip on the lap the car was driving', () => {
		const snapshot = replay([
			...started(),
			standing(90, '1', 1, 0),
			{ kind: 'overtake', at: at(40), driverNumber: '1', count: 1 },
			lap(102, '1', 1),
			{ kind: 'team_radio', at: at(102), driverNumber: '1', path: 'TeamRadio/MAXVER01_1.mp3' },
			{ kind: 'overtake', at: at(150), driverNumber: '1', count: 2 }
		]);

		assert.deepEqual(
			snapshot.overtakes?.map((entry) => [entry.driverNumber, entry.lap, entry.count]),
			[
				['1', 1, 1],
				['1', 2, 2]
			]
		);
		assert.deepEqual(snapshot.teamRadio, [
			{ driverNumber: '1', lap: 2, at: at(102), path: 'TeamRadio/MAXVER01_1.mp3' }
		]);
	});

	it('puts a radio clip after the flag on the last lap', () => {
		const snapshot = replay([
			...started(),
			{ kind: 'race_distance', at: at(0), totalLaps: 1 },
			standing(90, '1', 1, 0),
			lap(102, '1', 1),
			{ kind: 'team_radio', at: at(200), driverNumber: '1', path: 'TeamRadio/MAXVER01_2.mp3' }
		]);

		assert.equal(snapshot.teamRadio?.[0]?.lap, 1);
	});

	it('replaces only the championship places that changed', () => {
		const snapshot = replay([
			{
				kind: 'championship',
				at: at(10),
				standings: {
					drivers: [
						{ driverNumber: '4', ...place(390, 390) },
						{ driverNumber: '1', ...place(341, 341) }
					],
					teams: [{ team: 'McLaren', ...place(756, 756) }]
				}
			},
			{
				kind: 'championship',
				at: at(200),
				standings: { drivers: [{ driverNumber: '1', ...place(341, 366) }], teams: [] }
			}
		]);

		assert.deepEqual(
			snapshot.championship?.drivers.map((entry) => [entry.driverNumber, entry.predictedPoints]),
			[
				['4', 390],
				['1', 366]
			]
		);
		assert.deepEqual(
			snapshot.championship?.teams.map((entry) => entry.team),
			['McLaren']
		);
	});

	it('closes a penalty when it is served and drops a revoked one', () => {
		const snapshot = replay([
			...started(),
			timePenalty('23', 20, 'issued'),
			timePenalty('12', 15, 'issued'),
			timePenalty('23', 37, 'served'),
			timePenalty('44', 30, 'issued'),
			timePenalty('44', 31, 'revoked')
		]);

		assert.deepEqual(
			snapshot.penalties?.map((entry) => [
				entry.driverNumber,
				entry.lap,
				entry.status,
				entry.servedLap
			]),
			[
				['23', 20, 'served', 37],
				['12', 15, 'issued', undefined],
				['44', 30, 'revoked', undefined]
			]
		);
	});

	it('applies disqualifications and time penalties to the classification', () => {
		const finished = replay([
			...started(),
			standing(10, '1', 1, 0),
			standing(10, '4', 2, 20_741),
			standing(10, '63', 3, 23_546),
			standing(10, '81', 4, 27_650),
			standing(10, '12', 5, 30_488),
			standing(10, '30', 6, null)
		]);

		const corrected = replay(
			[
				{
					kind: 'classification_correction',
					at: at(9000),
					correction: { driverNumber: '4', kind: 'disqualified', reason: 'Plank wear' }
				},
				{
					kind: 'classification_correction',
					at: at(9001),
					correction: { driverNumber: '81', kind: 'disqualified', reason: 'Plank wear' }
				},
				{
					kind: 'classification_correction',
					at: at(9002),
					correction: {
						driverNumber: '63',
						kind: 'time_penalty',
						seconds: 10,
						reason: 'Unsafe release'
					}
				}
			],
			finished
		);

		assert.deepEqual(
			corrected.standings?.map((entry) => [
				entry.driverNumber,
				entry.position,
				entry.gapToLeaderMs
			]),
			[
				['1', 1, 0],
				['12', 2, 30_488],
				['63', 3, 33_546],
				['30', 4, null],
				['4', 5, 20_741],
				['81', 6, 27_650]
			]
		);
		assert.equal(corrected.corrections?.length, 3);
		assert.ok(corrected.standings?.slice(-2).every((entry) => entry.disqualified));

		const ignored = replay(
			[standing(9100, '4', 2, 20_741), standing(9100, '63', 3, 23_546)],
			corrected
		);

		assert.deepEqual(ignored.standings, corrected.standings);
	});

	it('measures the car behind a disqualified one to the car ahead of it', () => {
		const finished = replay([
			...started(),
			standing(10, '1', 1, 0, 0),
			standing(10, '4', 2, 4_000, 4_000),
			standing(10, '63', 3, 6_805, 2_805),
			standing(10, '12', 4, 10_000, 3_195),
			standing(10, '30', 5, null, 21_000),
			standing(10, '16', 6, null, 9_000)
		]);

		assert.deepEqual(table(replay([correction('4', 'disqualified')], finished)), [
			['1', 1, 0, 0],
			['63', 2, 6_805, 6_805],
			['12', 3, 10_000, 3_195],
			['30', 4, null, 21_000],
			['16', 5, null, 9_000],
			['4', 6, 4_000, 4_000]
		]);

		assert.deepEqual(table(replay([correction('12', 'disqualified')], finished))?.slice(0, 4), [
			['1', 1, 0, 0],
			['4', 2, 4_000, 4_000],
			['63', 3, 6_805, 2_805],
			['30', 4, null, 24_195]
		]);
	});

	it('measures every gap to the new leader when the leader is disqualified', () => {
		const finished = replay([
			...started(),
			standing(10, '1', 1, 0, 0),
			standing(10, '4', 2, 4_000, 4_000),
			standing(10, '63', 3, 6_805, 2_805),
			standing(10, '30', 4, null, 21_000)
		]);

		assert.deepEqual(table(replay([correction('1', 'disqualified')], finished)), [
			['4', 1, 0, 0],
			['63', 2, 2_805, 2_805],
			['30', 3, null, 21_000],
			['1', 4, 0, 0]
		]);
	});

	describe('lapped cars', () => {
		/** Three cars one lap down cross the line in the order 43, 30, 41, as at Barcelona 2026. */
		const finished = replay([
			...started(),
			lap(90, '1', 1),
			lap(190, '1', 2),
			lap(100, '43', 1),
			lap(298, '43', 2),
			lap(102, '30', 1),
			lap(302, '30', 2),
			lap(104, '41', 1),
			lap(306, '41', 2),
			standing(400, '1', 1, 0, 0),
			standing(400, '43', 2, null, 30_000),
			standing(400, '30', 3, null, 2_000),
			standing(400, '41', 4, null, 6_000)
		]);

		it('re-sorts them by the time they crossed the line when one has a time penalty', () => {
			assert.deepEqual(order(replay([correction('43', 'time_penalty', 10)], finished)), [
				'1',
				'30',
				'41',
				'43'
			]);

			assert.deepEqual(order(replay([correction('43', 'time_penalty', 5)], finished)), [
				'1',
				'30',
				'43',
				'41'
			]);
		});

		it('takes a lap off a car and places it among the cars on that lap by crossing time', () => {
			const leaders = replay([
				...started(),
				lap(90, '1', 1),
				lap(190, '1', 2),
				lap(290, '1', 3),
				lap(92, '55', 1),
				lap(192, '55', 2),
				lap(292, '55', 3),
				lap(100, '14', 1),
				lap(190, '14', 2),
				lap(150, '18', 1),
				lap(196, '18', 2),
				standing(400, '1', 1, 0, 0),
				standing(400, '55', 2, 2_000, 2_000),
				standing(400, '14', 3, null, 9_000),
				standing(400, '18', 4, null, 1_000)
			]);

			const corrected = replay([correction('55', 'lap_penalty')], leaders);

			assert.deepEqual(
				corrected.standings?.map((entry) => [
					entry.driverNumber,
					entry.position,
					entry.lapsCompleted
				]),
				[
					['1', 1, 3],
					['14', 2, 2],
					['55', 3, 2],
					['18', 4, 2]
				]
			);
		});
	});

	it('takes positions from the running order outside races and leaves untimed laps at 0', () => {
		const snapshot = replay([
			...started(),
			{
				kind: 'session_info',
				at: at(1),
				session: {
					id: '9853',
					name: 'Practice 3',
					meetingName: 'Las Vegas Grand Prix',
					circuit: 'Las Vegas',
					countryCode: 'USA',
					type: 'practice',
					startsAt: '2025-11-22T00:30:00.000Z'
				}
			},
			standing(100, '4', 1, 0),
			standing(100, '1', 2, 412),
			lap(200, '1', 5),
			lap(300, '4', 3),
			lap(900, '4', 4, null)
		]);

		assert.deepEqual(
			snapshot.laps.map((entry) => [
				entry.driverNumber,
				entry.lap,
				entry.position,
				entry.gapToLeaderMs,
				entry.lapTimeMs
			]),
			[
				['4', 3, 1, 0, 96_000],
				['4', 4, 1, 0, 0],
				['1', 5, 2, 412, 96_000]
			]
		);
	});
});
