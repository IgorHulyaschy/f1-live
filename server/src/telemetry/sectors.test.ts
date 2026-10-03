import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { placeSectors } from './sectors.js';
import type { TimedLap } from './sectors.js';
import { LENGTH_M, carOn, driveLaps, noise, stadiumOutline } from './test-circuit.js';
import type { SegmentCompletion } from './timing.js';

/** Sector 1 has two mini sectors, sector 2 three and sector 3 two. */
const SECTOR_ENDS = [1400, 2900] as const;

const MINI_STARTS = [0, 600, 1400, 1800, 2300, 2900, 3600] as const;

const COUNTS: [number, number, number] = [2, 3, 2];

const FEED_DELAY_MS = 250;

/** The segment (sector, then index in it) that ends at each mini sector start after the first. */
const SEGMENT_ENDING = [
	[0, 0],
	[0, 1],
	[1, 0],
	[1, 1],
	[1, 2],
	[2, 0]
] as const;

/** The moment the car had driven `distance`, between its samples. */
function timeAt(truth: Float64Array, at: Float64Array, distance: number): number {
	const next = truth.findIndex((value) => value >= distance);
	const before = Math.max(0, next - 1);

	const share =
		(distance - (truth[before] ?? 0)) / ((truth[next] ?? 1) - (truth[before] ?? 0)) || 0;

	return (at[before] ?? 0) + share * ((at[next] ?? 0) - (at[before] ?? 0));
}

function season() {
	const outline = stadiumOutline();
	const random = noise(5);
	const cars = new Map<string, ReturnType<typeof carOn>>();
	const laps: TimedLap[] = [];
	const completions: SegmentCompletion[] = [];

	['1', '4', '44'].forEach((driverNumber, index) => {
		const driven = driveLaps(
			Array.from({ length: 8 }, () => ({ lapSeconds: 80 + random() * 4, swing: 0.25 })),
			index * 2000,
			0.3,
			40 + index
		);

		cars.set(driverNumber, carOn(outline, driven));

		driven.crossings.slice(0, -1).forEach((startAt, lap) => {
			const endAt = driven.crossings[lap + 1] ?? 0;
			const first = timeAt(driven.truth, driven.track.at, lap * LENGTH_M + SECTOR_ENDS[0]);
			const second = timeAt(driven.truth, driven.track.at, lap * LENGTH_M + SECTOR_ENDS[1]);

			laps.push({
				driverNumber,
				startAt,
				endAt,
				sectorTimesMs: [first - startAt, second - first, endAt - second]
			});

			// Mini sector `k` ends where `k + 1` starts; the feed publishes the end a little late.
			MINI_STARTS.slice(1).forEach((start, offset) => {
				const [sector, segment] = SEGMENT_ENDING[offset] ?? [0, 0];

				completions.push({
					driverNumber,
					sector,
					segment,
					at: timeAt(driven.truth, driven.track.at, lap * LENGTH_M + start) + FEED_DELAY_MS
				});
			});
		});
	});

	return { cars, laps, completions };
}

describe('placeSectors', () => {
	const { cars, laps, completions } = season();

	it('puts the sector ends and the mini sector starts where the car was, within 10 m', () => {
		const placed = placeSectors(LENGTH_M, cars, laps, { perSector: COUNTS, completions });

		assert.equal(placed.miniSectors, 'timing');
		assert.deepEqual(placed.miniSectorsPerSector, COUNTS);
		assert.ok(Math.abs((placed.sectorBoundariesM[0] ?? 0) - SECTOR_ENDS[0]) < 10);
		assert.ok(Math.abs((placed.sectorBoundariesM[1] ?? 0) - SECTOR_ENDS[1]) < 10);

		MINI_STARTS.forEach((start, index) => {
			const found = placed.miniSectorStartsM[index] ?? Number.NaN;

			assert.ok(
				Math.abs(found - start) < 10,
				`mini sector ${index + 1} starts at ${found}, not ${start}`
			);
		});
	});

	it('cuts the mini sectors evenly inside each sector when the feed has no segments', () => {
		const placed = placeSectors(LENGTH_M, cars, laps, { perSector: [0, 0, 0], completions: [] });

		assert.equal(placed.miniSectors, 'even');
		assert.equal(placed.miniSectorStartsM.length, 3);
		assert.ok(Math.abs((placed.sectorBoundariesM[0] ?? 0) - SECTOR_ENDS[0]) < 10);
	});

	it('cuts evenly from the segment counts when no car left the segments', () => {
		const placed = placeSectors(LENGTH_M, cars, laps, { perSector: COUNTS, completions: [] });
		const starts = placed.miniSectorStartsM;

		assert.equal(placed.miniSectors, 'even');
		assert.equal(starts.length, 7);
		assert.ok(Math.abs((starts[1] ?? 0) - (placed.sectorBoundariesM[0] ?? 0) / 2) < 1e-6);
		assert.ok(
			Math.abs(
				(starts[3] ?? 0) -
					((placed.sectorBoundariesM[0] ?? 0) +
						((placed.sectorBoundariesM[1] ?? 0) - (placed.sectorBoundariesM[0] ?? 0)) / 3)
			) < 1e-6
		);
	});

	it('falls back to thirds without laps to measure sectors on', () => {
		const placed = placeSectors(LENGTH_M, cars, laps.slice(0, 2), {
			perSector: COUNTS,
			completions
		});

		assert.equal(placed.miniSectors, 'even');
		assert.ok(Math.abs((placed.sectorBoundariesM[0] ?? 0) - LENGTH_M / 3) < 1e-6);
		assert.equal(placed.miniSectorStartsM.length, 7);
	});
});
