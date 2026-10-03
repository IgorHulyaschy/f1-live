import type { ReplayChunk, ReplayChunkRef, ReplayManifest } from '@f1-live/shared';

/** One car's places through a chunk, in metres, and whether the feed had it off the track. */
type CarSamples = { x: Float32Array; y: Float32Array; off: Uint8Array };

/** A replay chunk turned from deltas in quanta into places in metres, ready to sample. */
export type ExpandedChunk = { n: number; cars: ReadonlyMap<string, CarSamples> };

export function expandChunk(chunk: ReplayChunk): ExpandedChunk {
	const cars = new Map<string, CarSamples>();

	for (const [driverNumber, car] of Object.entries(chunk.cars)) {
		const x = new Float32Array(chunk.n);
		const y = new Float32Array(chunk.n);
		const off = new Uint8Array(chunk.n);
		let sumX = 0;
		let sumY = 0;

		for (let index = 0; index < chunk.n; index++) {
			// A car's columns can stop short of the chunk; it then holds its last place.
			sumX += car.x[index] ?? 0;
			sumY += car.y[index] ?? 0;
			x[index] = sumX * chunk.quantM;
			y[index] = sumY * chunk.quantM;
		}

		for (const [from, to] of car.off ?? []) {
			off.fill(1, Math.max(0, from), Math.min(chunk.n, to + 1));
		}

		cars.set(driverNumber, { x, y, off });
	}

	return { n: chunk.n, cars };
}

export type CarSample = { x: number; y: number; offTrack: boolean };

/** Uniform Catmull-Rom through four places, at `share` of the way from the second to the third. */
function spline(p0: number, p1: number, p2: number, p3: number, share: number): number {
	const share2 = share * share;

	return (
		0.5 *
		(2 * p1 +
			(p2 - p0) * share +
			(2 * p0 - 5 * p1 + 4 * p2 - p3) * share2 +
			(3 * p1 - p0 - 3 * p2 + p3) * share2 * share)
	);
}

/** A stretch of session time, ms since the Unix epoch. */
export type Span = { from: number; to: number };

/** A chunk that failed is asked for again after this long. */
const RETRY_MS = 30_000;

/** Chunks kept in memory: about two hours of a session. */
const KEPT_CHUNKS = 120;

/**
 * Every car's place at any moment of a replay. Samples are 250 ms apart; between them the cars
 * run on a curve through the samples around, so motion stays smooth at any frame rate. Chunks
 * load on demand; until the one for a moment is in, that moment has no places.
 */
export class ReplayPositions {
	private readonly originMs: number;
	private readonly chunks = new Map<number, ExpandedChunk>();
	private readonly loading = new Set<number>();
	private readonly refs = new Map<number, ReplayChunkRef>();
	private readonly perChunk: number;
	private readonly manifest: ReplayManifest;
	private readonly load: (ref: ReplayChunkRef) => Promise<ReplayChunk>;
	private readonly listeners = new Set<() => void>();
	/** When each chunk that failed to load failed, so it is not asked for again at once. */
	private readonly failures = new Map<number, number>();

	constructor(manifest: ReplayManifest, load: (ref: ReplayChunkRef) => Promise<ReplayChunk>) {
		this.manifest = manifest;
		this.load = load;
		this.originMs = Date.parse(manifest.originAt);
		this.perChunk = Math.round(manifest.chunkMs / manifest.stepMs);

		for (const ref of manifest.chunks) {
			this.refs.set(Math.round(ref.t0 / manifest.chunkMs), ref);
		}
	}

	/** Hears when a chunk arrives or fails. */
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);

		return () => this.listeners.delete(listener);
	}

	private loaded(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}

	get driverNumbers(): readonly string[] {
		return this.manifest.driverNumbers;
	}

	/** The span the replay covers, ms since the Unix epoch. */
	get span(): Span {
		const last = this.manifest.chunks.at(-1);

		return {
			from: this.originMs,
			to: this.originMs + (last ? last.t0 + last.n * this.manifest.stepMs : 0)
		};
	}

	private chunkOf(time: number): number {
		return Math.floor((time - this.originMs) / this.manifest.chunkMs);
	}

	/** Loads the chunk holding `time`, the one before it and `ahead` after it. */
	want(time: number, ahead = 1): void {
		const first = this.chunkOf(time);

		for (let index = first - 1; index <= first + ahead; index++) {
			const ref = this.refs.get(index);

			const failedAt = this.failures.get(index);

			if (
				!ref ||
				this.chunks.has(index) ||
				this.loading.has(index) ||
				(failedAt !== undefined && Date.now() - failedAt < RETRY_MS)
			) {
				continue;
			}

			this.loading.add(index);
			void this.fetch(index, ref);
		}
	}

	private async fetch(index: number, ref: ReplayChunkRef): Promise<void> {
		try {
			this.keep(index, expandChunk(await this.load(ref)));
			this.failures.delete(index);
		} catch {
			this.failures.set(index, Date.now());
		} finally {
			this.loading.delete(index);
			this.loaded();
		}
	}

	private keep(index: number, chunk: ExpandedChunk): void {
		this.chunks.set(index, chunk);

		for (const kept of this.chunks.keys()) {
			if (this.chunks.size <= KEPT_CHUNKS) {
				break;
			}

			this.chunks.delete(kept);
		}
	}

	/** The moment's chunk is not in the replay, or failed and waits to be asked for again. */
	missing(time: number): boolean {
		const index = this.chunkOf(time);

		return !this.refs.has(index) || this.failures.has(index);
	}

	/** Whether the chunk for `time` is in, so `sample` can answer. */
	has(time: number): boolean {
		return this.chunks.has(this.chunkOf(time));
	}

	private at(driverNumber: string, step: number) {
		const index = Math.floor(step / this.perChunk);
		const car = this.chunks.get(index)?.cars.get(driverNumber);
		const within = step - index * this.perChunk;

		if (!car || within >= car.x.length) {
			return null;
		}

		return { x: car.x[within] ?? 0, y: car.y[within] ?? 0, off: car.off[within] === 1 };
	}

	/** One car's place at `time`; null when its chunk is not in or the car is not in it. */
	sampleCar(driverNumber: string, time: number): CarSample | null {
		const position = (time - this.originMs) / this.manifest.stepMs;
		const step = Math.floor(position);
		const share = position - step;
		const p1 = this.at(driverNumber, step);

		if (!p1) {
			return null;
		}

		const p2 = this.at(driverNumber, step + 1);

		if (!p2) {
			return { x: p1.x, y: p1.y, offTrack: p1.off };
		}

		const p0 = this.at(driverNumber, step - 1) ?? p1;
		const p3 = this.at(driverNumber, step + 2) ?? p2;

		return {
			x: spline(p0.x, p1.x, p2.x, p3.x, share),
			y: spline(p0.y, p1.y, p2.y, p3.y, share),
			offTrack: share < 0.5 ? p1.off : p2.off
		};
	}

	/** Every car's place at `time`, into `into`; false while that moment's chunk is not in. */
	sample(time: number, into: Map<string, CarSample>): boolean {
		into.clear();

		if (!this.has(time)) {
			return false;
		}

		for (const driverNumber of this.manifest.driverNumbers) {
			const place = this.sampleCar(driverNumber, time);

			if (place) {
				into.set(driverNumber, place);
			}
		}

		return true;
	}
}
