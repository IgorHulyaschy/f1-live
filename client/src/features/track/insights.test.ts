import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { LapTelemetry, RaceControlMessage } from '@f1-live/shared';

import { PIT_LOSS_MS, pitLossOf } from '../../insights/pit-window.ts';
import { lapsUntilInRange, roadGapMs, roadNeighbours } from './battle.ts';
import { bestOf, dominance, miniSectorTimes } from './dominance.ts';
import { drsZones, openStretches } from './drs-zones.ts';
import { marshalSectorCount, marshalSpan, sectorFlags } from './flags.ts';
import { rejoinAmong } from './rejoin.ts';
import { channelAlong, speedMarks } from './speed.ts';
import { LAS_VEGAS, lapOf, session } from './test-session.ts';

/** A lap at an even pace: `lapMs` for the whole circuit. */
function evenLap(lapMs: number, rows = 400): LapTelemetry {
	const d = Array.from({ length: rows + 1 }, (_, index) => (LAS_VEGAS.lengthM * index) / rows);

	return {
		v: 1,
		driverNumber: '1',
		lap: 5,
		startedAt: '2025-11-23T04:10:00.000Z',
		lapTimeMs: lapMs,
		t: d.map((distance) => (distance / LAS_VEGAS.lengthM) * lapMs),
		d,
		x: d.map(() => 0),
		y: d.map(() => 0)
	};
}

/** Both cars cover a lap in 100 s; 44 runs 1.5 s behind 1. */
function progressAt(driverNumber: string, time: number): number {
	return (time - (driverNumber === '44' ? 1500 : 0)) / 100_000;
}

describe('battle on the road', () => {
	it('measures the gap as how long ago the car ahead was where the chaser is', () => {
		const gap = roadGapMs(progressAt, '1', '44', 200_000);

		assert.ok(gap !== null && Math.abs(gap - 1500) < 10);
		assert.equal(roadGapMs(progressAt, '44', '1', 200_000), null);
	});

	it('finds the traffic round the circuit, whatever lap each car is on', () => {
		const cars = [
			{ driverNumber: '1', distanceM: 5900 },
			{ driverNumber: '4', distanceM: 300 },
			{ driverNumber: '16', distanceM: 6000 },
			{ driverNumber: '44', distanceM: 3000 },
			{ driverNumber: '63', distanceM: null }
		];

		// 4 is 445 m ahead across the line; 1 is 100 m behind.
		assert.deepEqual(roadNeighbours(cars, '16', 6145), { ahead: '4', behind: '1' });
		assert.deepEqual(roadNeighbours(cars, '63', 6145), { ahead: null, behind: null });
	});

	it('counts laps until the chaser is within a second', () => {
		assert.equal(lapsUntilInRange(0.8, 0.1, 1), 0);
		assert.equal(lapsUntilInRange(2.05, 0.3, 1), 4);
		assert.equal(lapsUntilInRange(2, 0.02, 1), null);
		assert.equal(lapsUntilInRange(2, null, 1), null);
	});
});

describe('pit rejoin', () => {
	/** Car 1 laps in 96 s, stops at the end of lap 10 (in-lap 110 s, out-lap 108 s). */
	const laps = Array.from({ length: 16 }, (_, index) => {
		const lap = index + 1;

		const sectors =
			lap === 10
				? ([30_000, 32_000, 48_000] as const)
				: lap === 11
					? ([42_000, 32_000, 34_000] as const)
					: ([30_000, 32_000, 34_000] as const);

		return lapOf('1', lap, lap * 100, sectors, { pitIn: lap === 10, pitOut: lap === 11 });
	});

	it('measures the circuit’s loss from the session’s stops, and assumes a typical one before', () => {
		const loss = pitLossOf(
			session(laps, 'race', { pitStops: [{ driverNumber: '1', lap: 10, laneTimeMs: 21_000 }] })
		);

		assert.deepEqual([loss.stops, loss.greenMs], [1, 26_000]);
		assert.equal(loss.neutralisedMs, (26_000 * PIT_LOSS_MS.neutralised) / PIT_LOSS_MS.green);
		assert.deepEqual(pitLossOf(session(laps.slice(0, 5))), {
			greenMs: PIT_LOSS_MS.green,
			neutralisedMs: PIT_LOSS_MS.neutralised,
			stops: 0
		});
	});

	it('places the ghost among the cars by how far round they are', () => {
		const cars = [
			{ driverNumber: '1', progress: 12.5 },
			{ driverNumber: '4', progress: 12.45 },
			{ driverNumber: '16', progress: 12.4 },
			{ driverNumber: '44', progress: 12.2 },
			{ driverNumber: '63', progress: 12.1 }
		];

		assert.deepEqual(rejoinAmong(cars, '16', 12.15), {
			position: 4,
			ahead: { driverNumber: '44', progress: 12.2 },
			behind: { driverNumber: '63', progress: 12.1 }
		});
	});
});

describe('mini-sector dominance', () => {
	it('reads each mini sector’s time off a lap’s clock', () => {
		const times = miniSectorTimes(LAS_VEGAS, {
			distanceM: evenLap(96_000).d,
			timeMs: evenLap(96_000).t
		});

		const starts = LAS_VEGAS.miniSectorStartsM;

		assert.equal(times.length, 22);
		assert.ok(Math.abs((times[0] ?? 0) - ((starts[1] ?? 0) / LAS_VEGAS.lengthM) * 96_000) < 1);
		assert.ok(Math.abs(times.reduce((sum, time) => sum + time, 0) - 96_000) < 1);
	});

	it('gives each mini sector to the quickest, unless the loops name another of them as fastest', () => {
		const times = new Map([
			['1', [3000, 4000, 5000]],
			['4', [3100, 3900, 5000.5]]
		]);

		const plain = dominance(['1', '4'], times);

		assert.deepEqual(plain.winners, ['1', '4', '1']);
		assert.deepEqual(
			[...plain.won],
			[
				['1', 2],
				['4', 1]
			]
		);
		assert.deepEqual(
			[...plain.lostMs],
			[
				['1', 100],
				['4', 100.5]
			]
		);
		assert.deepEqual(dominance(['1', '4'], times, [null, null, '4']).winners, ['1', '4', '4']);
	});

	it('takes the best of each mini sector across laps', () => {
		assert.deepEqual(
			bestOf([
				[3000, null, 5000],
				[3100, 4000, 4900]
			]),
			[3000, 4000, 4900]
		);
	});
});

function message(text: string, at: string): RaceControlMessage {
	return { lap: 2, category: 'flag', message: text, at };
}

/** A lap with the DRS flap open from `from` to `to` metres. */
function drsLap(from: number, to: number): Pick<LapTelemetry, 'd' | 'drs'> {
	return { d: [0, from, to, 6000], drs: [0, 1, 0, 0] };
}

describe('flags and zones', () => {
	it('keeps the yellows still out, with the message that raised them', () => {
		const flags = sectorFlags([
			message('YELLOW IN TRACK SECTOR 2', '04:04:21'),
			message('DOUBLE YELLOW IN TRACK SECTOR 2', '04:04:22'),
			message('DOUBLE YELLOW IN TRACK SECTOR 17', '04:05:00'),
			message('CLEAR IN TRACK SECTOR 17', '04:06:00'),
			message('YELLOW IN TRACK SECTOR 5', '04:06:10')
		]);

		assert.deepEqual(
			flags.map((flag) => [flag.sector, flag.level, flag.message.at]),
			[
				[5, 'yellow', '04:06:10'],
				[2, 'double', '04:04:22']
			]
		);
		assert.deepEqual(
			sectorFlags([message('YELLOW IN TRACK SECTOR 2', 'a'), message('TRACK CLEAR', 'b')]),
			[]
		);
	});

	it('lays out marshal sectors as equal shares of the lap', () => {
		const count = marshalSectorCount(
			[message('DOUBLE YELLOW IN TRACK SECTOR 21', 'a')],
			LAS_VEGAS.lengthM
		);

		assert.equal(count, 21);
		assert.equal(marshalSectorCount([], 6000), 20);
		assert.deepEqual(marshalSpan(2, 20, 6000), { fromM: 300, toM: 600 });
	});

	it('finds the DRS zones where the flap opened on several laps', () => {
		assert.deepEqual(openStretches(drsLap(1000, 1800)), [{ fromM: 1000, toM: 1800 }]);
		assert.deepEqual(
			drsZones([drsLap(1000, 1800), drsLap(1010, 1790), drsLap(1020, 1810), drsLap(4000, 4300)]),
			[{ fromM: 1010, toM: 1800 }]
		);
	});
});

describe('speed and gear on the circuit', () => {
	it('cuts a lap into stretches with the channel’s value, and marks top speed and slow corners', () => {
		const lap = evenLap(96_000, 8);
		const speeds = [300, 320, 340, 300, 120, 280, 330, 200, 310];
		const withSpeed: LapTelemetry = { ...lap, speed: speeds, gear: [7, 8, 8, 7, 3, 6, 8, 5, 7] };

		// Stretches of a sixteenth of the lap take the gear of the sample nearer their middle.
		const gear = channelAlong(withSpeed, 'gear', LAS_VEGAS.lengthM / 16);

		assert.equal(gear.length, 16);
		assert.deepEqual(
			gear.slice(0, 6).map((stretch) => stretch.value),
			[7, 8, 8, 8, 8, 7]
		);

		const marks = speedMarks({ ...withSpeed, speed: speeds }, 2);

		assert.deepEqual(marks[0], { distanceM: (LAS_VEGAS.lengthM * 2) / 8, speed: 340, kind: 'top' });
	});
});
