import type { RaceSnapshot } from '@f1-live/shared';

import { isTimedSession } from '../insights/qualifying.ts';
import { minuteTime, sessionClock } from './snapshot-at-time.ts';

/** When the session started: the start signal, or for the modelled replay its planned start. */
export function sessionStartMs(race: RaceSnapshot): number {
	return Date.parse(race.startedAt ?? race.session.startsAt);
}

/**
 * When each car crossed the line, by lap: entry `n` ends lap `n`, entry 0 is the start. Real laps
 * carry the time; the modelled replay has only lap times, so its crossings add them up from the
 * start. A lap that is missing leaves a hole.
 */
export function crossingTimes(race: RaceSnapshot): Map<string, number[]> {
	const startMs = sessionStartMs(race);
	const crossings = new Map<string, number[]>();

	for (const lap of race.laps.toSorted((a, b) => a.lap - b.lap)) {
		const own = crossings.get(lap.driverNumber) ?? [startMs];
		const before = own[lap.lap - 1];

		own[lap.lap] =
			lap.completedAt === undefined
				? (before ?? startMs) + lap.lapTimeMs
				: Date.parse(lap.completedAt);
		crossings.set(lap.driverNumber, own);
	}

	return crossings;
}

/**
 * The session time at the end of each replay step, ms since the Unix epoch: a race's laps by when
 * the leader completed them, a timed session's minutes. Entry 0 is the start.
 */
export type ReplayTimeline = { unit: 'lap' | 'minute'; times: readonly number[] };

export function replayTimeline(race: RaceSnapshot): ReplayTimeline {
	if (isTimedSession(race.session.type)) {
		const clock = sessionClock(race);

		return {
			unit: 'minute',
			times: Array.from({ length: clock.minutes + 1 }, (_, minute) => minuteTime(clock, minute))
		};
	}

	const times = [sessionStartMs(race)];
	const crossings = [...crossingTimes(race).values()];

	for (let lap = 1; lap <= race.currentLap; lap++) {
		const first = Math.min(...crossings.flatMap((own) => own[lap] ?? []));
		const previous = times[lap - 1] ?? times[0] ?? 0;

		times.push(Number.isFinite(first) ? Math.max(first, previous) : previous);
	}

	return { unit: 'lap', times };
}

/**
 * Where the replay clock goes for `step`. A lap is shown as it ended, except the first, which
 * starts at the start signal so the start can be watched.
 */
export function stepTime(timeline: ReplayTimeline, step: number): number {
	const { times } = timeline;
	const index = timeline.unit === 'lap' && step <= 1 ? 0 : Math.min(step, times.length - 1);

	return times[Math.max(index, 0)] ?? 0;
}

/** The step on screen at session time `time`: the laps or minutes done by then, at least 1. */
export function stepAt(timeline: ReplayTimeline, time: number): number {
	const { times } = timeline;
	let low = 0;
	let high = times.length - 1;

	while (low < high) {
		const middle = Math.ceil((low + high) / 2);

		if ((times[middle] ?? Infinity) <= time) {
			low = middle;
		} else {
			high = middle - 1;
		}
	}

	return Math.max(1, low);
}

/**
 * The step that first shows a moment: a race's lap as given, or in a session on the clock the
 * minute by whose end it had happened. Null when a timed moment has no time.
 */
export function stepShowing(
	timeline: ReplayTimeline,
	moment: { lap: number; at?: string }
): number | null {
	if (timeline.unit === 'lap') {
		return Math.min(Math.max(moment.lap, 1), Math.max(timeline.times.length - 1, 1));
	}

	if (moment.at === undefined) {
		return null;
	}

	const time = Date.parse(moment.at);
	const step = timeline.times.findIndex((end) => end >= time);

	return step === -1 ? Math.max(timeline.times.length - 1, 1) : Math.max(step, 1);
}
