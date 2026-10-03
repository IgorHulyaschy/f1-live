import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';

import { EMPTY_SNAPSHOT, applyEvent } from '@f1-live/shared';
import type { RaceEvent } from '@f1-live/shared';

import { mergeStreams, parseJsonStream } from './archive.js';
import { F1Decoder, parseDuration } from './decode.js';
import type { TopicFrame } from './decode.js';

/** Trimmed from the 2025 Las Vegas race (archive key 9858), one file per topic. */
const FIXTURES = path.join(import.meta.dirname, 'fixtures/2025-las-vegas-race');

/** Where the race's streams start, from its ExtrapolatedClock. */
const STREAM_START_MS = Date.parse('2025-11-23T03:06:26.850Z');

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function offsetMs(offset: string): number {
	const [hours = 0, minutes = 0, seconds = 0] = offset.split(':').map(Number);

	return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000);
}

function at(offset: string): string {
	return new Date(STREAM_START_MS + offsetMs(offset)).toISOString();
}

function frame(topic: string, offset: string, data: Json): TopicFrame {
	return { topic, data, timestamp: STREAM_START_MS + offsetMs(offset) };
}

async function fixture(...topics: string[]): Promise<TopicFrame[]> {
	const streams = await Promise.all(
		topics.map(async (topic) => {
			const text = await readFile(path.join(FIXTURES, `${topic}.jsonStream`), 'utf8');

			return [topic, parseJsonStream(topic, text)] as const;
		})
	);

	return mergeStreams(new Map(streams), STREAM_START_MS);
}

function decodeAll(frames: readonly TopicFrame[]): RaceEvent[] {
	const decoder = new F1Decoder();

	return frames
		.toSorted((a, b) => a.timestamp - b.timestamp)
		.flatMap((entry) => decoder.decode(entry));
}

function ofKind<K extends RaceEvent['kind']>(
	events: readonly RaceEvent[],
	kind: K
): Extract<RaceEvent, { kind: K }>[] {
	return events.filter((event): event is Extract<RaceEvent, { kind: K }> => event.kind === kind);
}

const started = frame('SessionStatus', '00:57:41.627', { Status: 'Started' });

/** Russell's stop at the end of lap 17, which the feed reports as two new stints. */
const russellStop = [
	frame('TimingData', '01:24:50.000', { Lines: { '63': { NumberOfLaps: 16 } } }),
	frame('TimingData', '01:26:26.128', { Lines: { '63': { InPit: true } } }),
	frame('TimingData', '01:26:29.081', { Lines: { '63': { NumberOfLaps: 17 } } }),
	frame('TimingData', '01:26:47.000', { Lines: { '63': { InPit: false } } })
];

/** Tsunoda's stops at the end of laps 1 and 27. */
const tsunodaStops = [
	frame('TimingData', '00:59:36.751', { Lines: { '22': { InPit: true } } }),
	frame('TimingData', '00:59:39.732', { Lines: { '22': { NumberOfLaps: 1 } } }),
	frame('TimingData', '00:59:58.063', { Lines: { '22': { InPit: false } } }),
	frame('TimingData', '01:42:00.000', { Lines: { '22': { NumberOfLaps: 26 } } }),
	frame('TimingData', '01:43:21.053', { Lines: { '22': { InPit: true } } }),
	frame('TimingData', '01:43:25.000', { Lines: { '22': { NumberOfLaps: 27 } } }),
	frame('TimingData', '01:43:41.873', { Lines: { '22': { InPit: false } } })
];

describe('F1Decoder', () => {
	it('names the session and gives its start in UTC (SessionInfo)', async () => {
		const events = decodeAll(await fixture('SessionInfo'));

		assert.deepEqual(events, [
			{
				kind: 'session_info',
				at: at('00:00:00.000'),
				session: {
					id: '9858',
					name: 'Race',
					meetingName: 'Las Vegas Grand Prix',
					circuit: 'Las Vegas',
					countryCode: 'USA',
					type: 'race',
					startsAt: '2025-11-23T04:00:00.000Z'
				}
			}
		]);
	});

	it('reports each session status once (SessionStatus)', async () => {
		const events = ofKind(decodeAll(await fixture('SessionStatus')), 'session_status');

		assert.deepEqual(
			events.map((event) => [event.at, event.status]),
			[
				[at('00:00:09.365'), 'inactive'],
				[at('00:57:41.627'), 'started'],
				[at('02:18:50.324'), 'finished'],
				[at('02:20:59.800'), 'finalised'],
				[at('02:22:51.060'), 'ended']
			]
		);
	});

	it('enters each driver once and ignores timing-order updates (DriverList)', async () => {
		const events = ofKind(decodeAll(await fixture('DriverList')), 'driver_entry');

		assert.deepEqual(
			events.map((event) => event.driver.code),
			['VER', 'NOR', 'RUS']
		);
		assert.deepEqual(events[0]?.driver, {
			number: '1',
			code: 'VER',
			firstName: 'Max',
			lastName: 'Verstappen',
			team: 'Red Bull Racing',
			teamColour: '4781D7',
			headshotUrl:
				'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png.transform/1col/image.png',
			imageId: 'common/f1/2025/redbullracing/maxver01/2025redbullracingmaxver01right'
		});
	});

	// 2026 Barcelona Practice 1 (key 11300) lists its drivers without names or teams beyond FullName.
	it('enters a driver whose list has no team or split name, reading the name from FullName (DriverList)', () => {
		const events = decodeAll([
			frame('DriverList', '00:00:01.000', {
				'3': { RacingNumber: '3', FullName: 'Max VERSTAPPEN', Tla: 'VER', Line: 1 },
				'12': { RacingNumber: '12', FullName: 'Andrea Kimi ANTONELLI', Tla: 'ANT', Line: 2 },
				'43': { RacingNumber: '43', FullName: 'Franco COLAPINTO', Tla: 'COL' }
			}),
			frame('DriverList', '00:00:02.000', { '3': { Line: 2 } })
		]);

		assert.deepEqual(
			ofKind(events, 'driver_entry').map((event) => event.driver),
			[
				{
					number: '3',
					code: 'VER',
					firstName: 'Max',
					lastName: 'Verstappen',
					team: '',
					teamColour: '808080'
				},
				{
					number: '12',
					code: 'ANT',
					firstName: 'Andrea Kimi',
					lastName: 'Antonelli',
					team: '',
					teamColour: '808080'
				},
				{
					number: '43',
					code: 'COL',
					firstName: 'Franco',
					lastName: 'Colapinto',
					team: '',
					teamColour: '808080'
				}
			]
		);
	});

	it('does not enter a driver the list names only by abbreviation (DriverList)', () => {
		assert.deepEqual(
			decodeAll([frame('DriverList', '00:00:01.000', { '3': { Tla: 'VER', Line: 1 } })]),
			[]
		);
	});

	it('takes the race distance once (LapCount)', async () => {
		assert.deepEqual(decodeAll(await fixture('LapCount')), [
			{ kind: 'race_distance', at: at('00:00:01.453'), totalLaps: 50 }
		]);
	});

	it('maps track status codes and treats a VSC ending as the VSC (TrackStatus)', async () => {
		const events = ofKind(decodeAll(await fixture('TrackStatus')), 'track_status');

		assert.deepEqual(
			events.map((event) => event.status),
			[
				'green',
				'yellow',
				'green',
				'yellow',
				'green',
				'yellow',
				'green',
				'yellow',
				'green',
				'yellow',
				'vsc',
				'green',
				'vsc',
				'green'
			]
		);
		assert.equal(events[10]?.at, at('01:00:41.129'));
	});

	it('turns line updates into laps, standings and pit visits (TimingData)', async () => {
		const events = decodeAll([...(await fixture('TimingData')), started]);
		const laps = ofKind(events, 'lap_completed');

		assert.deepEqual(laps, [
			{
				kind: 'lap_completed',
				at: at('00:59:24.239'),
				driverNumber: '1',
				lap: 1,
				lapTimeMs: null,
				sectorTimesMs: [null, 32_691, 37_446]
			},
			{
				kind: 'lap_completed',
				at: at('00:59:39.732'),
				driverNumber: '22',
				lap: 1,
				lapTimeMs: null,
				sectorTimesMs: [null, 33_657, 41_687]
			},
			{
				kind: 'lap_completed',
				at: at('01:01:11.710'),
				driverNumber: '1',
				lap: 2,
				lapTimeMs: 107_622,
				sectorTimesMs: [28_482, 32_633, 46_507]
			}
		]);

		assert.deepEqual(
			events.filter((event) => event.kind === 'pit_entry' || event.kind === 'pit_exit'),
			[
				{ kind: 'pit_entry', at: at('00:59:36.751'), driverNumber: '22', lap: 1 },
				{
					kind: 'pit_exit',
					at: at('00:59:58.063'),
					driverNumber: '22',
					lap: 1,
					laneTimeMs: 21_312
				}
			]
		);

		const standings = ofKind(events, 'standing');

		assert.deepEqual(
			standings.find((event) => event.at === at('00:57:53.375')),
			{
				kind: 'standing',
				at: at('00:57:53.375'),
				driverNumber: '1',
				position: 1,
				gapToLeaderMs: 0,
				intervalMs: 0
			}
		);
		assert.deepEqual(
			standings.find((event) => event.at === at('00:59:32.959')),
			{
				kind: 'standing',
				at: at('00:59:32.959'),
				driverNumber: '22',
				position: 17,
				gapToLeaderMs: 11_529,
				intervalMs: 854
			}
		);
		assert.deepEqual(ofKind(events, 'retirement'), [
			{ kind: 'retirement', at: at('01:04:37.089'), driverNumber: '5', reason: 'Retired' }
		]);
	});

	it('keys stints by their first lap and survives a stint reported twice (TimingAppData)', async () => {
		const events = decodeAll([
			...(await fixture('TimingAppData')),
			started,
			...russellStop,
			...tsunodaStops
		]);

		assert.deepEqual(
			ofKind(events, 'grid_position').map((event) => [event.driverNumber, event.position]),
			[
				['22', 20],
				['63', 4]
			]
		);
		assert.deepEqual(
			ofKind(events, 'tyres_fitted').map((event) => [
				event.driverNumber,
				event.startLap,
				event.compound,
				event.tyreAgeAtStart
			]),
			[
				['22', 1, 'MEDIUM', 0],
				['63', 1, 'MEDIUM', 0],
				['22', 2, 'HARD', 0],
				['63', 18, 'UNKNOWN', 0],
				['63', 18, 'HARD', 0],
				['63', 18, 'HARD', 0],
				['22', 28, 'UNKNOWN', 0],
				['22', 28, 'MEDIUM', 1]
			]
		);

		const snapshot = events.reduce(applyEvent, EMPTY_SNAPSHOT);

		assert.deepEqual(
			snapshot.stints.map((stint) => [
				stint.driverNumber,
				stint.compound,
				stint.startLap,
				stint.endLap
			]),
			[
				['22', 'MEDIUM', 1, 1],
				['22', 'HARD', 2, 27],
				['22', 'MEDIUM', 28, 28],
				['63', 'MEDIUM', 1, 17],
				['63', 'HARD', 18, 18]
			]
		);
	});

	it('places the stints of a session joined midway by their own lap counts', () => {
		const events = decodeAll([
			started,
			frame('TimingData', '01:30:00.000', { Lines: { '44': { NumberOfLaps: 20 } } }),
			frame('TimingAppData', '01:30:00.000', {
				Lines: {
					'44': {
						Stints: [
							{ Compound: 'SOFT', StartLaps: 0, TotalLaps: 5 },
							{ Compound: 'HARD', StartLaps: 2, TotalLaps: 12 },
							{ Compound: 'MEDIUM', StartLaps: 0, TotalLaps: 5 }
						]
					}
				}
			})
		]);

		assert.deepEqual(
			ofKind(events, 'tyres_fitted').map((event) => [event.startLap, event.compound]),
			[
				[1, 'SOFT'],
				[6, 'HARD'],
				[16, 'MEDIUM']
			]
		);
	});

	it('reads practice gaps to the fastest lap', () => {
		const events = decodeAll([
			frame('TimingData', '00:10:00.000', {
				Lines: {
					'4': { Position: '1', TimeDiffToFastest: '', TimeDiffToPositionAhead: '' },
					'1': { Position: '2', TimeDiffToFastest: '+0.412', TimeDiffToPositionAhead: '+0.412' }
				}
			})
		]);

		assert.deepEqual(
			ofKind(events, 'standing').map((event) => [
				event.driverNumber,
				event.gapToLeaderMs,
				event.intervalMs
			]),
			[
				['1', 412, 412],
				['4', 0, 0]
			]
		);
	});

	it('merges TyreStintSeries into the same stints without repeating them', async () => {
		const appOnly = decodeAll([...(await fixture('TimingAppData')), started, ...russellStop]);

		const both = decodeAll([
			...(await fixture('TimingAppData', 'TyreStintSeries')),
			started,
			...russellStop
		]);

		assert.deepEqual(ofKind(both, 'tyres_fitted'), ofKind(appOnly, 'tyres_fitted'));

		const seriesOnly = decodeAll([...(await fixture('TyreStintSeries')), started, ...russellStop]);

		assert.deepEqual(
			ofKind(seriesOnly, 'tyres_fitted').map((event) => [event.startLap, event.compound]),
			[
				[1, 'MEDIUM'],
				[18, 'UNKNOWN'],
				[18, 'HARD'],
				[18, 'HARD']
			]
		);
	});

	it('reports personal bests with speeds (TimingStats)', async () => {
		const bests = ofKind(decodeAll(await fixture('TimingStats')), 'personal_best');

		assert.deepEqual(bests.at(-1)?.best, {
			driverNumber: '1',
			lapTimeMs: 93_365,
			lap: 50,
			sectorTimesMs: [26_350, 31_156, 35_859],
			topSpeedsKph: { intermediate1: 188, intermediate2: null, finishLine: 321, speedTrap: 332 }
		});
	});

	it('retires a car the feed takes out of the race (DriverRaceInfo)', async () => {
		assert.deepEqual(decodeAll(await fixture('DriverRaceInfo')), [
			{ kind: 'retirement', at: at('00:59:31.827'), driverNumber: '18', reason: 'Retired' }
		]);
	});

	it('prefers PitStopSeries lane times to the tenths in PitLaneTimeCollection', async () => {
		const events = decodeAll(await fixture('PitLaneTimeCollection', 'PitStopSeries'));
		const snapshot = events.reduce(applyEvent, EMPTY_SNAPSHOT);

		assert.deepEqual(snapshot.pitStops, [
			{ driverNumber: '22', lap: 1, laneTimeMs: 21_383, stationaryMs: 2_500 },
			{ driverNumber: '5', lap: 1, laneTimeMs: 33_230, stationaryMs: 14_200 },
			{ driverNumber: '31', lap: 27, laneTimeMs: 22_300 },
			{ driverNumber: '22', lap: 27, laneTimeMs: 20_600 },
			{ driverNumber: '27', lap: 30, laneTimeMs: 22_300 }
		]);
	});

	it('categorises race control and reads penalties from it (RaceControlMessages)', async () => {
		const events = decodeAll(await fixture('RaceControlMessages'));

		assert.deepEqual(
			ofKind(events, 'race_control').map(({ message }) => [
				message.lap,
				message.category,
				message.driverNumber ?? null
			]),
			[
				[1, 'flag', null],
				[1, 'drs', null],
				[1, 'flag', null],
				[2, 'safety_car', null],
				[3, 'incident', '81'],
				[4, 'safety_car', null],
				[4, 'incident', '5'],
				[15, 'penalty', '12'],
				[15, 'incident', '23'],
				[16, 'safety_car', null],
				[16, 'safety_car', null],
				[20, 'penalty', '23'],
				[21, 'penalty', '23'],
				[36, 'flag', '23'],
				[37, 'penalty', '23'],
				[50, 'flag', null]
			]
		);

		assert.deepEqual(
			ofKind(events, 'penalty').map(({ penalty }) => penalty),
			[
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
					status: 'issued'
				},
				{
					driverNumber: '23',
					kind: 'reprimand',
					reason: 'STARTING PROCEDURE INFRINGEMENT',
					lap: 21,
					status: 'issued'
				},
				{
					driverNumber: '23',
					kind: 'time',
					seconds: 5,
					reason: 'CAUSING A COLLISION',
					lap: 37,
					status: 'served'
				}
			]
		);
	});

	it('reads weather samples as numbers (WeatherData)', async () => {
		assert.deepEqual(
			ofKind(decodeAll(await fixture('WeatherData')), 'weather').map((event) => event.sample),
			[
				{ airTempC: 16.9, trackTempC: 18, humidityPct: 38, windSpeedMs: 0.7, rainfall: false },
				{ airTempC: 16.9, trackTempC: 17.6, humidityPct: 38, windSpeedMs: 0.7, rainfall: false }
			]
		);
	});

	it('names the topic when a frame does not match the feed format', () => {
		const decoder = new F1Decoder();

		assert.throws(
			() => decoder.decode(frame('LapCount', '00:00:01.000', { TotalLaps: 'fifty' })),
			/LapCount frame at 2025-11-23T03:06:27.850Z/
		);
		assert.deepEqual(decoder.decode(frame('TeamRadio', '00:00:01.000', { Captures: [] })), []);
	});
});

describe('parseDuration', () => {
	it('reads lap, sector and gap times', () => {
		assert.equal(parseDuration('1:33.365'), 93_365);
		assert.equal(parseDuration('37.446'), 37_446);
		assert.equal(parseDuration('+20.741'), 20_741);
		assert.equal(parseDuration('+1:31.697'), 91_697);
		assert.equal(parseDuration('21.3'), 21_300);
	});

	it('has no time for empty values and gaps in laps', () => {
		assert.equal(parseDuration(''), null);
		assert.equal(parseDuration('1L'), null);
		assert.equal(parseDuration('LAP 12'), null);
	});
});
