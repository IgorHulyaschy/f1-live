import { SESSION_TYPES } from '@f1-live/shared';
import type { SessionType } from '@f1-live/shared';
import { z } from 'zod';

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
	/** The scheduled end, ISO 8601 UTC; catalogs written before it was kept have none. */
	endsAt?: string;
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
				endsAt: session.endsAt,
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

const catalogSchema = z.object({
	seasons: z.array(
		z.object({
			year: z.number(),
			meetings: z.array(
				z.object({
					key: z.number(),
					name: z.string(),
					officialName: z.string(),
					location: z.string(),
					sessions: z.array(
						z.object({
							key: z.number(),
							type: z.enum(SESSION_TYPES),
							name: z.string(),
							startsAt: z.string(),
							endsAt: z.string().optional(),
							status: z.enum(['upcoming', 'live', 'finished']),
							circuit: z.string(),
							country: z.object({ code: z.string(), name: z.string() }),
							outputs: z.object({
								raw: z.boolean(),
								events: z.boolean(),
								snapshot: z.boolean(),
								telemetry: z.boolean()
							})
						})
					)
				})
			)
		})
	)
});

/** Reads a saved catalog; null when the text is not one. */
export function parseCatalog(text: string): Catalog | null {
	try {
		const parsed = catalogSchema.safeParse(JSON.parse(text));

		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

/**
 * The catalog an import writes: what it built from the season indexes it has, over what the
 * catalog already held. A meeting the import knows replaces the saved one; the rest are kept, with
 * their outputs read again. An import that sees few indexes (a live recording on an ingest host,
 * whose raw folder holds only this weekend) therefore never drops a session that has outputs.
 */
export function mergeCatalogs(
	previous: Catalog | null,
	fresh: Catalog,
	available: AvailableOutputs
): Catalog {
	const seasons = new Map<number, Map<number, CatalogMeeting>>();

	const keep = (season: CatalogSeason, meetings: readonly CatalogMeeting[]) => {
		const own = seasons.get(season.year) ?? new Map<number, CatalogMeeting>();

		for (const meeting of meetings) {
			own.set(meeting.key, meeting);
		}

		seasons.set(season.year, own);
	};

	for (const season of previous?.seasons ?? []) {
		keep(
			season,
			season.meetings.map((meeting) => ({
				...meeting,
				sessions: meeting.sessions.map((session) => ({
					...session,
					outputs: {
						raw: session.outputs.raw || available.raw.has(session.key),
						events: available.events.has(session.key),
						snapshot: available.snapshots.has(session.key),
						telemetry: available.telemetry.has(session.key)
					}
				}))
			}))
		);
	}

	for (const season of fresh.seasons) {
		keep(season, season.meetings);
	}

	return {
		seasons: [...seasons]
			.toSorted((a, b) => a[0] - b[0])
			.map(([year, meetings]) => ({
				year,
				meetings: [...meetings.values()].toSorted(
					(a, b) =>
						(a.sessions[0]?.startsAt ?? '').localeCompare(b.sessions[0]?.startsAt ?? '') ||
						a.key - b.key
				)
			}))
	};
}
