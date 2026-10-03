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

/** The newest moment a snapshot knows about, by the feed's own clock. */
export function feedTimeOf(snapshot: RaceSnapshot): number | null {
	const times = [
		...snapshot.laps.map((lap) => lap.completedAt),
		...(snapshot.trackStatusLog ?? []).map((change) => change.at),
		...(snapshot.statusLog ?? []).map((change) => change.at),
		...snapshot.raceControl.map((message) => message.at)
	].flatMap((at) => (at === undefined ? [] : [Date.parse(at)]));

	return times.length > 0 ? Math.max(...times) : null;
}

/**
 * The live session as a viewer saw it `delayMs` ago, so the screen matches a TV that runs behind.
 * After joining that is the state that had arrived by then. Before joining there is no such
 * state, so the first one is cut back by the times it carries: a viewer who joins late with a
 * delay is in step at once, not only after waiting out the delay. Cuts are made on whole seconds.
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

	const cut = feedTime - (first.receivedAt - target);

	return snapshotAtTime(first.snapshot, Math.floor(cut / 1000) * 1000);
}
