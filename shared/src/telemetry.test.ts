import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	TELEMETRY_VERSION,
	alignLaps,
	expandReplayCar,
	miniSectorAt,
	miniSectorOfPoint,
	pointOnTrack,
	projectToTrack,
	sectorAt,
	sectorOfMiniSector,
	timeAtDistance,
	wrapDistance
} from './telemetry.ts';
import type { LapClock, Point, TrackOutline } from './telemetry.ts';

const POINTS = 1200;

const RADIUS_M = 1000;

/** A circle driven counter-clockwise from (R, 0), the length of its 1200-sided polygon. */
function circle(): TrackOutline {
	const points: Point[] = Array.from({ length: POINTS }, (_, index) => {
		const angle = (index / POINTS) * 2 * Math.PI;

		return [RADIUS_M * Math.cos(angle), RADIUS_M * Math.sin(angle)];
	});

	const lengthM = 2 * POINTS * RADIUS_M * Math.sin(Math.PI / POINTS);

	return {
		v: TELEMETRY_VERSION,
		circuitKey: 'test',
		name: 'Circle',
		lengthM,
		points,
		rotationDeg: 0,
		sectorBoundariesM: [lengthM / 3, (2 * lengthM) / 3],
		miniSectorsPerSector: [2, 2, 2],
		miniSectorStartsM: [0, 1, 2, 3, 4, 5].map((part) => (part * lengthM) / 6),
		pitLane: null,
		source: { sessionKey: 1, driverNumber: '1', lap: 1, lapTimeMs: 1, miniSectors: 'even' }
	};
}

describe('pointOnTrack', () => {
	it('starts on the line and interpolates between points', () => {
		const outline = circle();
		const step = outline.lengthM / POINTS;
		const start = pointOnTrack(outline, 0);
		const middle = pointOnTrack(outline, step / 2);

		assert.ok(Math.abs(start.x - RADIUS_M) < 1e-9);
		assert.ok(Math.abs(start.y) < 1e-9);
		assert.ok(Math.abs(start.headingRad - Math.PI / 2) < 0.01, 'travels counter-clockwise');
		assert.ok(Math.abs(middle.y - (outline.points[1]?.[1] ?? 0) / 2) < 1e-9);
	});

	it('wraps past the end of the lap and before the start', () => {
		const outline = circle();
		const start = pointOnTrack(outline, 0);
		const lapLater = pointOnTrack(outline, outline.lengthM);
		const before = pointOnTrack(outline, -outline.lengthM / 4);

		assert.ok(Math.abs(start.x - lapLater.x) < 1e-6);
		assert.ok(Math.abs(before.x) < 1, 'a quarter lap back is at the bottom, x near 0');
		assert.ok(before.y < 0);
		assert.equal(wrapDistance(outline, -1) > outline.lengthM - 2, true);
	});
});

describe('projectToTrack', () => {
	it('puts a car beside the line at its distance, offset by how far it is from it', () => {
		const outline = circle();
		const quarter = outline.lengthM / 4;
		const found = projectToTrack(outline, 0, RADIUS_M + 7);

		assert.ok(Math.abs(found.distanceM - quarter) < 0.5);
		assert.ok(Math.abs(found.offsetM - 7) < 0.1);
	});

	it('searches near the hint, and again everywhere when nothing there is close', () => {
		const outline = circle();
		const half = outline.lengthM / 2;
		const atHalf = projectToTrack(outline, -RADIUS_M, 0);

		assert.ok(Math.abs(projectToTrack(outline, -RADIUS_M, 0, half - 30).distanceM - half) < 0.5);
		assert.ok(
			Math.abs(projectToTrack(outline, -RADIUS_M, 0, 0).distanceM - atHalf.distanceM) < 1e-9
		);
	});

	it('wraps near the line: a point just before it is at the end of the lap', () => {
		const outline = circle();
		const found = projectToTrack(outline, RADIUS_M, -3);

		assert.ok(found.distanceM > outline.lengthM - 5);
	});
});

describe('mini sectors', () => {
	it('maps a distance to its mini sector, wrapping and including the first', () => {
		const outline = circle();
		const part = outline.lengthM / 6;

		assert.equal(miniSectorAt(outline, 0), 0);
		assert.equal(miniSectorAt(outline, part - 0.01), 0);
		assert.equal(miniSectorAt(outline, part), 1);
		assert.equal(miniSectorAt(outline, 5.5 * part), 5);
		assert.equal(miniSectorAt(outline, outline.lengthM + 0.5 * part), 0);
		assert.equal(miniSectorAt(outline, -0.5 * part), 5);
	});

	it('maps a point on the circuit to its mini sector', () => {
		const outline = circle();

		assert.equal(miniSectorOfPoint(outline, 0, RADIUS_M), 1);
		assert.equal(miniSectorOfPoint(outline, -RADIUS_M, 5, 2000), 2);
		assert.equal(miniSectorOfPoint(outline, 0, -RADIUS_M), 4);
	});

	it('knows the sector of a distance and of a mini sector', () => {
		const outline = circle();
		const third = outline.lengthM / 3;

		assert.deepEqual(
			[0, third - 1, third, 2 * third - 1, 2 * third, outline.lengthM - 1].map((distance) =>
				sectorAt(outline, distance)
			),
			[0, 0, 1, 1, 2, 2]
		);
		assert.deepEqual(
			[0, 1, 2, 3, 4, 5].map((mini) => sectorOfMiniSector(outline, mini)),
			[0, 0, 1, 1, 2, 2]
		);
	});
});

/** A lap whose speed, in m/s, is `speed(distance)`, sampled every 10 m. */
function clock(length: number, speed: (distance: number) => number): LapClock {
	const distanceM: number[] = [];
	const timeMs: number[] = [];
	let time = 0;

	for (let distance = 0; distance <= length; distance += 10) {
		distanceM.push(distance);
		timeMs.push(time);
		time += (10 / speed(distance)) * 1000;
	}

	return { distanceM, timeMs };
}

describe('timeAtDistance', () => {
	it('interpolates between samples and clamps before the first', () => {
		const lap: LapClock = { distanceM: [0, 100, 200], timeMs: [0, 4000, 6000] };

		assert.equal(timeAtDistance(lap, 50), 2000);
		assert.equal(timeAtDistance(lap, 150), 5000);
		assert.equal(timeAtDistance(lap, 200), 6000);
		assert.equal(timeAtDistance(lap, -5), 0);
	});

	it('does not divide by zero when the car stood still', () => {
		const lap: LapClock = { distanceM: [0, 100, 100, 200], timeMs: [0, 4000, 5000, 7000] };

		assert.ok(Number.isFinite(timeAtDistance(lap, 100)));
		assert.ok(Number.isFinite(timeAtDistance(lap, 150)));
	});

	it('rejects a lap without samples', () => {
		assert.throws(() => timeAtDistance({ distanceM: [], timeMs: [] }, 1), /no samples/);
	});
});

describe('alignLaps', () => {
	it('is zero against itself', () => {
		const lap = clock(1000, () => 50);
		const { deltaMs } = alignLaps(lap, lap, 25);

		assert.ok(deltaMs.every((delta) => delta === 0));
	});

	it('shows where a slower stretch costs time and keeps what was lost afterwards', () => {
		const reference = clock(1000, () => 50);
		// Slower by 10 m/s between 400 m and 600 m: 200 m at 40 m/s takes 5 s instead of 4 s.
		const other = clock(1000, (distance) => (distance >= 400 && distance < 600 ? 40 : 50));
		const delta = alignLaps(reference, other, 100);

		assert.deepEqual(delta.distanceM.slice(0, 3), [0, 100, 200]);
		assert.ok(Math.abs((delta.deltaMs[4] ?? 1) - 0) < 1, 'level at 400 m');
		assert.ok(Math.abs((delta.deltaMs[6] ?? 0) - 1000) < 1, 'a second behind at 600 m');
		assert.ok(Math.abs((delta.deltaMs.at(-1) ?? 0) - 1000) < 1, 'still a second behind');
	});

	it('compares only the distance both laps cover, and rejects a step that is not positive', () => {
		const reference = clock(1000, () => 50);
		const other = clock(900, () => 50);
		const delta = alignLaps(reference, other, 50);

		assert.equal(delta.distanceM.at(-1), 900);
		assert.throws(() => alignLaps(reference, other, 0), /positive/);
	});
});

describe('expandReplayCar', () => {
	it('adds the deltas up and scales them to metres', () => {
		assert.deepEqual(expandReplayCar({ x: [10, 2, -3], y: [-4, 0, 5] }, 0.5), {
			x: [5, 6, 4.5],
			y: [-2, -2, 0.5]
		});
	});
});
