import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { expandReplayCar } from '@f1-live/shared';

import {
	REPLAY_CHUNK_MS,
	REPLAY_QUANT_M,
	REPLAY_STEP_MS,
	buildReplay,
	replayManifest
} from './replay.js';
import type { PositionTrack } from './series.js';
import { driveLaps } from './test-circuit.js';

describe('buildReplay', () => {
	const origin = 1_763_870_000_000;
	const driven = driveLaps([{ lapSeconds: 60, swing: 0.1 }], origin, 0.3, 1);

	const late: PositionTrack = {
		at: Float64Array.from([origin + 61_000, origin + 61_250, origin + 61_500]),
		x: Float64Array.from([10, 12, 14]),
		y: Float64Array.from([-10, -10, -10]),
		offTrack: Uint8Array.from([1, 1, 0])
	};

	const tracks = new Map([
		['44', late],
		['1', driven.track]
	]);

	const replay = buildReplay(tracks);

	it('starts on the grid step before the first sample and covers the data in whole chunks', () => {
		assert.equal(replay.originAt, origin);
		assert.deepEqual(replay.driverNumbers, ['1', '44']);
		assert.equal(replay.chunks.length, 2);
		assert.deepEqual(
			replay.chunks.map(({ file, chunk }) => [file, chunk.t0, chunk.n]),
			[
				['0.json.gz', 0, REPLAY_CHUNK_MS / REPLAY_STEP_MS],
				['1.json.gz', REPLAY_CHUNK_MS, REPLAY_CHUNK_MS / REPLAY_STEP_MS]
			]
		);
	});

	it('stores each car a place and then changes, so a chunk reads on its own', () => {
		const second = replay.chunks[1]?.chunk.cars['1'];

		assert.ok(second !== undefined);

		const { x, y } = expandReplayCar(second, REPLAY_QUANT_M);
		const at = origin + REPLAY_CHUNK_MS;
		const index = driven.track.at.findIndex((time) => time >= at);

		assert.ok(Math.abs((x[0] ?? 0) - (driven.track.x[index] ?? 0)) < 2);
		assert.ok(Math.abs((y[0] ?? 0) - (driven.track.y[index] ?? 0)) < 2);
	});

	it('quantises positions to whole metres', () => {
		const first = replay.chunks[0]?.chunk.cars['1'];

		assert.ok(first !== undefined);
		assert.ok(first.x.every(Number.isInteger));
		assert.ok(first.y.every(Number.isInteger));
	});

	it('holds a car where its data begin before them, and marks when it is off the track', () => {
		const chunk = replay.chunks[1]?.chunk.cars['44'];

		assert.ok(chunk !== undefined);

		const { x } = expandReplayCar(chunk, REPLAY_QUANT_M);

		assert.equal(x[0], 10);
		assert.equal(x[6], 14);
		assert.deepEqual(chunk.off, [[0, 5]]);
		assert.equal(
			replay.chunks[0]?.chunk.cars['44']?.off?.length,
			1,
			'off from the start of the data to its end'
		);
	});

	it('makes a manifest that says where each chunk is', () => {
		const manifest = replayManifest(replay, [100, 200]);

		assert.equal(manifest.originAt, new Date(origin).toISOString());
		assert.deepEqual(
			manifest.chunks.map(({ file, bytes, t0 }) => [file, bytes, t0]),
			[
				['0.json.gz', 100, 0],
				['1.json.gz', 200, REPLAY_CHUNK_MS]
			]
		);
		assert.equal(manifest.stepMs, REPLAY_STEP_MS);
	});

	it('refuses to build from no positions', () => {
		assert.throws(() => buildReplay(new Map()), /no positions/);
	});
});
