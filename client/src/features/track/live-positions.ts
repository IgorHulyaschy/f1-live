import type { LivePositions } from '@f1-live/shared';

import type { CarSample } from './replay-positions.ts';

/**
 * Cars are drawn this far behind the newest frame, so there is always a frame on each side of
 * the moment drawn and they glide between the feed's four frames a second.
 */
export const LIVE_LAG_MS = 1000;

type Frame = { at: number; cars: LivePositions['cars'] };

/**
 * The live feed's car positions, kept long enough to draw them behind a broadcast delay. Times
 * are the feed's own; `feedTime` maps the page's clock onto it from when the newest frame came.
 */
export class LivePositionBuffer {
	private frames: Frame[] = [];
	private newestAt = 0;
	private newestPerf = 0;
	private readonly keepMs: number;

	constructor(keepMs: number) {
		this.keepMs = keepMs;
	}

	push(frame: LivePositions, receivedAt: number = performance.now()): void {
		if (frame.at <= this.newestAt) {
			return;
		}

		// A frame carries the cars that moved; the others keep their last place.
		this.frames.push({ at: frame.at, cars: { ...this.frames.at(-1)?.cars, ...frame.cars } });
		this.newestAt = frame.at;
		this.newestPerf = receivedAt;

		const oldest = frame.at - this.keepMs;
		const stale = this.frames.findIndex((kept) => kept.at >= oldest);

		if (stale > 0) {
			this.frames = this.frames.slice(stale);
		}
	}

	get empty(): boolean {
		return this.frames.length === 0;
	}

	/** The feed time at `perf` (a `performance.now()` reading). */
	feedTime(perf: number = performance.now()): number {
		return this.newestAt + (perf - this.newestPerf);
	}

	/** Every car's place at feed time `time`, between the frames around it. */
	sample(time: number, into: Map<string, CarSample>): boolean {
		into.clear();

		// Before the first frame nothing is known; estimates stand in rather than frozen cars.
		if ((this.frames[0]?.at ?? Infinity) > time) {
			return false;
		}

		const after = this.frames.findIndex((frame) => frame.at >= time);
		const next = this.frames[after === -1 ? this.frames.length - 1 : after];
		const previous = after > 0 ? this.frames[after - 1] : next;

		if (!next || !previous) {
			return false;
		}

		const span = next.at - previous.at;
		const share = span > 0 ? Math.min(1, Math.max(0, (time - previous.at) / span)) : 1;

		for (const [driverNumber, [x1, y1, onTrack]] of Object.entries(next.cars)) {
			const [x0, y0] = previous.cars[driverNumber] ?? [x1, y1];

			into.set(driverNumber, {
				x: x0 + (x1 - x0) * share,
				y: y0 + (y1 - y0) * share,
				offTrack: onTrack === 0
			});
		}

		return true;
	}
}
