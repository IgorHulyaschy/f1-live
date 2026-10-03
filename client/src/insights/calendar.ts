import type { SessionType } from '@f1-live/shared';

import type { Catalog, CatalogMeeting, CatalogSession } from '../data/catalog.ts';

/** How long a session runs when the catalog has no end for it. */
const DEFAULT_MINUTES: Record<SessionType, number> = {
	race: 120,
	sprint: 60,
	qualifying: 60,
	sprint_qualifying: 45,
	practice: 60
};

export type CalendarRound = {
	/** From 1 for the meetings with a race; null for testing. */
	round: number | null;
	meeting: CatalogMeeting;
	/** The first session's start and the last one's end, ISO 8601 UTC. */
	startsAt: string;
	endsAt: string;
};

export function sessionEnd(session: CatalogSession): string {
	return (
		session.endsAt ??
		new Date(Date.parse(session.startsAt) + DEFAULT_MINUTES[session.type] * 60_000).toISOString()
	);
}

/** A season's meetings in calendar order, the race weekends numbered. */
export function seasonCalendar(catalog: Catalog, year: number): CalendarRound[] {
	const meetings = catalog.seasons.find((season) => season.year === year)?.meetings ?? [];
	let round = 0;

	return meetings.flatMap((meeting) => {
		const first = meeting.sessions[0];
		const last = meeting.sessions.at(-1);

		if (!first || !last) {
			return [];
		}

		const isRace = meeting.sessions.some((session) => session.type === 'race');

		round += isRace ? 1 : 0;

		return [
			{
				round: isRace ? round : null,
				meeting,
				startsAt: first.startsAt,
				endsAt: sessionEnd(last)
			}
		];
	});
}

/** The round on now: the one running, else the next one, else the last. */
export function currentRound(rounds: readonly CalendarRound[], now: number): CalendarRound | null {
	return rounds.find((round) => Date.parse(round.endsAt) >= now) ?? rounds.at(-1) ?? null;
}

function icsTime(iso: string): string {
	return `${iso.replaceAll(/[-:]/g, '').replace(/\.\d{3}/, '')}`;
}

/** RFC 5545 text: backslash, semicolon and comma escaped, lines folded at 75 octets. */
function icsText(text: string): string {
	return text.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,');
}

function fold(line: string): string {
	const parts: string[] = [];

	for (let rest = line; rest.length > 0; rest = rest.slice(73)) {
		parts.push(rest.slice(0, 73));
	}

	return parts.join('\r\n ');
}

/**
 * The rounds' sessions as an iCalendar file, one event per session with its link, times in UTC
 * so every calendar shows them in its own time zone.
 */
export function calendarIcs(
	rounds: readonly CalendarRound[],
	options: { name: string; origin: string; stamp: string; host: string }
): string {
	const events = rounds.flatMap(({ meeting }) =>
		meeting.sessions.map((session) =>
			[
				'BEGIN:VEVENT',
				`UID:${session.key}@${options.host}`,
				`DTSTAMP:${icsTime(options.stamp)}`,
				`DTSTART:${icsTime(session.startsAt)}`,
				`DTEND:${icsTime(sessionEnd(session))}`,
				`SUMMARY:${icsText(`${meeting.name}: ${session.name}`)}`,
				`LOCATION:${icsText(`${meeting.location}, ${session.country.name}`)}`,
				`URL:${options.origin}/?session=${session.key}`,
				'END:VEVENT'
			].map(fold)
		)
	);

	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		`PRODID:-//${icsText(options.name)}//Calendar//EN`,
		'CALSCALE:GREGORIAN',
		`X-WR-CALNAME:${icsText(options.name)}`,
		...events.flat(),
		'END:VCALENDAR',
		''
	].join('\r\n');
}
