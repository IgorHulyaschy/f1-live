import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { simulateLasVegas2025 } from '../data/mock/simulate-race.ts';
import { snapshotAtLap } from '../data/snapshot-at-lap.ts';
import { minuteTime, sessionClock, snapshotAtTime } from '../data/snapshot-at-time.ts';
import { classifyPasses, type StoryMark, storyMarks } from './race-story.ts';
import { fixtureSession } from './test-fixtures.ts';

const race = fixtureSession('9858');

/** Where and to whom a mark happened, whatever its words. */
function moment(mark: StoryMark): string {
	return `${mark.lane}/${mark.step}/${mark.driverNumber ?? ''}`;
}

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

	it('marks every minute a flag was out on the clock, not only the minute it came out', () => {
		const flags = lane(storyMarks(fixtureSession('9852')), 'flags');
		const red = flags.filter((mark) => mark.tone === 'red').map((mark) => mark.step);

		// The red flag of second practice ran from minute 39 to minute 42.
		assert.deepEqual(red.slice(0, 4), [39, 40, 41, 42]);
		// A yellow before the start, cleared before it, is not the first minute's flag.
		assert.equal(
			flags.some((mark) => mark.step === 1),
			false
		);
	});

	it('keeps a red flag on every minute while a replay sits in it', () => {
		const practice = fixtureSession('9852');
		const clock = sessionClock(practice);
		const flags = lane(storyMarks(snapshotAtTime(practice, minuteTime(clock, 42))), 'flags');

		assert.deepEqual(
			flags.filter((mark) => mark.tone === 'red').map((mark) => mark.step),
			[39, 40, 41, 42]
		);
	});

	it('keeps each mark’s id on the same moment as the replay moves on', () => {
		const atLap50 = new Map(storyMarks(race).map((mark) => [mark.id, moment(mark)]));

		// The fastest lap moves as faster ones come; everything else stays where it happened.
		assert.ok(
			storyMarks(snapshotAtLap(race, 20)).every(
				(mark) => mark.tone === 'fastest' || atLap50.get(mark.id) === moment(mark)
			)
		);
		assert.equal(atLap50.size, storyMarks(race).length);
	});

	it('works on the modelled race, which has no passes or radio', () => {
		const marks = storyMarks(simulateLasVegas2025());

		assert.equal(lane(marks, 'passes').length, 0);
		assert.ok(lane(marks, 'stops').length > 0);
		assert.ok(lane(marks, 'penalties').length > 0);
	});
});
