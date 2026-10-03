import { z } from 'zod';

import { createLocalStore } from '../lib/local-store.ts';

/** Replay speeds as multiples of real time; 60 steps a race lap in about a second and a half. */
export const REPLAY_SPEEDS = [1, 10, 60] as const;

export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

/** The viewer's replay speed, shared by every open window. */
export const replaySpeedStore = createLocalStore<ReplaySpeed>(
	'pitwall-replay-speed',
	z.union([z.literal(1), z.literal(10), z.literal(60)]),
	60
);

export function nextSpeed(speed: ReplaySpeed): ReplaySpeed {
	return REPLAY_SPEEDS[(REPLAY_SPEEDS.indexOf(speed) + 1) % REPLAY_SPEEDS.length] ?? 60;
}

/**
 * The session time a replay shows, finer than its laps or minutes: what a track map animates by.
 * It runs between renders, so it is read when drawing a frame rather than held in React state;
 * listeners hear only when it is moved, started or stopped.
 */
export class ReplayClock {
	private time = 0;
	private since = 0;
	private rate = 0;
	private readonly listeners = new Set<() => void>();

	/** The session time at `at` (a `performance.now()` reading), ms since the Unix epoch. */
	now = (at: number = performance.now()): number => this.time + (at - this.since) * this.rate;

	get running(): boolean {
		return this.rate !== 0;
	}

	/** Holds at `time`, or runs on from it at `rate` times real time. */
	set(time: number, rate: number, at: number = performance.now()): void {
		if (time === this.now(at) && rate === this.rate) {
			return;
		}

		this.time = time;
		this.since = at;
		this.rate = rate;

		for (const listener of this.listeners) {
			listener();
		}
	}

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);

		return () => this.listeners.delete(listener);
	};
}
