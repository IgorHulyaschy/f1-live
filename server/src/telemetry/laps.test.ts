import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LAP_STEP_MS, buildLapTelemetry } from './laps.js';
import type { CarDataTrack } from './series.js';
import { LENGTH_M, carOn, driveLaps, stadiumOutline } from './test-circuit.js';

const outline = stadiumOutline();

const driven = driveLaps(
	[
		{ lapSeconds: 80, swing: 0.1 },
		{ lapSeconds: 82, swing: 0.1 }
	],
	10_000,
	0.3,
	9
);

const car = carOn(outline, driven);

const [startAt = 0, middle = 0] = driven.crossings;

/** Car data every 240 ms, the speed rising with time so a row's value shows when it was read. */
function carData(drsOpen: Uint8Array | null): CarDataTrack {
	const at = Float64Array.from({ length: 800 }, (_, index) => 10_000 + index * 240);

	return {
		at,
		speedKph: at.map((time) => (time - 10_000) / 100),
		rpm: at.map(() => 10_000),
		throttle: at.map((_, index) => (index % 2 === 0 ? 100 : 0)),
		gear: Uint8Array.from(at, (_, index) => Math.floor(index / 100)),
		brake: Uint8Array.from(at, (_, index) => (index % 2 === 0 ? 0 : 1)),
		drsOpen: drsOpen === null ? null : drsOpen
	};
}

describe('buildLapTelemetry', () => {
	const window = { driverNumber: '1', lap: 1, startAt, endAt: middle };
	const lap = buildLapTelemetry(car, carData(new Uint8Array(800).fill(1)), window);

	it('has a row every 250 ms and a last one at the end of the lap', () => {
		const step = lap.t[1] ?? 0;

		assert.equal(step, LAP_STEP_MS);
		assert.equal(lap.t[0], 0);
		assert.equal(lap.t.at(-1), Math.round(middle - startAt));
		assert.equal(lap.lapTimeMs, Math.round(middle - startAt));
		assert.equal(lap.startedAt, new Date(startAt).toISOString());
	});

	it('keeps every column the same length', () => {
		const length = lap.t.length;

		for (const column of [
			lap.d,
			lap.x,
			lap.y,
			lap.speed,
			lap.throttle,
			lap.brake,
			lap.gear,
			lap.rpm,
			lap.drs
		]) {
			assert.equal(column?.length, length);
		}
	});

	it('measures distance from 0 at the line to a lap, and never back', () => {
		assert.ok(Math.abs((lap.d[0] ?? 1) - 0) < 3);
		assert.ok(Math.abs((lap.d.at(-1) ?? 0) - LENGTH_M) < 0.01 * LENGTH_M);

		for (let index = 1; index < lap.d.length; index += 1) {
			assert.ok((lap.d[index] ?? 0) >= (lap.d[index - 1] ?? 0));
		}
	});

	it('reads continuous channels between samples and the others at the nearest', () => {
		// Row 5 is 1250 ms in; the feed's samples are at 1200 and 1440 ms.
		assert.equal(lap.speed?.[5], Math.round((1250 + (startAt - 10_000)) / 100));
		assert.ok([0, 1].includes(lap.brake?.[5] ?? 2));
		assert.equal(lap.rpm?.[5], 10_000);
	});

	it('leaves out the car data without any, and DRS where the feed has none', () => {
		const without = buildLapTelemetry(car, undefined, window);
		const noDrs = buildLapTelemetry(car, carData(null), window);

		assert.equal(without.speed, undefined);
		assert.equal(without.drs, undefined);
		assert.equal(Object.keys(without).includes('speed'), false);
		assert.ok(noDrs.speed !== undefined);
		assert.equal(noDrs.drs, undefined);
	});

	it('gzips to a small file', async () => {
		const { gzipJson } = await import('./files.js');

		assert.ok(gzipJson(lap).length < 50_000);
	});
});
