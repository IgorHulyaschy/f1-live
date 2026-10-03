import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	EMPTY_SNAPSHOT,
	type Lap,
	type RaceSnapshot,
	type Stint,
	type TyreCompound
} from '@f1-live/shared';

import { FUEL_EFFECT_SECONDS_PER_LAP } from './clean-laps.ts';
import { fixtureSession } from './test-fixtures.ts';
import {
	type CompoundLife,
	crossoversOf,
	findCliff,
	fuelCorrectedLapSeconds,
	lossAt,
	tyreLife
} from './tyre-life.ts';

type Plan = { driverNumber: string; compound: TyreCompound; startLap: number; laps: number };

/**
 * A race where every car's lap is 90 s, plus its compound's pace when new and wear per lap of
 * age, minus the fuel burnt so far.
 */
function race(
	plans: readonly Plan[],
	pace: Record<string, { newS: number; wearS: number }>
): RaceSnapshot {
	const laps: Lap[] = [];
	const stints: Stint[] = [];

	for (const [index, plan] of plans.entries()) {
		stints.push({
			driverNumber: plan.driverNumber,
			stint: index + 1,
			compound: plan.compound,
			startLap: plan.startLap,
			endLap: plan.startLap + plan.laps - 1
		});

		for (let age = 1; age <= plan.laps; age++) {
			const lapNumber = plan.startLap + age - 1;
			const { newS, wearS } = pace[plan.compound] ?? { newS: 0, wearS: 0 };
			const seconds = 90 + newS + wearS * age - FUEL_EFFECT_SECONDS_PER_LAP * lapNumber;

			laps.push({
				driverNumber: plan.driverNumber,
				lap: lapNumber,
				lapTimeMs: Math.round(seconds * 1000),
				sectorTimesMs: [30_000, 30_000, 30_000],
				position: 1,
				gapToLeaderMs: 0,
				intervalMs: 0,
				compound: plan.compound,
				tyreAge: age,
				pitIn: false,
				pitOut: false,
				trackStatus: 'green'
			});
		}
	}

	return {
		...EMPTY_SNAPSHOT,
		currentLap: 40,
		session: { ...EMPTY_SNAPSHOT.session, totalLaps: 40 },
		laps,
		stints
	};
}

const ONE_STOP = ['1', '2', '3'].flatMap((driverNumber): Plan[] => [
	{ driverNumber, compound: 'MEDIUM', startLap: 2, laps: 18 },
	{ driverNumber, compound: 'HARD', startLap: 20, laps: 20 }
]);

describe('fuelCorrectedLapSeconds', () => {
	it('adds back the fuel burnt by each lap', () => {
		assert.equal(
			fuelCorrectedLapSeconds({ lap: 10, lapTimeMs: 90_000 }),
			90 + 10 * FUEL_EFFECT_SECONDS_PER_LAP
		);
	});
});

describe('tyreLife', () => {
	const life = tyreLife(
		race(ONE_STOP, { MEDIUM: { newS: 0, wearS: 0.08 }, HARD: { newS: 0.6, wearS: 0.03 } })
	);

	const medium = life.compounds.find((entry) => entry.compound === 'MEDIUM');
	const hard = life.compounds.find((entry) => entry.compound === 'HARD');

	it('recovers each compound’s wear and pace when new, with the fuel taken out', () => {
		assert.ok(medium && hard);
		assert.ok(Math.abs(medium.wearSecondsPerLap - 0.08) < 0.002);
		assert.ok(Math.abs(hard.wearSecondsPerLap - 0.03) < 0.002);
		assert.ok(Math.abs(hard.newOffsetS - 0.6) < 0.01);
		assert.equal(medium.newOffsetS, 0);
		assert.equal(life.comparable, true);
	});

	it('finds the age a new hard beats the old medium', () => {
		// 0.6 s head start at 0.08 s a lap is gone after 7.5 laps.
		assert.deepEqual(life.crossovers, [{ from: 'MEDIUM', to: 'HARD', age: 8 }]);
	});

	it('gives practice runs their wear but no pace when new, since fuel loads differ', () => {
		const practice = race(ONE_STOP, {
			MEDIUM: { newS: 0, wearS: 0.08 },
			HARD: { newS: 0.6, wearS: 0.03 }
		});

		const result = tyreLife({ ...practice, session: { ...practice.session, type: 'practice' } });

		assert.equal(result.comparable, false);
		assert.deepEqual(result.crossovers, []);
		assert.ok(result.compounds.every((entry) => entry.newOffsetS === 0));
	});

	it('has nothing to say about qualifying', () => {
		const quali = race(ONE_STOP, {});

		assert.deepEqual(
			tyreLife({ ...quali, session: { ...quali.session, type: 'qualifying' } }).compounds,
			[]
		);
	});

	it('on the 2025 Las Vegas race finds the hard quicker than the medium from new', () => {
		// Pirelli: the top eight finished on hards; mediums for most of the field at the start
		// (https://press.pirelli.com/verstappen-keeps-the-championship-alive/).
		const real = tyreLife(fixtureSession('9858'));
		const realMedium = real.compounds.find((entry) => entry.compound === 'MEDIUM');
		const realHard = real.compounds.find((entry) => entry.compound === 'HARD');

		assert.ok(realMedium && realHard);
		assert.ok(realHard.runs > realMedium.runs);
		assert.equal(realHard.newOffsetS, 0);
		assert.ok(realMedium.newOffsetS > 0);
		assert.ok(realMedium.wearSecondsPerLap > 0 && realMedium.wearSecondsPerLap < 0.05);
		assert.equal(realHard.cliff, null);
	});
});

/** Loss growing by `before` a lap up to age `at`, by `after` beyond it. */
function curve(ages: number, at: number, before: number, after: number) {
	return Array.from({ length: ages }, (_, index) => {
		const age = index + 1;

		return { age, deltaS: age <= at ? before * age : before * at + after * (age - at), runs: 4 };
	});
}

function compound(
	name: TyreCompound,
	newOffsetS: number,
	wearSecondsPerLap: number,
	lastAge: number
): CompoundLife {
	return {
		compound: name,
		newOffsetS,
		wearSecondsPerLap,
		cliff: null,
		points: [{ age: lastAge, deltaS: 0, runs: 2 }],
		runs: 3,
		laps: 30
	};
}

describe('findCliff', () => {
	it('finds where the loss steepens', () => {
		assert.deepEqual(findCliff(curve(24, 16, 0.04, 0.35)), { age: 16, wearSecondsPerLap: 0.35 });
	});

	it('does not invent one on a steady curve', () => {
		assert.equal(findCliff(curve(24, 24, 0.05, 0.05)), null);
	});
});

describe('crossoversOf', () => {
	it('only reports an age the softer tyre has run', () => {
		assert.deepEqual(
			crossoversOf([compound('SOFT', 0, 0.1, 5), compound('HARD', 1, 0.02, 30)]),
			[]
		);
		assert.deepEqual(crossoversOf([compound('SOFT', 0, 0.1, 12), compound('HARD', 1, 0.02, 30)]), [
			{ from: 'SOFT', to: 'HARD', age: 10 }
		]);
	});

	it('counts the cliff in the loss', () => {
		const soft = { ...compound('SOFT', 0, 0.05, 20), cliff: { age: 4, wearSecondsPerLap: 0.3 } };

		assert.ok(Math.abs(lossAt(soft, 6) - (0.2 + 0.6)) < 1e-9);
		assert.deepEqual(crossoversOf([soft, compound('HARD', 1, 0.02, 30)]), [
			{ from: 'SOFT', to: 'HARD', age: 7 }
		]);
	});
});
