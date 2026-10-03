import type { RaceSnapshot } from '@f1-live/shared';

import { snapshotAtTime } from './snapshot-at-time.ts';

/** The longest delay offered: the slowest pay-TV apps run about a minute behind, so five is ample. */
export const MAX_DELAY_SECONDS = 300;

/** The live state as it arrived, with when it arrived (ms since the epoch). */
export type Arrival = { receivedAt: number; snapshot: RaceSnapshot };

/**
 * Adds an arrival and forgets those too old for any delay, keeping the newest of them as the
 * state a delay of the full length starts from.
 */
export function recordArrival(history: readonly Arrival[], arrival: Arrival): Arrival[] {
	const cutoff = arrival.receivedAt - MAX_DELAY_SECONDS * 1000;
	const firstKept = history.findLastIndex((entry) => entry.receivedAt <= cutoff);

	return [...history.slice(Math.max(firstKept, 0)), arrival];
}

const feedTimes = new WeakMap<RaceSnapshot, number | null>();

/** The newest moment a snapshot knows about, by the feed's own clock; worked out once per snapshot. */
export function feedTimeOf(snapshot: RaceSnapshot): number | null {
	const known = feedTimes.get(snapshot);

	if (known !== undefined) {
		return known;
	}

	const time = newestTime(snapshot);

	feedTimes.set(snapshot, time);

	return time;
}

function newestTime(snapshot: RaceSnapshot): number | null {
	const times = [
		...snapshot.laps.map((lap) => lap.completedAt),
		...(snapshot.trackStatusLog ?? []).map((change) => change.at),
		...(snapshot.statusLog ?? []).map((change) => change.at),
		...snapshot.raceControl.map((message) => message.at)
	].flatMap((at) => (at === undefined ? [] : [Date.parse(at)]));

	return times.length > 0 ? Math.max(...times) : null;
}

/** The last cut before joining, so a screen that asks every tick gets the same object. */
let lastCut: { from: RaceSnapshot; at: number; cut: RaceSnapshot } | null = null;

/** Feed times within this of the arrival read as the wall clock; a replay runs on its own. */
const SAME_CLOCK_MS = 12 * 60 * 60 * 1000;

function cutOnce(from: RaceSnapshot, at: number): RaceSnapshot {
	if (lastCut?.from !== from || lastCut.at !== at) {
		lastCut = { from, at, cut: snapshotAtTime(from, at) };
	}

	return lastCut.cut;
}

/**
 * The live session as a viewer saw it `delayMs` ago, so the screen matches a TV that runs behind.
 * After joining that is the state that had arrived by then. Before joining there is no such
 * state, so the first one is cut back by the times it carries: a viewer who joins late with a
 * delay is in step at once, not only after waiting out the delay. A live feed's clock is the
 * wall clock, so a quiet spell such as a red flag stays in the cut; a replay's is its own.
 * Cuts are made on whole seconds.
 */
export function delayedSnapshot(
	history: readonly Arrival[],
	now: number,
	delayMs: number
): RaceSnapshot | null {
	const target = now - delayMs;
	const arrived = history.findLast((entry) => entry.receivedAt <= target);

	if (arrived) {
		return arrived.snapshot;
	}

	const first = history[0];
	const feedTime = first ? feedTimeOf(first.snapshot) : null;

	if (!first || feedTime === null) {
		return first?.snapshot ?? null;
	}

	const anchor =
		Math.abs(first.receivedAt - feedTime) < SAME_CLOCK_MS ? first.receivedAt : feedTime;

	const cut = anchor - (first.receivedAt - target);

	return cutOnce(first.snapshot, Math.floor(cut / 1000) * 1000);
}

/**
 * The feed's clock at `now` for a screen `delayMs` behind, to draw between its messages. A live
 * feed's clock is the wall clock; a replay's is its own, so it is read off the state on screen:
 * the newest moment that state knows, run on since it arrived.
 */
export function feedClock(history: readonly Arrival[], now: number, delayMs: number): number {
	const target = now - delayMs;
	const shown = history.findLast((entry) => entry.receivedAt <= target) ?? history[0];
	const feedTime = shown ? feedTimeOf(shown.snapshot) : null;

	if (!shown || feedTime === null || Math.abs(shown.receivedAt - feedTime) < SAME_CLOCK_MS) {
		return target;
	}

	return feedTime + (target - shown.receivedAt);
}
