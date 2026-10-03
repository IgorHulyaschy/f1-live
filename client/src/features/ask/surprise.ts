import { type Query, questionText } from '@f1-live/shared/ask';
import type { SeasonResults } from '@f1-live/shared/results';

import { teamIdOf } from '../../insights/teams.ts';
import { eventIdOf } from './ask-context.ts';
import type { AskData } from './ask-data.ts';
import { answerQuery } from './answers.ts';

/** A question with its query, as the palette offers it. */
export type Suggestion = { text: string; query: Query };

type Random = () => number;

function pick<T>(items: readonly T[], random: Random): T | undefined {
	return items[Math.floor(random() * items.length)];
}

function counted(data: AskData, seasons: readonly SeasonResults[]) {
	return seasons.flatMap((season) =>
		season.rounds.flatMap((round) =>
			round.sessions
				.filter((session) => !data.held(String(session.key), session.startsAt))
				.map((session) => ({ season, round, session }))
		)
	);
}

/** Two drivers who shared a team in `season`'s first race, for a teammates question. */
function teammatesOf(season: SeasonResults, random: Random): [string, string] | null {
	const race = season.rounds[0]?.sessions.find((session) => session.type === 'race');
	const byTeam = new Map<string, string[]>();

	for (const row of race?.rows ?? []) {
		byTeam.set(teamIdOf(row.team), [...(byTeam.get(teamIdOf(row.team)) ?? []), row.driver]);
	}

	const pair = pick(
		[...byTeam.values()].filter((drivers) => drivers.length === 2),
		random
	);

	return pair?.[0] && pair[1] ? [pair[0], pair[1]] : null;
}

/** One question of a kind, at random over the seasons the viewer has seen. */
function candidate(data: AskData, random: Random): Query | null {
	const seasons = data.seasons.filter((season) => season.season < data.context.season);
	const season = pick(seasons.length > 0 ? seasons : data.seasons, random);

	if (!season) {
		return null;
	}

	const span = { from: season.season, to: season.season };
	const sessions = counted(data, [season]);

	switch (Math.floor(random() * 6)) {
		case 0: {
			return {
				kind: 'standings',
				table: random() < 0.5 ? 'drivers' : 'teams',
				season: season.season,
				after: null
			};
		}

		case 1: {
			const race = pick(
				sessions.filter((entry) => entry.session.type === 'race'),
				random
			);

			return race
				? {
						kind: 'result',
						session: {
							kind: 'round',
							season: season.season,
							round: race.round.round,
							session: 'race'
						},
						subject: null
					}
				: null;
		}

		case 2: {
			const pair = teammatesOf(season, random);

			return pair
				? {
						kind: 'h2h',
						a: { kind: 'driver', id: pair[0] },
						b: { kind: 'driver', id: pair[1] },
						seasons: span,
						teammates: true,
						focus: random() < 0.5 ? 'qualifying' : null
					}
				: null;
		}

		case 3: {
			const winner = pick(
				sessions.flatMap((entry) =>
					entry.session.type === 'race' ? entry.session.rows.slice(0, 3) : []
				),
				random
			);

			return winner
				? {
						kind: 'record',
						subject: { kind: 'driver', id: winner.driver },
						stat: pick(['wins', 'podiums', 'poles', 'summary'] as const, random) ?? 'wins',
						seasons: span
					}
				: null;
		}

		case 4: {
			return {
				kind: 'leaders',
				table: 'drivers',
				stat: pick(['laps_led', 'fastest_laps', 'poles', 'dnfs'] as const, random) ?? 'laps_led',
				seasons: random() < 0.5 ? span : null
			};
		}

		default: {
			return {
				kind: 'leaders',
				table: 'teams',
				stat: pick(['wins', 'podiums', 'poles'] as const, random) ?? 'wins',
				seasons: span
			};
		}
	}
}

/**
 * "Surprise me": a question picked at random whose answer is true, shown and checkable, from the
 * seasons the viewer has seen. Null only when nothing can be answered yet.
 */
export function surprise(data: AskData, random: Random = Math.random): Suggestion | null {
	for (let attempt = 0; attempt < 12; attempt++) {
		const query = candidate(data, random);

		if (query && answerQuery(data, query, null).kind === 'answer') {
			return { text: questionText(query, data.context), query };
		}
	}

	return null;
}

/**
 * Questions to start from, a fresh set each time the palette opens: they name no result, so
 * they spoil nothing, and each one parses.
 */
export function examples(data: AskData, random: Random = Math.random, count = 4): Suggestion[] {
	const latest = data.seasons.at(-1);
	const past = data.seasons.filter((season) => season.season < data.context.season);
	const event = pick(latest?.rounds ?? [], random);
	const pair = latest ? teammatesOf(latest, random) : null;
	const driver = pair?.[0];
	const older = pick(past, random);

	const queries: Query[] = [
		{ kind: 'insight', insight: 'fastest_lap', session: { kind: 'open' }, subject: null },
		{ kind: 'result', session: { kind: 'latest', session: 'qualifying' }, subject: null },
		{ kind: 'standings', table: 'teams', season: data.context.season, after: null },
		{
			kind: 'insight',
			insight: 'pit_stops',
			session: { kind: 'latest', session: 'race' },
			subject: null
		},
		...(pair
			? [
					{
						kind: 'h2h',
						a: { kind: 'driver', id: pair[0] },
						b: { kind: 'driver', id: pair[1] },
						seasons: { from: data.context.season, to: data.context.season },
						teammates: false,
						focus: 'qualifying'
					} satisfies Query
				]
			: []),
		...(driver
			? [
					{
						kind: 'record',
						subject: { kind: 'driver', id: driver },
						stat: 'summary',
						seasons: null
					} satisfies Query
				]
			: []),
		...(event
			? [
					{
						kind: 'result',
						session: { kind: 'event', event: eventIdOf(event.name), season: null, session: 'race' },
						subject: null
					} satisfies Query
				]
			: []),
		...(older
			? [
					{
						kind: 'leaders',
						table: 'drivers',
						stat: 'poles',
						seasons: { from: older.season, to: older.season }
					} satisfies Query
				]
			: [])
	];

	return queries
		.map((query) => ({ query, order: random() }))
		.toSorted((a, b) => a.order - b.order)
		.slice(0, count)
		.map(({ query }) => ({ text: questionText(query, data.context), query }));
}
