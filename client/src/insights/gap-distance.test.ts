import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Lap, LapIndex, LapTelemetry, TrackOutline } from '@f1-live/shared';

import {
	bestLaps,
	distanceInLastMs,
	lapGapField,
	metreGap,
	sectorGapFields,
	timedParts
} from './gap-distance.ts';
import { fixtureJson, fixtureSession } from './test-fixtures.ts';

// 2026 Bahrain qualifying (11730): Verstappen on pole with 1:35.130, Hamilton second, 0.298 s back.
const bahrain = fixtureSession('11730');

const index = fixtureJson<LapIndex>('telemetry/11730/laps.json.gz');

const circuit = fixtureJson<TrackOutline>('telemetry/circuits/12.json');

function telemetryOf(lap: Lap): LapTelemetry | null {
	const entry = index.laps.find(
		(candidate) => candidate.driverNumber === lap.driverNumber && candidate.lap === lap.lap
	);

	return entry ? fixtureJson<LapTelemetry>(`telemetry/11730/${entry.file}`) : null;
}

const noSpeed = () => null;

describe('metre gaps from telemetry', () => {
	const field = lapGapField(bestLaps(bahrain, 3), telemetryOf, noSpeed, circuit.lengthM);

	it('puts pole at the line with its lap time', () => {
		assert.equal(field.leaderMs, 95_130);
		assert.deepEqual(
			[field.cars[0]?.driverNumber, field.cars[0]?.metres, field.cars[0]?.estimated],
			['3', 0, false]
		);
	});

	it('puts Hamilton about 22 m behind, at close to 270 km/h over the line', () => {
		const hamilton = field.cars[1];

		// He crosses at 269 km/h, about 75 m a second, so 0.298 s is worth 22.1 m. His telemetry
		// lap runs 34 ms short of the official one, which the scaling takes out.
		assert.equal(hamilton?.driverNumber, '44');
		assert.equal(hamilton?.gapMs, 298);
		assert.equal(hamilton?.estimated, false);
		assert.ok(Math.abs((hamilton?.metres ?? 0) - 22.05) < 0.01, `${hamilton?.metres}`);
	});

	it('keeps the order of the lap times, each car further back than the one ahead', () => {
		const metres = field.cars.map((car) => car.metres);
		const last = field.cars[9];

		assert.equal(field.cars.length, 10);
		assert.deepEqual(
			metres,
			metres.toSorted((a, b) => a - b)
		);
		// Tenth in Q3, 2.543 s back, at about 67 m a second over its last stretch: 171 m.
		assert.equal(last?.gapMs, 2543);
		assert.ok(Math.abs((last?.metres ?? 0) - 171.01) < 0.01, `${last?.metres}`);
	});

	it('integrates the speed rather than the jumpy distance between position samples', () => {
		const lap = { t: [0, 250, 500, 750, 1000], d: [0, 30, 40, 70, 75], lapTimeMs: 1000 };

		// 72 km/h is 20 m/s: 5 m in the last quarter second, whatever the positions say.
		assert.equal(distanceInLastMs({ ...lap, speed: [72, 72, 72, 72, 72] }, 250), 5);
		assert.equal(distanceInLastMs(lap, 250), 5);
		assert.equal(distanceInLastMs(lap, 375), 20);
	});
});

describe('metre gaps without telemetry', () => {
	it('runs the gap at the speed over the line, as an estimate', () => {
		// 276 km/h over the line is 76.7 m a second.
		const gap = metreGap({
			gapMs: 298,
			lapMs: 95_428,
			telemetry: null,
			lineSpeedKph: 276,
			lengthM: circuit.lengthM
		});

		assert.deepEqual([gap.metres.toFixed(2), gap.estimated], ['22.85', true]);
	});

	it('falls back to the average speed round the lap', () => {
		// 5482 m in 95.4 s is 57.4 m a second: shorter than at the line, where cars are flat out.
		const gap = metreGap({
			gapMs: 298,
			lapMs: 95_428,
			telemetry: null,
			lineSpeedKph: null,
			lengthM: circuit.lengthM
		});

		assert.deepEqual([gap.metres.toFixed(2), gap.estimated], ['17.12', true]);
	});
});

describe('best laps by part', () => {
	it('finds the three parts and their fields', () => {
		assert.deepEqual(timedParts(bahrain), [1, 2, 3]);
		assert.deepEqual(
			([1, 2, 3] as const).map((part) => bestLaps(bahrain, part)[0]?.lapTimeMs),
			[96_477, 95_696, 95_130]
		);
		assert.equal(bestLaps(bahrain, 'best').length, 22);
	});

	it('gives each sector its own order', () => {
		const lengths = [
			circuit.sectorBoundariesM[0],
			circuit.sectorBoundariesM[1] - circuit.sectorBoundariesM[0],
			circuit.lengthM - circuit.sectorBoundariesM[1]
		] as const;

		const sectors = sectorGapFields(bestLaps(bahrain, 3), lengths);

		assert.deepEqual(
			sectors.map((sector) => sector.sector),
			[1, 2, 3]
		);

		for (const { field } of sectors) {
			assert.equal(field.cars[0]?.metres, 0);
			assert.ok(field.cars.every((car) => car.metres >= 0));
		}
	});
});
