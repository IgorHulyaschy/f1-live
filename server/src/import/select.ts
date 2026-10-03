import type { IndexedMeeting, IndexedSeason, IndexedSession } from '../catalog/season-index.js';

/** What an import run was asked to cover; `fromDir` reads live recordings instead of the archive. */
export type Selection =
	| { kind: 'meeting'; years: readonly number[]; meeting?: string }
	| { kind: 'key'; key: number }
	| { kind: 'fromDir'; root: string; key?: number }
	| { kind: 'local' };

/** A session folder in the raw directory, ready to ingest. */
export interface RawSession {
	key: number;
	/** "Las Vegas Grand Prix 2025, Race", or the folder when the name is not known. */
	label: string;
	/** The archive path without a trailing slash, e.g. "2025/2025-11-22_Las_Vegas_Grand_Prix/2025-11-22_Race". */
	path: string;
}

/** A session from a season index, which the importer can also fetch. */
export interface ImportTarget extends RawSession {
	startsAt: string;
	endsAt: string;
	meetingKey: number;
	type: IndexedSession['type'];
}

export interface Skipped {
	key: number;
	label: string;
	reason: string;
}

export interface Chosen {
	targets: ImportTarget[];
	skipped: Skipped[];
}

function normalize(text: string): string {
	return text
		.normalize('NFD')
		.replaceAll(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.trim();
}

/** A meeting matches by its name, official name, location, circuit or country. */
export function meetingMatches(meeting: IndexedMeeting, query: string): boolean {
	const wanted = normalize(query);

	return [
		meeting.name,
		meeting.officialName,
		meeting.location,
		meeting.circuit,
		meeting.country.name
	].some((field) => normalize(field).includes(wanted));
}

function labelOf(year: number, meeting: IndexedMeeting, session: IndexedSession): string {
	return `${meeting.name} ${year}, ${session.name}`;
}

/**
 * The sessions to import from the season indexes. Upcoming sessions and sessions the archive
 * lists without a path are skipped with the reason, not failed.
 */
export function chooseSessions(
	seasons: readonly IndexedSeason[],
	pick: (meeting: IndexedMeeting, session: IndexedSession) => boolean,
	now: Date
): Chosen {
	const chosen: Chosen = { targets: [], skipped: [] };

	for (const season of seasons) {
		for (const meeting of season.meetings) {
			for (const session of meeting.sessions) {
				if (!pick(meeting, session)) {
					continue;
				}

				const label = labelOf(season.year, meeting, session);

				if (Date.parse(session.startsAt) > now.getTime()) {
					chosen.skipped.push({ key: session.key, label, reason: 'upcoming' });
				} else if (session.path === null) {
					chosen.skipped.push({ key: session.key, label, reason: 'the archive lists no path' });
				} else {
					chosen.targets.push({
						key: session.key,
						label,
						path: session.path.replace(/\/$/, ''),
						startsAt: session.startsAt,
						endsAt: session.endsAt,
						meetingKey: meeting.key,
						type: session.type
					});
				}
			}
		}
	}

	return chosen;
}

/** Throws when a meeting name matches nothing, so a typo does not look like an empty import. */
export function chooseBySelection(
	seasons: readonly IndexedSeason[],
	selection: Extract<Selection, { kind: 'meeting' | 'key' }>,
	now: Date
): Chosen {
	if (selection.kind === 'key') {
		const chosen = chooseSessions(seasons, (_, session) => session.key === selection.key, now);

		if (chosen.targets.length + chosen.skipped.length === 0) {
			throw new Error(`Session ${selection.key} is not in the season indexes`);
		}

		return chosen;
	}

	const { meeting } = selection;

	const chosen = chooseSessions(
		seasons.filter((season) => selection.years.includes(season.year)),
		(candidate) => meeting === undefined || meetingMatches(candidate, meeting),
		now
	);

	if (chosen.targets.length + chosen.skipped.length === 0) {
		throw new Error(`No session of ${selection.years.join(', ')} matches "${meeting ?? ''}"`);
	}

	return chosen;
}
