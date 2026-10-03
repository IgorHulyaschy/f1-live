import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { type CarEstimate, estimateCar, estimateModel } from './estimate.ts';
import { at, LAS_VEGAS, lapOf, session } from './test-session.ts';

function distance(estimate: CarEstimate): number {
	assert.equal(estimate.place.kind, 'track');

	return estimate.place.kind === 'track' ? estimate.place.distanceM : Number.NaN;
}

/** A 96 s lap of 30, 32 and 34 s sectors. */
const SECTORS = [30_000, 32_000, 34_000] as const;

describe('estimating places from timing', () => {
	it('puts the field on the grid before the start, pole closest to the line', () => {
		const model = estimateModel(session([]), LAS_VEGAS, false);

		assert.equal(distance(estimateCar(model, '1', at(-5))), -10);
		assert.equal(distance(estimateCar(model, '4', at(-5))), -18);
	});

	it('drives a known lap at the pace of its sectors, reaching each sector end on time', () => {
		const model = estimateModel(
			session([lapOf('1', 1, 100, [34_000, 32_000, 34_000]), lapOf('1', 2, 196, SECTORS)]),
			LAS_VEGAS,
			false
		);

		const [first, second] = LAS_VEGAS.sectorBoundariesM;

		assert.equal(distance(estimateCar(model, '1', at(100))), 0);
		assert.ok(Math.abs(distance(estimateCar(model, '1', at(130))) - first) < 0.01);
		assert.ok(Math.abs(distance(estimateCar(model, '1', at(162))) - second) < 0.01);
		assert.ok(Math.abs(distance(estimateCar(model, '1', at(195.999))) - LAS_VEGAS.lengthM) < 1);
		assert.equal(estimateCar(model, '1', at(162)).progress, 1 + second / LAS_VEGAS.lengthM);
	});

	it('starts lap 1 from the car’s grid slot', () => {
		const model = estimateModel(session([lapOf('4', 1, 100, SECTORS)]), LAS_VEGAS, false);

		assert.equal(distance(estimateCar(model, '4', at(0))), -18);
		assert.ok(distance(estimateCar(model, '4', at(50))) > 1000);
	});

	it('runs an in-lap into the pit lane and an out-lap out of it', () => {
		const model = estimateModel(
			session([
				lapOf('1', 1, 96, SECTORS),
				lapOf('1', 2, 200, SECTORS, { pitIn: true }),
				lapOf('1', 3, 310, SECTORS, { pitOut: true })
			]),
			LAS_VEGAS,
			false
		);

		const crossing = estimateCar(model, '1', at(199.9)).place;

		// Laps are counted at the line, 31% of the way down the Las Vegas pit lane.
		assert.equal(crossing.kind, 'pit');
		assert.ok(crossing.kind === 'pit' && crossing.laneShare > 0.25 && crossing.laneShare < 0.31);
		assert.equal(estimateCar(model, '1', at(150)).place.kind, 'track');

		const leaving = estimateCar(model, '1', at(203)).place;

		assert.ok(leaving.kind === 'pit' && leaving.laneShare > crossing.laneShare);
		assert.ok(
			estimateCar(model, '1', at(203)).progress > estimateCar(model, '1', at(199.9)).progress
		);
		assert.ok(distance(estimateCar(model, '1', at(220))) > (LAS_VEGAS.pitLane?.exitM ?? 0));
	});

	it('holds a lap in progress short of the line until the car is seen crossing it', () => {
		const model = estimateModel(session([lapOf('1', 1, 96, SECTORS)]), LAS_VEGAS, true);

		assert.ok(distance(estimateCar(model, '1', at(96 + 48))) > 2000);
		assert.ok(distance(estimateCar(model, '1', at(96 + 300))) < LAS_VEGAS.lengthM);
	});

	it('places a live car from its last mini sector, held short of the next loop', () => {
		const starts = LAS_VEGAS.miniSectorStartsM;

		const model = estimateModel(
			session([lapOf('1', 1, 96, SECTORS)], 'race', {
				miniSectors: [
					{
						driverNumber: '1',
						lap: 2,
						index: 4,
						at: new Date(at(120)).toISOString(),
						ms: [],
						marks: [null, null, null, null, 'none'],
						lastMs: [3000, 3000, 3000, 3000, 3000, 4000],
						bestMs: []
					}
				]
			}),
			LAS_VEGAS,
			true
		);

		const fifthStart = starts[5] ?? 0;
		const sixthStart = starts[6] ?? 0;

		assert.equal(distance(estimateCar(model, '1', at(120))), fifthStart);
		assert.ok(
			Math.abs(distance(estimateCar(model, '1', at(122))) - (fifthStart + sixthStart) / 2) < 0.01
		);
		assert.ok(distance(estimateCar(model, '1', at(130))) < sixthStart);
	});

	it('takes a retired car off the circuit, and keeps practice cars in the garage between runs', () => {
		const retired = estimateModel(
			session([lapOf('1', 1, 96, SECTORS)], 'race', {
				retirements: [
					{ driverNumber: '1', lap: 2, reason: 'Retired', at: new Date(at(150)).toISOString() }
				]
			}),
			LAS_VEGAS,
			false
		);

		assert.equal(estimateCar(retired, '1', at(149)).place.kind, 'track');
		assert.equal(estimateCar(retired, '1', at(151)).place.kind, 'out');

		const practice = estimateModel(
			session(
				[lapOf('1', 1, 600, SECTORS), lapOf('1', 2, 700, SECTORS, { pitIn: true })],
				'practice'
			),
			LAS_VEGAS,
			false
		);

		assert.equal(estimateCar(practice, '1', at(300)).place.kind, 'garage');
		assert.equal(estimateCar(practice, '1', at(550)).place.kind, 'track');
		assert.equal(estimateCar(practice, '1', at(1000)).place.kind, 'garage');
	});
});
