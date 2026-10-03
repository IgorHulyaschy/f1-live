import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import type { ReplayChunk, ReplayManifest } from '@f1-live/shared';

import { LivePositionBuffer } from './live-positions.ts';
import { type CarSample, expandChunk, ReplayPositions } from './replay-positions.ts';

const ORIGIN = Date.UTC(2025, 10, 23, 4, 0, 0);

/** Two chunks of four samples a second apart; car 1 drives along x at 10 m a step. */
const MANIFEST: ReplayManifest = {
	v: 1,
	originAt: new Date(ORIGIN).toISOString(),
	stepMs: 1000,
	chunkMs: 4000,
	quantM: 1,
	driverNumbers: ['1', '44'],
	chunks: [
		{ file: '0.json.gz', t0: 0, n: 4, bytes: 0 },
		{ file: '1.json.gz', t0: 4000, n: 4, bytes: 0 }
	]
};

const CHUNKS = {
	'0.json.gz': {
		v: 1,
		t0: 0,
		stepMs: 1000,
		n: 4,
		quantM: 1,
		cars: {
			'1': { x: [100, 10, 10, 10], y: [5, 0, 0, 0] },
			'44': { x: [0, 0], y: [0, 0], off: [[0, 1]] }
		}
	},
	'1.json.gz': {
		v: 1,
		t0: 4000,
		stepMs: 1000,
		n: 4,
		quantM: 1,
		cars: { '1': { x: [140, 10, 10, 10], y: [5, 0, 0, 0] } }
	}
} satisfies Record<string, ReplayChunk>;

async function loaded(): Promise<ReplayPositions> {
	const chunks: ReadonlyMap<string, ReplayChunk> = new Map(Object.entries(CHUNKS));

	const replay = new ReplayPositions(MANIFEST, async (ref) => {
		const chunk = chunks.get(ref.file);

		if (!chunk) {
			throw new Error(ref.file);
		}

		return chunk;
	});

	const both = new Promise<void>((resolve) => {
		let pending = 2;

		replay.subscribe(() => {
			pending--;

			if (pending === 0) {
				resolve();
			}
		});
	});

	replay.want(ORIGIN, 1);
	await both;

	return replay;
}

describe('replay positions', () => {
	it('turns deltas in quanta into metres and marks the samples a car was off the track', () => {
		const chunk = expandChunk(CHUNKS['0.json.gz']);

		assert.deepEqual([...(chunk.cars.get('1')?.x ?? [])], [100, 110, 120, 130]);
		assert.deepEqual([...(chunk.cars.get('44')?.off ?? [])], [1, 1, 0, 0]);
	});

	it('meets every sample and runs smoothly between them, across chunks too', async () => {
		const replay = await loaded();

		assert.deepEqual(replay.sampleCar('1', ORIGIN + 2000), { x: 120, y: 5, offTrack: false });
		// A car moving evenly stays even on the curve between samples.
		assert.equal(replay.sampleCar('1', ORIGIN + 2500)?.x, 125);
		assert.equal(replay.sampleCar('1', ORIGIN + 3500)?.x, 135);
		assert.equal(replay.sampleCar('1', ORIGIN + 4250)?.x, 142.5);
	});

	it('holds a car whose column stops short, and has nothing for a moment not loaded', async () => {
		const replay = await loaded();
		const places = new Map<string, CarSample>();

		assert.equal(replay.sampleCar('44', ORIGIN + 3000)?.x, 0);
		assert.equal(replay.sample(ORIGIN + 60_000, places), false);
		assert.equal(replay.sample(ORIGIN + 1000, places), true);
		assert.deepEqual([...places.keys()], ['1', '44']);
	});

	it('asks for a chunk that failed again only after a while, not in a loop', async () => {
		mock.timers.enable({ apis: ['Date'], now: ORIGIN });

		try {
			let asked = 0;

			const replay = new ReplayPositions(MANIFEST, async () => {
				asked++;

				throw new Error('offline');
			});

			const failed = () =>
				new Promise<void>((resolve) => {
					const stop = replay.subscribe(() => {
						stop();
						resolve();
					});
				});

			const first = failed();

			replay.want(ORIGIN, 0);
			await first;
			replay.want(ORIGIN, 0);
			replay.want(ORIGIN, 0);
			assert.equal(asked, 1);
			assert.equal(replay.missing(ORIGIN), true);

			const second = failed();

			mock.timers.tick(30_000);
			replay.want(ORIGIN, 0);
			await second;
			assert.equal(asked, 2);
		} finally {
			mock.timers.reset();
		}
	});
});

describe('live positions', () => {
	it('glides between frames, keeps cars a frame left out in their last place, and knows nothing before', () => {
		const buffer = new LivePositionBuffer(10_000);
		const places = new Map<string, CarSample>();

		buffer.push({ at: 1000, cars: { '1': [0, 0, 1], '44': [50, 50, 0] } }, 0);
		buffer.push({ at: 1250, cars: { '1': [20, 0, 1] } }, 250);

		assert.equal(buffer.sample(1125, places), true);
		assert.deepEqual(places.get('1'), { x: 10, y: 0, offTrack: false });
		assert.deepEqual(places.get('44'), { x: 50, y: 50, offTrack: true });
		assert.equal(buffer.feedTime(500), 1500);
		assert.equal(buffer.sample(900, places), false, 'nothing is known before the first frame');

		// After a reconnect the frames either side of a gap are not joined across it.
		buffer.push({ at: 9000, cars: { '1': [400, 0, 1] } }, 8250);
		assert.equal(buffer.sample(5000, places), false);
	});
});
