import type { AskContext, AskEntity } from '@f1-live/shared/ask';
import type { SeasonResults } from '@f1-live/shared/results';

import type { Catalog } from '../../data/catalog.ts';
import { teamIdOf, teamLineName } from '../../insights/teams.ts';

/** Grands prix that were renamed but ran at the same place, by the id of their current name. */
const EVENT_LINES = new Map([
	['brazilian', 'sao-paulo'],
	['mexican', 'mexico-city']
]);

/** What fans call them that the data does not spell out. */
const EVENT_ALIASES = new Map<string, readonly string[]>([
	['las-vegas', ['vegas']],
	['united-states', ['usa', 'cota']],
	['sao-paulo', ['brazil', 'interlagos']],
	['emilia-romagna', ['imola']],
	['saudi-arabian', ['saudi']],
	['abu-dhabi', ['yas marina']],
	['mexico-city', ['mexico']]
]);

const TEAM_ALIASES = new Map<string, readonly string[]>([
	['red-bull', ['red bull', 'rbr', 'redbull']],
	['mercedes', ['merc', 'silver arrows']],
	['aston-martin', ['aston', 'amr']],
	['racing-bulls', ['vcarb', 'alphatauri', 'toro rosso', 'rb']],
	['sauber', ['alfa romeo', 'kick sauber', 'stake', 'audi']],
	['alpine', ['renault']],
	['ferrari', ['scuderia']]
]);

const DRIVER_NICKNAMES = new Map<string, readonly string[]>([
	['sergio-perez', ['checo']],
	['kevin-magnussen', ['kmag']],
	['nico-hulkenberg', ['hulk']],
	['sebastian-vettel', ['seb']],
	['fernando-alonso', ['nando']],
	['kimi-raikkonen', ['iceman']]
]);

/** A grand prix's short name: "Italian" for "Italian Grand Prix". */
export function eventShortName(name: string): string {
	return name.replace(/ Grand Prix$/, '').replace(/^Grand Prix (de |of )?/, '');
}

/** A grand prix's id across seasons, from its name: "italian", "las-vegas", "sao-paulo". */
export function eventIdOf(name: string): string {
	const slug = eventShortName(name)
		.normalize('NFD')
		.replaceAll(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, '-')
		.replaceAll(/^-|-$/g, '');

	return EVENT_LINES.get(slug) ?? slug;
}

/** The latest season whose first race has started: what "this season" means. */
export function currentSeason(seasons: readonly SeasonResults[], now: number): number {
	const started = seasons.filter((season) =>
		season.rounds.some((round) => Date.parse(round.startsAt) <= now)
	);

	return started.at(-1)?.season ?? new Date(now).getUTCFullYear();
}

function addNames(
	entities: Map<string, AskEntity & { names: string[] }>,
	id: string,
	names: readonly string[]
) {
	const entity = entities.get(id);

	if (entity) {
		for (const name of names) {
			if (!entity.names.includes(name)) {
				entity.names.push(name);
			}
		}
	}
}

/**
 * The names a question can use, from the seasons loaded and the catalog: every driver since 2018
 * (newest first, so "Kimi" is Antonelli), every team line and every grand prix with its town,
 * circuit and country.
 */
export function buildAskContext(
	seasons: readonly SeasonResults[],
	catalog: Catalog | null,
	now: number
): AskContext {
	const newestFirst = seasons.toSorted((a, b) => b.season - a.season);
	const drivers = new Map<string, AskEntity & { names: string[] }>();
	const teams = new Map<string, AskEntity & { names: string[] }>();
	const events = new Map<string, AskEntity & { names: string[] }>();

	for (const season of newestFirst) {
		for (const [id, driver] of Object.entries(season.drivers)) {
			if (!drivers.has(id)) {
				drivers.set(id, {
					kind: 'driver',
					id,
					label: driver.lastName,
					names: [],
					codes: [driver.code]
				});
			}

			addNames(drivers, id, [
				`${driver.firstName} ${driver.lastName}`,
				driver.lastName,
				driver.firstName,
				...(DRIVER_NICKNAMES.get(id) ?? [])
			]);
		}

		for (const name of Object.keys(season.teams)) {
			const id = teamIdOf(name);

			if (!teams.has(id)) {
				teams.set(id, { kind: 'team', id, label: teamLineName(id, name), names: [] });
			}

			addNames(teams, id, [teamLineName(id, name), name, ...(TEAM_ALIASES.get(id) ?? [])]);
		}

		for (const round of season.rounds) {
			const id = eventIdOf(round.name);
			const short = eventShortName(round.name);

			if (!events.has(id)) {
				events.set(id, { kind: 'event', id, label: `${short} GP`, names: [] });
			}

			addNames(events, id, [
				round.name,
				short,
				`${short} GP`,
				round.location,
				round.circuit,
				...(EVENT_ALIASES.get(id) ?? [])
			]);
		}
	}

	const meetings = (catalog?.seasons.toReversed() ?? []).flatMap((season) =>
		season.meetings.filter((meeting) => /Grand Prix/.test(meeting.name))
	);

	// A country names a grand prix only when it hosts no other: "Italy" was Monza and Imola.
	const hosts = new Map<string, Set<string>>();

	for (const meeting of meetings) {
		for (const session of meeting.sessions) {
			hosts.set(
				session.country.name,
				(hosts.get(session.country.name) ?? new Set()).add(eventIdOf(meeting.name))
			);
		}
	}

	for (const meeting of meetings) {
		const id = eventIdOf(meeting.name);
		const short = eventShortName(meeting.name);

		if (!events.has(id)) {
			events.set(id, { kind: 'event', id, label: `${short} GP`, names: [] });
		}

		addNames(events, id, [
			meeting.name,
			short,
			`${short} GP`,
			meeting.location,
			...meeting.sessions.flatMap((session) =>
				hosts.get(session.country.name)?.size === 1
					? [session.circuit, session.country.name]
					: [session.circuit]
			)
		]);
	}

	return {
		entities: [...drivers.values(), ...teams.values(), ...events.values()],
		season: currentSeason(seasons, now)
	};
}

/** The name an entity of the context goes by, or the id when it is not there. */
export function labelOf(context: AskContext, kind: AskEntity['kind'], id: string): string {
	return context.entities.find((entity) => entity.kind === kind && entity.id === id)?.label ?? id;
}
