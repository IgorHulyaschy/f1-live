import type { RaceSnapshot } from '@f1-live/shared';

import { sessionClock } from '../data/snapshot-at-time.ts';
import { isKnockout, isTimedSession, partStarts } from './qualifying.ts';
import { type StoryLane, type StoryMark, storyMarks, type StoryTone } from './race-story.ts';

/** What the timeline's event keys step through. */
export const EVENT_FILTERS = ['all', 'flags', 'stops', 'mine'] as const;

export type EventFilter = (typeof EVENT_FILTERS)[number];

export const EVENT_FILTER_LABEL: Record<EventFilter, string> = {
	all: 'All',
	flags: 'Flags',
	stops: 'Stops',
	mine: 'Mine'
};

/** A moment worth jumping to: the start of the session or a part, or one of the story's marks. */
export type TimelineEvent = {
	id: string;
	/** The lap of a race, or the minute of a session on the clock. */
	step: number;
	lane: StoryLane | 'start';
	tone: StoryTone | 'start';
	text: string;
	driverNumber?: string;
};

const MINUTE_MS = 60_000;

/** The start of the race, or of each part of a session on the clock. */
function starts(snapshot: RaceSnapshot): TimelineEvent[] {
	if (!isTimedSession(snapshot.session.type)) {
		return snapshot.session.totalLaps > 0
			? [{ id: 'start-0', step: 1, lane: 'start', tone: 'start', text: 'Start' }]
			: [];
	}

	const clock = sessionClock(snapshot);
	const prefix = snapshot.session.type === 'sprint_qualifying' ? 'SQ' : 'Q';
	const knockout = isKnockout(snapshot.session.type);

	return partStarts(snapshot).map((at, index) => ({
		id: `start-${index}`,
		step: Math.max(1, Math.ceil((Date.parse(at) - clock.startMs) / MINUTE_MS)),
		lane: 'start',
		tone: 'start',
		text: knockout ? `${prefix}${index + 1} starts` : 'Start'
	}));
}

/**
 * The moments a replay can jump between, in order: starts, flags as they come out (not every lap
 * they stay out), the lead and fastest laps, passes, stops, penalties and cars out. Radio clips
 * are left to the story.
 */
export function timelineEvents(snapshot: RaceSnapshot): TimelineEvent[] {
	const marks = storyMarks(snapshot);

	const flagStarts = marks.filter(
		(mark) =>
			mark.lane === 'flags' &&
			!marks.some(
				(earlier) =>
					earlier.lane === 'flags' && earlier.tone === mark.tone && earlier.step === mark.step - 1
			)
	);

	const moments: StoryMark[] = marks.filter(
		(mark) => mark.lane !== 'flags' && mark.lane !== 'radio'
	);

	return [...starts(snapshot), ...flagStarts, ...moments].toSorted((a, b) => a.step - b.step);
}

export function matchesFilter(
	event: TimelineEvent,
	filter: EventFilter,
	followedDriver: string
): boolean {
	switch (filter) {
		case 'all': {
			return true;
		}

		case 'flags': {
			return event.lane === 'flags';
		}

		case 'stops': {
			return event.lane === 'stops';
		}

		case 'mine': {
			return event.driverNumber === followedDriver;
		}
	}
}

/**
 * The nearest step after `step` (or before it, going back) holding an event that passes the
 * filter; null when there is none that way.
 */
export function adjacentEventStep(
	events: readonly TimelineEvent[],
	step: number,
	direction: 1 | -1,
	filter: EventFilter,
	followedDriver: string
): number | null {
	const steps = events.flatMap((event) =>
		matchesFilter(event, filter, followedDriver) &&
		(direction > 0 ? event.step > step : event.step < step)
			? [event.step]
			: []
	);

	if (steps.length === 0) {
		return null;
	}

	return direction > 0 ? Math.min(...steps) : Math.max(...steps);
}
