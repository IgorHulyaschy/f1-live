import { ageOfDriver, youngestRaceWinner } from '@f1-live/shared/answers';
import type { Query } from '@f1-live/shared/ask';
import { type Decision, describeDecision, type SeasonDecisions } from '@f1-live/shared/decisions';
import type { Facts } from '@f1-live/shared/facts';
import type { SeasonResults } from '@f1-live/shared/results';

import { plural } from '../../lib/format.ts';
import type { AskOutcome } from './answers.ts';
import { eventIdOf, eventShortName, labelOf } from './ask-context.ts';
import {
	type AskData,
	driverHref,
	endWithStop,
	type HeldSession,
	type Rich,
	spanOf
} from './ask-data.ts';

/** The stewards' documents and the Wikidata facts, loaded only for the questions that need them. */
export type Stewards =
	| { status: 'loading' }
	| { status: 'error'; message: string }
	| { status: 'ready'; decisions: readonly SeasonDecisions[]; facts: Facts | null };

export const STEWARDS_LOADING: Stewards = { status: 'loading' };

export type StewardsQuery = Extract<Query, { kind: 'penalties' | 'age' | 'youngest_winner' }>;

export function isStewardsQuery(query: Query | null): query is StewardsQuery {
	return query?.kind === 'penalties' || query?.kind === 'age' || query?.kind === 'youngest_winner';
}

const MAX_ROWS = 8;

const DATE = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' });

/** The session whose result a decision could give away: its own, or its weekend's race. */
function sessionOfDecision(
	data: AskData,
	decision: Decision
): { key: string; startsAt: string; label: string } | null {
	for (const season of data.seasons) {
		for (const round of season.rounds) {
			const race = round.sessions.find((session) => session.type === 'race');
			const own = round.sessions.find((session) => session.key === decision.sessionKey);

			const session =
				own ??
				(decision.sessionKey === null && round.meetingKey === decision.meetingKey ? race : null);

			if (session) {
				return {
					key: String(session.key),
					startsAt: session.startsAt,
					label: `${season.season} ${eventShortName(round.name)} GP ${session.name}`
				};
			}
		}
	}

	return null;
}

const link = (decision: Decision) => ({ text: describeDecision(decision), href: decision.url });

function penaltiesAnswer(
	data: AskData,
	query: Extract<Query, { kind: 'penalties' }>,
	decisions: readonly SeasonDecisions[]
): AskOutcome {
	const name = labelOf(data.context, 'driver', query.subject.id);
	const span = spanOf(data, query.seasons);

	const own = decisions
		.filter((entry) => entry.season >= span.from && entry.season <= span.to)
		.flatMap((entry) => entry.decisions)
		.filter((decision) => decision.driver === query.subject.id)
		.filter((decision) =>
			query.event === null
				? decision.outcome === 'penalty'
				: eventIdOf(decision.event) === query.event
		);

	// Without a season, "at Las Vegas" means the latest edition the driver has a document at.
	const season =
		query.event !== null && query.seasons === null
			? Math.max(0, ...own.map((decision) => decision.season))
			: null;

	const wanted = (
		season === null ? own : own.filter((decision) => decision.season === season)
	).toSorted(
		(a, b) =>
			Number(b.outcome === 'penalty') - Number(a.outcome === 'penalty') ||
			b.publishedAt.localeCompare(a.publishedAt)
	);

	if (wanted.length === 0) {
		return {
			kind: 'missing',
			message: `No stewards' decision is on file for ${name}${query.event === null ? ` ${span.label}` : ` at ${labelOf(data.context, 'event', query.event)}`}.`
		};
	}

	const shown: Decision[] = [];
	const held = new Map<string, HeldSession>();
	let unplaced = 0;

	for (const decision of wanted) {
		const where = sessionOfDecision(data, decision);

		if (where === null) {
			unplaced++;
		} else if (data.held(where.key, where.startsAt)) {
			held.set(where.key, where);
		} else {
			shown.push(decision);
		}
	}

	const [first] = shown;

	if (!first) {
		return held.size > 0
			? { kind: 'held', sessions: [...held.values()] }
			: {
					kind: 'missing',
					message: `The archive cannot place ${plural(unplaced, 'decision')} of ${name} in a session yet.`
				};
	}

	const headline: Rich =
		query.event === null
			? [
					{
						text: name,
						href: driverHref(query.subject.id, span.from === span.to ? span.from : undefined)
					},
					` has ${plural(shown.length, 'penalty', 'penalties')} ${span.label}: `,
					link(first)
				]
			: [
					{ text: name, href: driverHref(query.subject.id, first.season) },
					` at the ${first.season} ${first.event}: `,
					link(first)
				];

	const note =
		unplaced > 0 ? ` ${plural(unplaced, 'document')} could not be placed in a session.` : '';

	return {
		kind: 'answer',
		headline,
		detail: first.infringement
			? [`${endWithStop(first.infringement)}${note}`]
			: note === ''
				? null
				: [note.trim()],
		visual:
			shown.length > 1
				? {
						kind: 'table',
						columns: ['Race', 'Decision'],
						rows: shown.slice(0, MAX_ROWS).map((decision) => ({
							cells: [`${decision.season} ${decision.event}`, describeDecision(decision)],
							href: decision.url,
							colour: null,
							mark: false
						}))
					}
				: null,
		source: `FIA stewards' documents, ${plural(shown.length, 'decision')}`,
		proof: { label: `Open the FIA document: ${first.title}`, href: first.url },
		hidden: [...held.values()]
	};
}

function ageAnswer(
	data: AskData,
	query: Extract<Query, { kind: 'age' }>,
	facts: Facts | null
): AskOutcome {
	const name = labelOf(data.context, 'driver', query.subject.id);
	const age = facts ? ageOfDriver(facts, query.subject.id, new Date(data.now)) : null;

	if (age === null) {
		return { kind: 'missing', message: `Wikidata holds no birth date for ${name}.` };
	}

	const place = facts?.drivers[query.subject.id]?.birthPlace;

	return {
		kind: 'answer',
		headline: [
			{ text: name, href: driverHref(query.subject.id) },
			` is ${plural(age.age, 'year')} old`
		],
		detail: [
			`Born ${DATE.format(new Date(age.birthDate))}${place ? ` in ${place}` : ''}, per `,
			{ text: 'Wikidata', href: age.proof },
			'.'
		],
		visual: null,
		source: 'Wikidata birth date (CC0)',
		proof: { label: 'Open the birth date on Wikidata', href: age.proof },
		hidden: []
	};
}

function youngestAnswer(
	data: AskData,
	query: Extract<Query, { kind: 'youngest_winner' }>,
	facts: Facts | null
): AskOutcome {
	if (facts === null) {
		return { kind: 'missing', message: 'There are no birth dates to compare.' };
	}

	const span = spanOf(data, query.seasons);
	const hidden: HeldSession[] = [];

	const counted: SeasonResults[] = span.seasons.map((season) => ({
		...season,
		rounds: season.rounds.map((round) => ({
			...round,
			sessions: round.sessions.filter((session) => {
				const held = data.held(String(session.key), session.startsAt);

				if (held && session.type === 'race') {
					hidden.push({
						key: String(session.key),
						startsAt: session.startsAt,
						label: `${season.season} ${eventShortName(round.name)} GP ${session.name}`
					});
				}

				return !held;
			})
		}))
	}));

	const winner = youngestRaceWinner(counted, facts, span.from);

	if (winner === null) {
		return hidden.length > 0
			? { kind: 'held', sessions: hidden }
			: { kind: 'missing', message: `No race winner has a known birth date ${span.label}.` };
	}

	return {
		kind: 'answer',
		headline: [
			{ text: labelOf(data.context, 'driver', winner.driver), href: driverHref(winner.driver) },
			` was ${plural(winner.ageYears, 'year')} old when winning the ${winner.season} ${eventShortName(winner.event)} GP`
		],
		detail: [
			`The youngest race winner ${span.label}, born ${DATE.format(new Date(winner.birthDate))}, per `,
			{ text: 'Wikidata', href: winner.proof },
			'.'
		],
		visual: null,
		source: `Race winners ${span.label} and Wikidata birth dates (CC0)`,
		proof: { label: 'Open the birth date on Wikidata', href: winner.proof },
		hidden
	};
}

/** The answer to a penalty, age or youngest-winner question, from the loaded documents and facts. */
export function stewardsAnswer(
	data: AskData,
	query: StewardsQuery,
	stewards: Stewards
): AskOutcome {
	if (stewards.status === 'loading') {
		return {
			kind: 'loading',
			label: query.kind === 'penalties' ? "the stewards' documents" : 'Wikidata'
		};
	}

	if (stewards.status === 'error') {
		return { kind: 'missing', message: `The documents did not load: ${stewards.message}` };
	}

	switch (query.kind) {
		case 'penalties': {
			return penaltiesAnswer(data, query, stewards.decisions);
		}

		case 'age': {
			return ageAnswer(data, query, stewards.facts);
		}

		case 'youngest_winner': {
			return youngestAnswer(data, query, stewards.facts);
		}
	}
}
