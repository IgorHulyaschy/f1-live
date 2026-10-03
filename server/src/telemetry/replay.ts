import { TELEMETRY_VERSION } from '@f1-live/shared';
import type { ReplayCar, ReplayChunk, ReplayChunkRef, ReplayManifest } from '@f1-live/shared';

import { interpolate, nearest } from './series.js';
import type { PositionTrack } from './series.js';

/** Positions are kept every quarter of a second, 4 Hz as the feed samples them. */
export const REPLAY_STEP_MS = 250;

/** A chunk is a minute of the session: 240 samples for each car. */
export const REPLAY_CHUNK_MS = 60_000;

/** Positions are whole metres. */
export const REPLAY_QUANT_M = 1;

export interface ReplayFile {
	/** Path inside the replay folder. */
	file: string;
	chunk: ReplayChunk;
}

export interface ReplayBuild {
	originAt: number;
	chunks: ReplayFile[];
	driverNumbers: string[];
}

function encode(values: readonly number[]): number[] {
	let previous = 0;

	return values.map((value) => {
		const quanta = Math.round(value / REPLAY_QUANT_M);
		const change = quanta - previous;

		previous = quanta;

		return change;
	});
}

function offRanges(flags: readonly number[]): [number, number][] {
	const ranges: [number, number][] = [];
	let from = -1;

	flags.forEach((flag, index) => {
		if (flag === 1 && from === -1) {
			from = index;
		} else if (flag !== 1 && from !== -1) {
			ranges.push([from, index - 1]);
			from = -1;
		}
	});

	if (from !== -1) {
		ranges.push([from, flags.length - 1]);
	}

	return ranges;
}

/**
 * Every car's positions on a 4 Hz grid for the length of the data, in chunks of a minute that
 * can be read on their own: a chunk starts each car at an absolute place and goes on in changes
 * of a metre, which a gzip file stores in a few bytes. Between samples a car is interpolated;
 * outside its data it stays where its data begin or end.
 */
export function buildReplay(tracks: ReadonlyMap<string, PositionTrack>): ReplayBuild {
	const all = [...tracks].filter(([, track]) => track.at.length > 0);
	const first = Math.min(...all.map(([, track]) => track.at[0] ?? Number.POSITIVE_INFINITY));
	const last = Math.max(...all.map(([, track]) => track.at.at(-1) ?? 0));

	if (all.length === 0 || !Number.isFinite(first)) {
		throw new Error('There are no positions to build a replay from');
	}

	const originAt = Math.floor(first / REPLAY_STEP_MS) * REPLAY_STEP_MS;
	const perChunk = REPLAY_CHUNK_MS / REPLAY_STEP_MS;
	const chunkCount = Math.floor((last - originAt) / REPLAY_CHUNK_MS) + 1;
	const driverNumbers = all.map(([driver]) => driver).toSorted((a, b) => Number(a) - Number(b));
	const chunks: ReplayFile[] = [];

	for (let index = 0; index < chunkCount; index += 1) {
		const t0 = index * REPLAY_CHUNK_MS;
		const cars: { [driverNumber: string]: ReplayCar } = {};

		for (const driver of driverNumbers) {
			const track = tracks.get(driver);

			if (track === undefined) {
				continue;
			}

			const times = Array.from(
				{ length: perChunk },
				(_, step) => originAt + t0 + step * REPLAY_STEP_MS
			);

			const off = offRanges(times.map((t) => nearest(track.at, track.offTrack, t)));

			const car: ReplayCar = {
				x: encode(times.map((t) => interpolate(track.at, track.x, t))),
				y: encode(times.map((t) => interpolate(track.at, track.y, t)))
			};

			if (off.length > 0) {
				car.off = off;
			}

			cars[driver] = car;
		}

		chunks.push({
			file: `${index}.json.gz`,
			chunk: {
				v: TELEMETRY_VERSION,
				t0,
				stepMs: REPLAY_STEP_MS,
				n: perChunk,
				quantM: REPLAY_QUANT_M,
				cars
			}
		});
	}

	return { originAt, chunks, driverNumbers };
}

export function replayManifest(build: ReplayBuild, sizes: readonly number[]): ReplayManifest {
	const refs: ReplayChunkRef[] = build.chunks.map(({ file, chunk }, index) => ({
		file,
		t0: chunk.t0,
		n: chunk.n,
		bytes: sizes[index] ?? 0
	}));

	return {
		v: TELEMETRY_VERSION,
		originAt: new Date(build.originAt).toISOString(),
		stepMs: REPLAY_STEP_MS,
		chunkMs: REPLAY_CHUNK_MS,
		quantM: REPLAY_QUANT_M,
		driverNumbers: build.driverNumbers,
		chunks: refs
	};
}
