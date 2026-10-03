import type { SessionType } from '@f1-live/shared';

import type { IndexedMeeting, IndexedSeason, IndexedSession } from './season-index.js';

/** A race can run past its scheduled end (red flags), so a session stays live for a while after. */
const LIVE_GRACE_MS = 60 * 60 * 1000;

export type CatalogStatus = 'upcoming' | 'live' | 'finished';

export interface CatalogSession {
	key: number;
	type: SessionType;
	name: string;
	/** ISO 8601, UTC. */
	startsAt: string;
	status: CatalogStatus;
	circuit: string;
	country: { code: string; name: string };
	outputs: { raw: boolean; events: boolean; snapshot: boolean; telemetry: boolean };
}

export interface CatalogMeeting {
	key: number;
	name: string;
	officialName: string;
	location: string;
	sessions: CatalogSession[];
}

export interface CatalogSeason {
	year: number;
	meetings: CatalogMeeting[];
}

export interface Catalog {
	seasons: CatalogSeason[];
}

/** The keys that have each output on disk. */
export interface AvailableOutputs {
	raw: ReadonlySet<number>;
	events: ReadonlySet<number>;
	snapshots: ReadonlySet<number>;
	telemetry: ReadonlySet<number>;
}

export function sessionStatus(session: IndexedSession, now: Date): CatalogStatus {
	const time = now.getTime();

	if (time < Date.parse(session.startsAt)) {
		return 'upcoming';
	}

	return time < Date.parse(session.endsAt) + LIVE_GRACE_MS ? 'live' : 'finished';
}

function catalogMeeting(
	meeting: IndexedMeeting,
	available: AvailableOutputs,
	now: Date
): CatalogMeeting {
	return {
		key: meeting.key,
		name: meeting.name,
		officialName: meeting.officialName,
		location: meeting.location,
		sessions: meeting.sessions
			.toSorted((a, b) => a.startsAt.localeCompare(b.startsAt) || a.key - b.key)
			.map((session) => ({
				key: session.key,
				type: session.type,
				name: session.name,
				startsAt: session.startsAt,
				status: sessionStatus(session, now),
				circuit: meeting.circuit,
				country: meeting.country,
				outputs: {
					raw: available.raw.has(session.key),
					events: available.events.has(session.key),
					snapshot: available.snapshots.has(session.key),
					telemetry: available.telemetry.has(session.key)
				}
			}))
	};
}

/**
 * Seasons, meetings and sessions from the archive's season indexes, upcoming sessions included,
 * in calendar order.
 */
export function buildCatalog(
	seasons: readonly IndexedSeason[],
	available: AvailableOutputs,
	now: Date
): Catalog {
	return {
		seasons: seasons
			.toSorted((a, b) => a.year - b.year)
			.map((season) => ({
				year: season.year,
				meetings: season.meetings
					.map((meeting) => catalogMeeting(meeting, available, now))
					.toSorted(
						(a, b) =>
							(a.sessions[0]?.startsAt ?? '').localeCompare(b.sessions[0]?.startsAt ?? '') ||
							a.key - b.key
					)
			}))
	};
}
