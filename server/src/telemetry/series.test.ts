import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { carOn, driveLaps, stadiumOutline } from './test-circuit.js';
import {
	carDataTracks,
	distanceAlong,
	distanceAt,
	interpolate,
	lowerBound,
	nearest,
	positionTracks
} from './series.js';

const lap = { lapSeconds: 80, swing: 0.1 };

describe('positionTracks', () => {
	it('keeps one car per number, in time order, without the samples that have no fix', () => {
		const tracks = positionTracks([
			{
				at: 1000,
				cars: new Map([
					['1', { x: 0, y: 0, z: 0, status: 'OnTrack' }],
					['44', { x: 5, y: 6, z: 0, status: 'OnTrack' }]
				])
			},
			{
				at: 1250,
				cars: new Map([
					['1', { x: 10, y: 20, z: 0, status: 'OffTrack' }],
					['44', { x: 7, y: 8, z: 0, status: 'OnTrack' }]
				])
			},
			{ at: 1250, cars: new Map([['44', { x: 99, y: 99, z: 0, status: 'OnTrack' }]]) }
		]);

		assert.deepEqual([...tracks.keys()].toSorted(), ['1', '44']);
		assert.deepEqual([...(tracks.get('1')?.at ?? [])], [1250]);
		assert.deepEqual([...(tracks.get('1')?.offTrack ?? [])], [1]);
		assert.deepEqual([...(tracks.get('44')?.x ?? [])], [5, 7], 'an earlier sample is not replaced');
	});
});

describe('carDataTracks', () => {
	it('keeps no DRS column when any reading lacks the channel', () => {
		const reading = { rpm: 9000, speedKph: 200, gear: 5, throttle: 80, brake: false };

		const tracks = carDataTracks([
			{ at: 1, cars: new Map([['1', { ...reading, drsOpen: true }]]) },
			{ at: 2, cars: new Map([['1', { ...reading, drsOpen: null }]]) }
		]);

		assert.equal(tracks.get('1')?.drsOpen, null);
		assert.deepEqual([...(tracks.get('1')?.speedKph ?? [])], [200, 200]);
	});
});

describe('interpolate, nearest and lowerBound', () => {
	const times = [0, 100, 300];
	const values = [10, 20, 60];

	it('interpolates linearly and holds the ends', () => {
		assert.equal(interpolate(times, values, 50), 15);
		assert.equal(interpolate(times, values, 200), 40);
		assert.equal(interpolate(times, values, -5), 10);
		assert.equal(interpolate(times, values, 999), 60);
	});

	it('takes the nearest sample, the earlier one at a tie', () => {
		assert.equal(nearest(times, values, 40), 10);
		assert.equal(nearest(times, values, 60), 20);
		assert.equal(nearest(times, values, 200), 20);
		assert.equal(nearest(times, values, 201), 60);
	});

	it('finds the first sample at or after a time', () => {
		assert.equal(lowerBound(times, 100), 1);
		assert.equal(lowerBound(times, 101), 2);
		assert.equal(lowerBound(times, 301), 3);
	});
});

describe('distanceAlong', () => {
	const outline = stadiumOutline();
	const driven = driveLaps([lap, lap, lap], 0, 0.4, 7);
	const distances = distanceAlong(outline, driven.track);
	/** The first fix is just short of the line, which the outline starts at, so it reads a lap too far. */
	const origin = (distances[0] ?? 0) - (driven.truth[0] ?? 0);

	it('adds laps up, close to how far the car really drove', () => {
		const worst = Math.max(
			...distances.map((value, index) => Math.abs(value - origin - (driven.truth[index] ?? 0)))
		);

		assert.ok(worst < 6, `off by ${worst} m`);
		assert.ok(Math.abs((distances.at(-1) ?? 0) - origin - (driven.truth.at(-1) ?? 0)) < 6);
	});

	it('never goes back, however the fixes wobble', () => {
		for (let index = 1; index < distances.length; index += 1) {
			assert.ok((distances[index] ?? 0) >= (distances[index - 1] ?? 0));
		}
	});

	it('reads the distance at a time between samples', () => {
		const car = carOn(outline, driven);
		const middle = ((driven.track.at[10] ?? 0) + (driven.track.at[11] ?? 0)) / 2;
		const truth = ((driven.truth[10] ?? 0) + (driven.truth[11] ?? 0)) / 2;

		assert.ok(Math.abs(distanceAt(car, middle) - origin - truth) < 6);
	});

	it('finds its place again after a gap in the samples', () => {
		const track = {
			...driven.track,
			at: driven.track.at.map((time, index) => (index > 100 ? time + 20_000 : time))
		};

		const found = distanceAlong(outline, track);

		assert.ok(Math.abs((found[102] ?? 0) - origin - (driven.truth[102] ?? 0)) < 6);
	});
});
