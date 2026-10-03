import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { LapIndex, LapTelemetry } from '@f1-live/shared';

import {
	comparableLaps,
	fastestComparableLap,
	miniSectorSplits,
	sharedDistance,
	speedMinima,
	traceRows
} from './telemetry-traces.ts';
import { fixtureJson, fixtureSession, lasVegasOutline } from './test-fixtures.ts';

const circuit = lasVegasOutline();

const race = fixtureSession('9858');

const index = fixtureJson<LapIndex>('telemetry/9858/laps.json.gz');

const verstappen = fixtureJson<LapTelemetry>('telemetry/9858/laps/1-50.json.gz');

const norris = fixtureJson<LapTelemetry>('telemetry/9858/laps/4-41.json.gz');

describe('fastestComparableLap', () => {
	it('picks each driver’s official fastest lap of the race', () => {
		// Official fastest laps: Verstappen 1:33.365 on lap 50, Norris 1:33.965 on lap 41
		// (https://www.formula1.com/en/results/2025/races/1274/las-vegas/fastest-laps).
		for (const [driverNumber, lap, lapTimeMs] of [
			['1', 50, 93_365],
			['4', 41, 93_965]
		] as const) {
			const best = fastestComparableLap(
				race.laps.filter((entry) => entry.driverNumber === driverNumber),
				comparableLaps(index.laps, driverNumber, circuit.lengthM)
			);

			assert.deepEqual([best?.lap, best?.lapTimeMs], [lap, lapTimeMs]);
		}
	});

	it('leaves out laps into or out of the pits and the standing start', () => {
		const comparable = comparableLaps(index.laps, '1', circuit.lengthM);

		assert.equal(comparable.has(1), false);
		assert.equal(comparable.has(25), false);
		assert.equal(comparable.has(26), false);
		assert.equal(comparable.size, 47);
	});
});

describe('traceRows', () => {
	const rows = traceRows([verstappen, norris], 10);

	it('puts both laps on one grid every 10 m up to the shorter lap', () => {
		assert.equal(rows[0]?.d, 0);
		assert.equal(rows[1]?.d, 10);
		assert.equal(rows.length, Math.floor(sharedDistance([verstappen, norris]) / 10) + 1);
		assert.equal(rows[0]?.speed0, verstappen.speed?.[0]);
		assert.ok(rows.every((row) => Number.isInteger(row.gear0) && Number.isInteger(row.gear1)));
		assert.ok(rows.every((row) => row.brake1 === 0 || row.brake1 === 1));
	});

	it('ends the delta near the gap between the two lap times', () => {
		// 1:33.965 against 1:33.365: Norris finishes the lap 0.6 s down.
		const last = rows.at(-1)?.delta1 ?? Number.NaN;

		assert.ok(Math.abs(last - (norris.lapTimeMs - verstappen.lapTimeMs) / 1000) < 0.15, `${last}`);
		assert.equal(rows[0]?.delta1, 0);
		assert.equal('delta0' in (rows[0] ?? {}), false);
	});

	it('is empty without a reference lap or a positive step', () => {
		assert.deepEqual(traceRows([], 10), []);
		assert.deepEqual(traceRows([verstappen], 0), []);
	});
});

describe('miniSectorSplits', () => {
	const splits = miniSectorSplits([verstappen, norris], circuit);

	it('splits the lap into the 22 mini sectors of the timing feed, 6, 7 and 9 per sector', () => {
		assert.equal(splits.length, 22);
		assert.deepEqual(
			[0, 1, 2].map((sector) => splits.filter((split) => split.sector === sector).length),
			[6, 7, 9]
		);
	});

	it('adds up to the lap time, less the few metres before the line', () => {
		const total = splits.reduce((sum, split) => sum + (split.timesMs[0] ?? 0), 0);

		assert.ok(verstappen.lapTimeMs - total >= 0 && verstappen.lapTimeMs - total < 300, `${total}`);
	});
});

describe('speedMinima', () => {
	it('finds the six braking zones of the lap, the slowest below 90 km/h', () => {
		const minima = speedMinima(verstappen);
		const slowest = Math.min(...(verstappen.speed ?? []));

		assert.equal(minima.length, 6);
		assert.ok(slowest < 90);
		assert.ok(minima.some((corner) => corner.speedKph === slowest));
		assert.ok(
			minima.every((corner, at) => at === 0 || corner.distanceM > (minima[at - 1]?.distanceM ?? 0))
		);
	});
});
