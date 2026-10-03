import type { AskContext, AskSession, SeasonSpan, SessionRef } from '@f1-live/shared/ask';
import type { SeasonResults, SessionResults } from '@f1-live/shared/results';

import { type Catalog, sessionEntries } from '../../data/catalog.ts';
import { SESSION_PATH } from '../dashboard/paths.ts';
import { eventIdOf, eventShortName } from './ask-context.ts';

/** Everything an answer is computed from. */
export type AskData = {
	/** The results indexes, oldest first. */
	seasons: readonly SeasonResults[];
	context: AskContext;
	catalog: Catalog | null;
	/** Whether the viewer has yet to see a session's result (`heldFromHistory`). */
	held: (key: string, startsAt: string) => boolean;
	now: number;
	/** The session open on screen. */
	openKey: string;
};

/** One session a question points at. */
export type AskSessionInfo = {
	key: string;
	season: number;
	/** The round in the results index; null for one only the catalog lists. */
	round: number | null;
	event: string;
	/** "Italian GP". */
	eventName: string;
	type: AskSession;
	/** "Race", "Practice 2". */
	name: string;
	startsAt: string;
	/** Its classification, when the results index has one. */
	results: SessionResults | null;
};

export type RichLink = { text: string; href: string };

/** Words in a reply that open where they came from. */
export type Rich = readonly (string | RichLink)[];

/** A part of a reply as text with the link it carries, if any. */
export function richPart(part: Rich[number]): { text: string; href: string | null } {
	// oxlint-disable-next-line anti-slop/no-runtime-typeof -- Rich is built in this module's answers, not read from outside.
	return typeof part === 'string' ? { text: part, href: null } : part;
}

/** A session the reply leaves out until the viewer reveals it. */
export type HeldSession = { key: string; startsAt: string; label: string };

export function sessionLabel(info: AskSessionInfo): string {
	return `${info.season} ${info.eventName} ${info.name}`;
}

export function heldOf(info: AskSessionInfo): HeldSession {
	return { key: info.key, startsAt: info.startsAt, label: sessionLabel(info) };
}

/** The live view of a session, on a driver and lap when given. */
export function sessionHref(key: string | number, car?: string, lap?: number): string {
	const params = new URLSearchParams({ session: String(key) });

	if (car) {
		params.set('car', car);
	}

	if (car && lap !== undefined) {
		params.set('carLap', String(lap));
	}

	return `${SESSION_PATH}?${params.toString()}`;
}

export function driverHref(id: string, season?: number): string {
	return season === undefined ? `/drivers/${id}` : `/drivers/${id}?season=${season}`;
}

export function standingsHref(season: number, round: number | null, teams: boolean): string {
	const params = new URLSearchParams({ season: String(season) });

	if (round !== null) {
		params.set('round', String(round));
	}

	if (teams) {
		params.set('view', 'teams');
	}

	return `/standings?${params.toString()}`;
}

const PRACTICE_SESSIONS = new Map<string, AskSession>([
	['Practice 1', 'practice_1'],
	['Practice 2', 'practice_2'],
	['Practice 3', 'practice_3']
]);

export function practiceOf(name: string): AskSession | null {
	return PRACTICE_SESSIONS.get(name) ?? null;
}

/** Every session there is of one kind, oldest first. */
export function sessionsOf(data: AskData, type: AskSession): AskSessionInfo[] {
	if (type.startsWith('practice')) {
		return (data.catalog ? sessionEntries(data.catalog) : []).flatMap((entry): AskSessionInfo[] =>
			/Grand Prix/.test(entry.meeting.name) && practiceOf(entry.session.name ?? '') === type
				? [
						{
							key: entry.key,
							season: entry.year,
							round:
								data.seasons
									.find((season) => season.season === entry.year)
									?.rounds.find((round) => round.meetingKey === entry.meeting.key)?.round ?? null,
							event: eventIdOf(entry.meeting.name),
							eventName: `${eventShortName(entry.meeting.name)} GP`,
							type,
							name: entry.session.name,
							startsAt: entry.session.startsAt,
							results: null
						}
					]
				: []
		);
	}

	return data.seasons.flatMap((season) =>
		season.rounds.flatMap((round) =>
			round.sessions
				.filter((session) => session.type === type)
				.map((session) => ({
					key: String(session.key),
					season: season.season,
					round: round.round,
					event: eventIdOf(round.name),
					eventName: `${eventShortName(round.name)} GP`,
					type,
					name: session.name,
					startsAt: session.startsAt,
					results: session
				}))
		)
	);
}

/** The session open on screen, as a question sees it. */
export function openSession(data: AskData): AskSessionInfo | null {
	const entry = data.catalog
		? sessionEntries(data.catalog).find((candidate) => candidate.key === data.openKey)
		: undefined;

	if (!entry) {
		return null;
	}

	const type =
		entry.session.type === 'practice' ? practiceOf(entry.session.name) : entry.session.type;

	if (type === null) {
		return null;
	}

	return (
		sessionsOf(data, type).find((info) => info.key === entry.key) ?? {
			key: entry.key,
			season: entry.year,
			round: null,
			event: eventIdOf(entry.meeting.name),
			eventName: `${eventShortName(entry.meeting.name)} GP`,
			type,
			name: entry.session.name,
			startsAt: entry.session.startsAt,
			results: null
		}
	);
}

/** The session a reference points at, or why there is none. */
export function findAskSession(
	data: AskData,
	ref: SessionRef
): { found: AskSessionInfo } | { missing: string } {
	if (ref.kind === 'open') {
		const open = openSession(data);

		return open ? { found: open } : { missing: 'No session is open.' };
	}

	const all = sessionsOf(data, ref.session);
	const started = all.filter((info) => Date.parse(info.startsAt) <= data.now);

	const matches = (info: AskSessionInfo) =>
		ref.kind === 'latest' ||
		(ref.kind === 'event'
			? info.event === ref.event && (ref.season === null || info.season === ref.season)
			: info.season === ref.season && info.round === ref.round);

	const found = started.findLast(matches);

	if (found) {
		return { found };
	}

	const upcoming = all.find(matches);

	return {
		missing: upcoming
			? `The ${sessionLabel(upcoming)} has not run yet.`
			: 'There is no such session in the data.'
	};
}

/** The seasons a span covers that have results, and how to say it. */
export type AskSpan = { seasons: SeasonResults[]; label: string; from: number; to: number };

export function spanOf(data: AskData, span: SeasonSpan): AskSpan {
	const first = data.seasons[0]?.season ?? data.context.season;
	const last = data.seasons.at(-1)?.season ?? data.context.season;
	const from = Math.max(span?.from ?? first, first);
	const to = Math.min(span?.to ?? last, last);
	const seasons = data.seasons.filter((season) => season.season >= from && season.season <= to);

	const label = from === to ? `in ${from}` : to >= last ? `since ${from}` : `from ${from} to ${to}`;

	return { seasons, label, from, to };
}

/** "1,454.5". */
export function formatPoints(points: number): string {
	return points.toLocaleString('en-GB', { maximumFractionDigits: 1 });
}

export function plural(count: number, one: string, many = `${one}s`): string {
	return `${count.toLocaleString('en-GB')} ${count === 1 ? one : many}`;
}
