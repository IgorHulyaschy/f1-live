import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TopicFrame } from '../sources/f1/decode.js';
import type { JsonObject } from '../sources/f1/live.js';
import { readSegments } from './timing.js';

function frame(timestamp: number, lines: JsonObject): TopicFrame {
	return { topic: 'TimingData', data: { Lines: lines }, timestamp };
}

const blank = (count: number) => Array.from({ length: count }, () => ({ Status: 0 }));

describe('readSegments', () => {
	const frames = [
		frame(1000, {
			'1': {
				Sectors: [{ Segments: blank(2) }, { Segments: blank(3) }, { Segments: blank(2) }]
			}
		}),
		frame(5000, { '1': { Sectors: { '0': { Segments: { '1': { Status: 2048 } } } } } }),
		frame(9000, { '1': { Sectors: { '1': { Segments: { '0': { Status: 2049 } } } } } }),
		// A beaten time recolours the segment; the car does not leave it again.
		frame(9500, { '1': { Sectors: { '1': { Segments: { '0': { Status: 2051 } } } } } }),
		// The next lap: the feed clears the second segment as the car leaves the first.
		frame(20_000, {
			'1': { Sectors: { '0': { Segments: { '1': { Status: 0 } } } } }
		}),
		frame(24_000, { '1': { Sectors: { '0': { Segments: { '1': { Status: 2048 } } } } } })
	];

	const { perSector, completions } = readSegments(frames);

	it('counts the segments of each sector', () => {
		assert.deepEqual(perSector, [2, 3, 2]);
	});

	it('records each time a car left a segment, once for each time the lap cleared it', () => {
		assert.deepEqual(
			completions.map(({ sector, segment, at }) => [sector, segment, at]),
			[
				[0, 1, 5000],
				[1, 0, 9000],
				[0, 0, 20_000],
				[0, 1, 24_000]
			]
		);
		assert.ok(completions.every(({ driverNumber }) => driverNumber === '1'));
	});

	it('leaves out frames of other topics and frames in another format', () => {
		const result = readSegments([
			{ topic: 'Heartbeat', data: { Utc: 'x' }, timestamp: 1 },
			{ topic: 'TimingData', data: { Lines: { '1': { Sectors: 'broken' } } }, timestamp: 2 },
			frame(3, { '1': { Sectors: { '2': { Segments: { '4': { Status: 2048 } } } } } })
		]);

		assert.deepEqual(result.perSector, [0, 0, 5]);
		assert.equal(result.completions.length, 1);
	});
});
