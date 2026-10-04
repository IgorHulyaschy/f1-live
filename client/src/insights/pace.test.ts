import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { average, isCleanLap, median } from './clean-laps.ts';
import {
	compoundsRun,
	createPace,
	paceSpans,
	paceSpanText,
	paceVersus,
	racePace,
	stintPairs,
	teammateGaps
} from './pace.ts';
import { fixtureSession } from './test-fixtures.ts';
import { compoundShifter, stintPaces, type StintPace } from './tyre-pace.ts';

const race = fixtureSession('11731');

function numberOf(code: string): string {
	return race.drivers.find((driver) => driver.code === code)?.number ?? '';
}

const STINT_2 = { span: { kind: 'stint', stint: 2 }, compound: null } as const;

describe('racePace', () => {
	const ranking = racePace(race);

	it('ranks the quickest first at zero and every other behind it', () => {
		assert.equal(ranking[0]?.deltaToBestSeconds, 0);
		assert.ok(ranking.every((entry, index) => index === 0 || entry.deltaToBestSeconds >= 0));
		assert.ok(ranking.length >= 18);
	});

	it('counts only clean laps, and leaves the wet-tyre laps of the opening out', () => {
		for (const entry of ranking) {
			assert.ok(entry.laps.every(isCleanLap), entry.driver.code);
			assert.ok(
				entry.laps.every((lap) => lap.compound !== 'INTERMEDIATE'),
				entry.driver.code
			);
		}
	});

	it('filters by compound: every lap used is on it', () => {
		const softs = racePace(race, { span: { kind: 'race' }, compound: 'SOFT' });

		assert.ok(softs.length >= 15);
		assert.ok(softs.every((entry) => entry.laps.every((lap) => lap.compound === 'SOFT')));
		assert.ok(softs.every((entry) => entry.compounds.join() === 'SOFT'));
	});

	it('limits the last 10 laps to laps 46 to 55', () => {
		const last = racePace(race, { span: { kind: 'last', laps: 10 }, compound: null });

		assert.ok(last.length >= 10);
		assert.ok(last.every((entry) => entry.laps.every((lap) => lap.lap > 45)));
	});

	it('limits a stint to the laps of that stint, which differ by driver', () => {
		const second = racePace(race, STINT_2);

		const driverStints = (code: string) =>
			race.stints.find((stint) => stint.driverNumber === numberOf(code) && stint.stint === 2);

		for (const code of ['VER', 'NOR']) {
			const entry = second.find((item) => item.driver.code === code);
			const stint = driverStints(code);

			assert.ok(entry && stint);
			assert.ok(entry.laps.every((lap) => lap.lap >= stint.startLap && lap.lap <= stint.endLap));
		}
	});
});

describe('paceVersus', () => {
	const pair = paceVersus(race, numberOf('VER'), numberOf('NOR'), STINT_2);

	// The like-for-like gap by hand: the laps both drove clean in their own stint 2, raw times.
	function byHand(code: string): Map<number, number> {
		const stint = race.stints.find(
			(item) => item.driverNumber === numberOf(code) && item.stint === 2
		);

		return new Map(
			race.laps
				.filter(
					(lap) =>
						lap.driverNumber === numberOf(code) &&
						lap.lap >= (stint?.startLap ?? 0) &&
						lap.lap <= (stint?.endLap ?? 0) &&
						lap.lapTimeMs > 0 &&
						lap.trackStatus === 'green' &&
						lap.lap > 1 &&
						!lap.pitIn &&
						!lap.pitOut
				)
				.map((lap) => [lap.lap, lap.lapTimeMs / 1000])
		);
	}

	it('says VER was quicker than NOR in stint 2, on the laps both drove clean first', () => {
		const ver = byHand('VER');
		const nor = byHand('NOR');

		const shared = [...ver.entries()].flatMap(([lap, time]) => {
			const other = nor.get(lap);

			return other === undefined ? [] : [{ lap, time, other }];
		});

		assert.ok(pair?.faster);
		assert.equal(pair.faster.code, 'VER');
		assert.ok(pair.sameLaps);
		assert.equal(pair.sameLaps.laps, shared.length);

		const raw = median(shared.map(({ time, other }) => time - other)) ?? NaN;

		assert.ok(Math.abs(pair.sameLaps.gainSeconds - raw) < 1e-9);

		// Both corrected to the mean tyre age of the shared laps with the field's slope for the
		// compound, the same for both drivers: only the compound offset and the slope difference over
		// the age spread are left. Fuel cancels on the same lap.
		const fits = stintPaces(race);
		const { shift } = compoundShifter(fits);

		const slope = (compound: 'SOFT' | 'HARD') =>
			median(
				fits.filter((fit) => fit.compound === compound).map((fit) => fit.degradationSecondsPerLap)
			) ?? NaN;

		const age = (code: string, lap: number) =>
			race.laps.find((item) => item.driverNumber === numberOf(code) && item.lap === lap)?.tyreAge ??
			NaN;

		const meanAge = average(shared.flatMap(({ lap }) => [age('VER', lap), age('NOR', lap)])) ?? NaN;

		const corrected =
			median(
				shared.map(
					({ lap, time, other }) =>
						time -
						slope('SOFT') * (age('VER', lap) - meanAge) -
						shift('SOFT') -
						(other - slope('HARD') * (age('NOR', lap) - meanAge) - shift('HARD'))
				)
			) ?? NaN;

		assert.ok(pair.gainSeconds !== null);
		assert.ok(Math.abs(pair.gainSeconds - corrected) < 1e-9);
		assert.equal(
			pair.text,
			`VER was 1.67 s a lap quicker than NOR in stint 2 on the 17 laps both drove clean; allowing for VER's Soft against NOR's Hard, ${Math.abs(corrected).toFixed(2)} s.`
		);
	});

	it('names the laps it used, all inside each driver’s stint 2', () => {
		assert.ok(pair?.first && pair.second);
		assert.equal(pair.first.laps.length, 17);
		assert.equal(pair.second.laps.length, 18);
	});

	it('keeps the uncorrected pace on the shared laps as a check, with the same winner', () => {
		assert.ok(pair?.sameLaps);
		assert.equal(pair.sameLaps.laps, 17);
		assert.ok(pair.sameLaps.gainSeconds < 0, 'NOR was slower on the laps both drove clean');
	});

	it('reads the same whichever driver is first, with the sign turned', () => {
		const back = paceVersus(race, numberOf('NOR'), numberOf('VER'), STINT_2);

		assert.ok(pair?.gainSeconds !== null && back?.gainSeconds !== null);
		assert.ok(pair?.gainSeconds !== undefined && back?.gainSeconds !== undefined);
		assert.ok(Math.abs(pair.gainSeconds + back.gainSeconds) < 1e-9);
		assert.equal(back.faster?.code, 'VER');
	});

	it('says so when a driver has too few clean laps', () => {
		const stopped = paceVersus(race, numberOf('BOT'), numberOf('VER'), STINT_2);

		assert.equal(stopped?.gainSeconds, null);
		assert.equal(stopped?.text, 'Too few clean laps for BOT in stint 2 to compare pace.');
	});

	it('is null for the same driver twice or an unknown one', () => {
		assert.equal(paceVersus(race, numberOf('VER'), numberOf('VER')), null);
		assert.equal(paceVersus(race, numberOf('VER'), 'x'), null);
	});
});

describe('stints, teams and spans', () => {
	it('pairs the stints both drivers ran', () => {
		const pairs = stintPairs(race, numberOf('VER'), numberOf('NOR'));
		const second = pairs.find((item) => item.stint === 2);

		assert.ok(second?.first && second.second);
	});

	it('gaps each team’s two drivers by corrected pace, biggest first', () => {
		const gaps = teammateGaps(race);
		const mercedes = gaps.find((gap) => gap.team === 'Mercedes');

		assert.ok(
			gaps.every(
				(gap, index) => index === 0 || gap.gapSeconds <= (gaps[index - 1]?.gapSeconds ?? 0)
			)
		);
		assert.ok(mercedes);
		assert.equal(mercedes.quicker.driver.code, 'ANT');
		assert.equal(
			mercedes.gapSeconds,
			-(
				paceVersus(race, mercedes.quicker.driver.number, mercedes.slower.driver.number)
					?.gainSeconds ?? NaN
			)
		);
	});

	it('offers the race, each stint number, and the last 10 laps', () => {
		const spans = paceSpans(race);

		assert.deepEqual(spans.at(0), { kind: 'race' });
		assert.deepEqual(spans.at(-1), { kind: 'last', laps: 10 });
		assert.ok(spans.some((span) => span.kind === 'stint' && span.stint === 2));
	});

	it('lists the compounds run, softest first', () => {
		assert.deepEqual(compoundsRun(race).slice(0, 3), ['SOFT', 'MEDIUM', 'HARD']);
	});

	it('words a span', () => {
		assert.equal(paceSpanText({ span: { kind: 'race' }, compound: null }), 'over the race');
		assert.equal(
			paceSpanText({ span: { kind: 'last', laps: 10 }, compound: 'MEDIUM' }),
			'over the last 10 laps on Medium tyres'
		);
	});
});

describe('one comparison, one slope', () => {
	const vegas = fixtureSession('9858');

	const number = (code: string) =>
		vegas.drivers.find((driver) => driver.code === code)?.number ?? '';

	it('on the same tyres allows for tyre age only, and stays on the like-for-like side', () => {
		const verdict = paceVersus(vegas, number('VER'), number('NOR'), STINT_2);

		assert.equal(
			verdict?.text,
			'VER was 0.14 s a lap quicker than NOR in stint 2 on the 24 laps both drove clean; allowing for tyre age (both on Hard), 0.12 s.'
		);
		assert.equal(verdict?.faster?.code, 'VER');
	});

	it('says which driver is quicker once allowed for when it differs from the shared laps', () => {
		// NOR's laps carry 30 more laps of tyre age: with the same slope for both, that is a real
		// allowance in his favour.
		const older = {
			...vegas,
			laps: vegas.laps.map((lap) =>
				lap.driverNumber === number('NOR') ? { ...lap, tyreAge: lap.tyreAge + 30 } : lap
			)
		};

		const verdict = paceVersus(older, number('VER'), number('NOR'), STINT_2);

		assert.ok(verdict);
		assert.match(
			verdict.text,
			/allowing for tyre age \(both on Hard\), NOR was \d\.\d\d s quicker\./
		);
		assert.equal(verdict.faster?.code, 'VER');
	});
});

const stint = (compound: StintPace['compound'], pace: number, count = 1): StintPace[] =>
	Array.from({ length: count }, (_, index) => ({
		driverNumber: String(index),
		stint: 1,
		compound,
		cleanLaps: 10,
		degradationSecondsPerLap: 0,
		newTyrePaceSeconds: pace
	}));

describe('compound shift', () => {
	it('applies the offsets when soft is not slower than medium, nor medium than hard', () => {
		const { shift, applied } = compoundShifter([
			...stint('SOFT', 99, 2),
			...stint('MEDIUM', 99.5, 2),
			...stint('HARD', 100, 2)
		]);

		assert.equal(applied, true);
		assert.equal(shift('SOFT'), -1);
		assert.equal(shift('MEDIUM'), -0.5);
		assert.equal(shift('HARD'), 0);
	});

	it('applies nothing when the fit puts the soft slower than the hard', () => {
		const { shift, applied } = compoundShifter([
			...stint('SOFT', 101, 2),
			...stint('HARD', 100, 2)
		]);

		assert.equal(applied, false);
		assert.equal(shift('SOFT'), 0);
		assert.equal(shift('HARD'), 0);
	});

	it('applies nothing when a compound rests on one stint', () => {
		const { applied } = compoundShifter([...stint('SOFT', 99, 1), ...stint('HARD', 100, 3)]);

		assert.equal(applied, false);
	});

	it('keeps the physical order on 11731, so the soft is shifted towards the hard, not away', () => {
		const pace = createPace(race);

		assert.equal(pace.compoundsEvened, true);
	});

	it('says the two ran different tyres when the fit is out of order', () => {
		const slowSofts = {
			...race,
			laps: race.laps.map((lap) =>
				lap.compound === 'SOFT' ? { ...lap, lapTimeMs: lap.lapTimeMs + 3000 } : lap
			)
		};

		const verdict = paceVersus(slowSofts, numberOf('VER'), numberOf('NOR'), STINT_2);

		assert.ok(verdict);
		assert.match(verdict.text, /allowing for tyre age but not for VER's Soft against NOR's Hard/);
	});
});
