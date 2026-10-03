import {
	type Catalog,
	defaultSessionKey,
	findSession,
	type SessionEntry,
	sessionEntries
} from '../../data/catalog.ts';

/**
 * The weekend the home offers to catch up on: the one with the live session, else the one with
 * the latest saved session. Its sessions come in running order, saved or not.
 */
export function latestWeekend(catalog: Catalog, liveKey: string | null): SessionEntry[] {
	const key = defaultSessionKey(catalog, liveKey);
	const anchor = key === null ? null : findSession(catalog, key);

	if (!anchor) {
		return [];
	}

	return sessionEntries(catalog)
		.filter((entry) => entry.year === anchor.year && entry.meeting.key === anchor.meeting.key)
		.toSorted((a, b) => a.session.startsAt.localeCompare(b.session.startsAt));
}

/** "Las Vegas Race", "Bahrain Practice 2": a session named without its year. */
export function sessionTitle(entry: SessionEntry): string {
	return `${entry.meeting.name.replace(/ Grand Prix$/, '')} ${entry.session.name}`;
}
