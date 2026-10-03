import { SESSION_TYPES, type SessionType } from '@f1-live/shared';
import { z } from 'zod';

/** `<DATA_DIR>/out/catalog.json`, as written by server/src/catalog/catalog.ts. */
const catalogSessionSchema = z.object({
	key: z.int(),
	type: z.enum(SESSION_TYPES),
	name: z.string(),
	startsAt: z.iso.datetime(),
	status: z.enum(['upcoming', 'live', 'finished']),
	circuit: z.string(),
	country: z.object({ code: z.string(), name: z.string() }),
	outputs: z.object({ raw: z.boolean(), events: z.boolean(), snapshot: z.boolean() })
});

const catalogMeetingSchema = z.object({
	key: z.int(),
	name: z.string(),
	officialName: z.string(),
	location: z.string(),
	sessions: z.array(catalogSessionSchema)
});

export const catalogSchema = z.object({
	seasons: z.array(z.object({ year: z.int(), meetings: z.array(catalogMeetingSchema) }))
});

export type Catalog = z.infer<typeof catalogSchema>;

export type CatalogMeeting = z.infer<typeof catalogMeetingSchema>;

export type CatalogSession = z.infer<typeof catalogSessionSchema>;

/** One session with its meeting and season: a row of the session picker. */
export type SessionEntry = {
	/** The archive key as text, as the URL and the live feed name it. */
	key: string;
	year: number;
	meeting: CatalogMeeting;
	session: CatalogSession;
};

/**
 * What a viewer can do with a session now. The catalog's own status was right when it was
 * written, so the live feed and the clock decide instead.
 */
export type SessionAvailability = 'live' | 'saved' | 'upcoming' | 'missing';

export function sessionEntries(catalog: Catalog): SessionEntry[] {
	return catalog.seasons.flatMap((season) =>
		season.meetings.flatMap((meeting) =>
			meeting.sessions.map((session) => ({
				key: String(session.key),
				year: season.year,
				meeting,
				session
			}))
		)
	);
}

export function findSession(catalog: Catalog, key: string): SessionEntry | null {
	return sessionEntries(catalog).find((entry) => entry.key === key) ?? null;
}

export function availability(
	entry: SessionEntry,
	liveKey: string | null,
	now: number
): SessionAvailability {
	if (entry.key === liveKey) {
		return 'live';
	}

	if (entry.session.outputs.snapshot) {
		return 'saved';
	}

	return Date.parse(entry.session.startsAt) > now ? 'upcoming' : 'missing';
}

/** The session to open when the address names none: the live one, else the latest saved. */
export function defaultSessionKey(catalog: Catalog, liveKey: string | null): string | null {
	const entries = sessionEntries(catalog);

	if (liveKey !== null && entries.some((entry) => entry.key === liveKey)) {
		return liveKey;
	}

	return (
		entries
			.filter((entry) => entry.session.outputs.snapshot)
			.toSorted((a, b) => a.session.startsAt.localeCompare(b.session.startsAt))
			.at(-1)?.key ?? null
	);
}

/** The next session that has not started yet, for a countdown. */
export function nextSession(catalog: Catalog, now: number): SessionEntry | null {
	return (
		sessionEntries(catalog)
			.filter((entry) => Date.parse(entry.session.startsAt) > now)
			.toSorted((a, b) => a.session.startsAt.localeCompare(b.session.startsAt))[0] ?? null
	);
}

export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
	race: 'Race',
	sprint: 'Sprint',
	qualifying: 'Qualifying',
	sprint_qualifying: 'Sprint Qualifying',
	practice: 'Practice'
};

/** "Sat 10:00" in the viewer's own time zone. */
export function formatLocalStart(startsAt: string, timeZone?: string): string {
	return new Intl.DateTimeFormat(undefined, {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
		timeZone
	}).format(new Date(startsAt));
}
