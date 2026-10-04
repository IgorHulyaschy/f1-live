import {
	type Decision,
	type DecisionSession,
	type SeasonDecisions,
	seasonDecisionsSchema
} from '@f1-live/shared/decisions';
import { driverIdOf, type ResultRound, type SeasonResults } from '@f1-live/shared/results';

import type { ParsedDecision } from './decision-text.js';
import type { ListedDocument } from './listing.js';

export interface EventListing {
	/** The FIA's name for the event, from its page address. */
	event: string;
	documents: ListedDocument[];
}

/** The documents that carry a steward's call on a car or a team; the rest are procedure and data. */
const RELEVANT =
	/^(?:doc(?:ument)?\s*\d+\s*-\s*)?(?:corrected\s*-\s*)?(summons|infringement|offence|decision|correction)\b/i;

const NUMBERED = /^doc(?:ument)?\s*(\d+)\s*-\s*/i;

export function isDecisionTitle(title: string): boolean {
	return RELEVANT.test(title);
}

/** The FIA's names for events our results index names another way. */
const EVENT_ALIASES = new Map([
	['mexican', 'mexico city'],
	['brazilian', 'sao paulo'],
	['saudi arabia', 'saudi arabian'],
	['barcelona catalunya', 'barcelona']
]);

function eventKey(name: string): string {
	const plain = name
		.normalize('NFD')
		.replaceAll(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/\s+-\s+.*$/, '')
		.replace(/^formula \d+\s+/, '')
		.replace(/\s*grand prix$/, '')
		.replaceAll(/[^a-z0-9]+/g, ' ')
		.trim();

	return EVENT_ALIASES.get(plain) ?? plain;
}

/** "07.12.25 17:35" in the Paris time zone, as an ISO 8601 UTC time. */
export function publishedAtOf(published: string): string {
	const [day = 0, month = 0, year = 0, hour = 0, minute = 0] = published.split(/[ .:]/).map(Number);
	const local = Date.UTC(2000 + year, month - 1, day, hour, minute);

	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'Europe/Paris',
		hourCycle: 'h23',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric'
	}).formatToParts(new Date(local));

	const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);

	const shown = Date.UTC(
		part('year'),
		part('month') - 1,
		part('day'),
		part('hour'),
		part('minute')
	);

	return new Date(local - (shown - local)).toISOString();
}

interface SessionPlace {
	key: number | null;
	session: DecisionSession | null;
}

function sessionKeyOf(
	round: ResultRound,
	session: DecisionSession | null,
	publishedAt: string
): SessionPlace {
	if (session === 'practice') {
		return { key: null, session };
	}

	if (session !== null) {
		return { key: round.sessions.find((s) => s.type === session)?.key ?? null, session };
	}

	// A summons names no session; the last one that had started when it came out is the likeliest.
	const started = round.sessions.filter((s) => s.startsAt <= publishedAt);
	const last = started.at(-1);

	return { key: last?.key ?? null, session: last?.type ?? null };
}

function driverOf(
	results: SeasonResults | null,
	round: ResultRound | undefined,
	name: string | null,
	car: string | null
): string | null {
	if (name !== null) {
		const [first = '', ...rest] = name.split(/\s+/);
		const id = driverIdOf(first, rest.join(' '));

		if (results === null || results.drivers[id] !== undefined) {
			return id;
		}

		const last = driverIdOf('', rest.join(' '));

		const matches = Object.entries(results.drivers).filter(
			([, driver]) => driverIdOf('', driver.lastName) === last
		);

		if (matches.length === 1) {
			return matches[0]?.[0] ?? null;
		}
	}

	const row = round?.sessions.flatMap((s) => s.rows).find((r) => r.number === car);

	return row?.driver ?? null;
}

function slug(text: string): string {
	return text
		.normalize('NFD')
		.replaceAll(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, '-')
		.replaceAll(/^-|-$/g, '');
}

const fileOf = (url: string): string =>
	decodeURIComponent(url.split('/').pop() ?? url).replace(/\.pdf$/i, '');

/**
 * One season's decisions: the relevant documents of every event, matched to a round, session and
 * driver of the results index when it has them. `parsed` holds each read document by its address;
 * a missing or null entry keeps the document as `unreadable` with its title and address. A
 * document a correction replaces, or a later copy of the same call, is dropped.
 */
export function decisionsOf(
	season: number,
	listings: readonly EventListing[],
	parsed: ReadonlyMap<string, ParsedDecision | null>,
	results: SeasonResults | null
): SeasonDecisions {
	const rounds = new Map((results?.rounds ?? []).map((round) => [eventKey(round.name), round]));
	const decisions: Decision[] = [];

	for (const { event, documents } of listings) {
		const round = rounds.get(eventKey(event));
		const replaced = new Set<number>();
		const kept: Decision[] = [];

		for (const document of documents) {
			if (!isDecisionTitle(document.title)) {
				continue;
			}

			const read = parsed.get(document.url) ?? null;
			const titleNumber = Number(NUMBERED.exec(document.title)?.[1]) || null;
			const number = read?.document ?? titleNumber;
			const title = document.title.replace(NUMBERED, '');
			const replaces = Number(/replaces\s+doc(?:ument)?\s*(\d+)/i.exec(title)?.[1]);

			if (replaces > 0) {
				replaced.add(replaces);
			}

			const publishedAt = publishedAtOf(document.published);

			const where =
				round === undefined
					? { key: null, session: read?.session ?? null }
					: sessionKeyOf(round, read?.session ?? null, publishedAt);

			const car = read?.car ?? /\bCar\s+(\d+)/i.exec(title)?.[1] ?? null;

			kept.push({
				id: `${season}-${slug(event)}-${number ?? slug(fileOf(document.url))}`,
				season,
				event,
				meetingKey: round?.meetingKey ?? null,
				round: round?.round ?? null,
				sessionKey: where.key,
				session: where.session,
				document: number,
				title,
				url: document.url,
				publishedAt,
				outcome: read?.outcome ?? 'unreadable',
				car,
				driver: driverOf(results, round, read?.driverName ?? null, car),
				driverName: read?.driverName ?? null,
				team: read?.team ?? null,
				time: read?.time ?? null,
				fact: read?.fact ?? null,
				infringement: read?.infringement ?? null,
				decision: read?.decision ?? null,
				penalties: read?.penalties ?? []
			});
		}

		const latest = new Map<string, Decision>();

		for (const decision of kept.filter((d) => d.document === null || !replaced.has(d.document))) {
			const call = [
				decision.car,
				decision.time,
				decision.session,
				decision.fact,
				decision.outcome === 'investigation'
			].join('|');

			const earlier = latest.get(call);

			if (
				decision.fact === null ||
				earlier === undefined ||
				(earlier.document ?? 0) <= (decision.document ?? 0)
			) {
				latest.set(decision.fact === null ? decision.id : call, decision);
			}
		}

		decisions.push(...latest.values());
	}

	decisions.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

	return seasonDecisionsSchema.parse({ season, decisions });
}
