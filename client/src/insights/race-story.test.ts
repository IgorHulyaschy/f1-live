import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { simulateLasVegas2025 } from '../data/mock/simulate-race.ts';
import { snapshotAtLap } from '../data/snapshot-at-lap.ts';
import { classifyPasses, storyMarks } from './race-story.ts';
import { fixtureSession } from './test-fixtures.ts';

const race = fixtureSession('9858');

function lane(marks: ReturnType<typeof storyMarks>, name: string) {
	return marks.filter((mark) => mark.lane === name);
}

describe('storyMarks on the 2025 Las Vegas race', () => {
	const marks = storyMarks(race);

	it('has Verstappen leading from the first lap and never losing it', () => {
		// He passed Norris at the start and led every lap
		// (https://en.wikipedia.org/wiki/2025_Las_Vegas_Grand_Prix).
		assert.deepEqual(
			lane(marks, 'lead')
				.filter((mark) => mark.tone === 'lead')
				.map((mark) => [mark.step, mark.text]),
			[[1, 'VER leads']]
		);
		assert.deepEqual(
			lane(marks, 'lead')
				.filter((mark) => mark.tone === 'fastest')
				.map((mark) => [mark.step, mark.driverNumber]),
			[[50, '1']]
		);
	});

	it('marks the two virtual safety cars', () => {
		// "VIRTUAL SAFETY CAR DEPLOYED" on laps 2 and 16, "ENDING" on laps 4 and 16.
		const vsc = lane(marks, 'flags').filter((mark) => mark.tone === 'vsc');

		assert.ok([2, 3, 4, 16].every((lap) => vsc.some((mark) => mark.step === lap)));
	});

	it('has every official stop with the tyres fitted, and the cars that went out', () => {
		const stops = lane(marks, 'stops');

		assert.equal(stops.length, 23);
		assert.equal(
			stops.find((mark) => mark.driverNumber === '1')?.text,
			'VER stops for hards, 3.0 s still'
		);
		assert.deepEqual(
			lane(marks, 'out').map((mark) => [mark.step, mark.driverNumber]),
			[
				[1, '18'],
				[2, '5'],
				[35, '23'],
				[50, '4'],
				[50, '81']
			]
		);
	});

	it('names the penalties the stewards gave', () => {
		assert.deepEqual(
			lane(marks, 'penalties').map((mark) => mark.text),
			[
				'ANT 5 s penalty, false start - moving before signal',
				'ALB 5 s penalty, causing a collision',
				'ALB reprimand, starting procedure infringement'
			]
		);
	});

	it('leaves out team radio from before the start', () => {
		const start = Date.parse(race.startedAt ?? '');
		const clips = (race.teamRadio ?? []).filter((clip) => Date.parse(clip.at) >= start);

		assert.equal(lane(marks, 'radio').length, clips.length);
		assert.ok(clips.length < (race.teamRadio ?? []).length);
	});

	it('shows only what happened by the lap on screen', () => {
		const atLap10 = storyMarks(snapshotAtLap(race, 10));

		assert.ok(atLap10.every((mark) => mark.step <= 10));
		assert.equal(lane(atLap10, 'out').length, 2);
	});
});

describe('classifyPasses', () => {
	it('tells passes on track from cars going by a car in the pits', () => {
		const passes = classifyPasses(race);
		const onTrack = passes.filter((entry) => entry.onTrack);

		assert.equal(passes.length, (race.overtakes ?? []).length);
		assert.ok(onTrack.length < passes.length);
		// The feed credits a pass to every car that went by Russell while he stopped on lap 17.
		assert.ok(
			passes.some(
				(entry) => !entry.onTrack && entry.pass.lap === 17 && entry.pass.driverNumber !== '63'
			)
		);
	});

	it('names Verstappen’s pass on Norris at the start', () => {
		const pass = classifyPasses(race).find((entry) => entry.pass.driverNumber === '1');

		assert.deepEqual([pass?.pass.lap, pass?.onTrack, pass?.passed], [1, true, '4']);
	});
});

describe('storyMarks on practice and qualifying', () => {
	it('places a qualifying session by minute, with its deleted laps and best laps', () => {
		const marks = storyMarks(fixtureSession('9854'));

		assert.ok(lane(marks, 'passes').length === 0 && lane(marks, 'stops').length === 0);
		assert.ok(lane(marks, 'penalties').some((mark) => /lap deleted, track limits/.test(mark.text)));
		assert.ok(marks.every((mark) => mark.step >= 1 && mark.step <= 90));

		const best = lane(marks, 'lead').at(-1);

		// Norris took pole with 1:47.934
		// (https://www.formula1.com/en/results/2025/races/1274/las-vegas/qualifying).
		assert.equal(best?.text, 'NOR fastest lap, 107.934 s');
	});

	it('works on the modelled race, which has no passes or radio', () => {
		const marks = storyMarks(simulateLasVegas2025());

		assert.equal(lane(marks, 'passes').length, 0);
		assert.ok(lane(marks, 'stops').length > 0);
		assert.ok(lane(marks, 'penalties').length > 0);
	});
});
