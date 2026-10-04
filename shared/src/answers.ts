import type { Decision, SeasonDecisions } from './decisions.ts';
import { ageOn, type DriverFacts, type Facts } from './facts.ts';
import type { SeasonResults } from './results.ts';

/** Where a fact's answer can be checked. */
export const wikidataUrl = (id: string): string => `https://www.wikidata.org/wiki/${id}`;

export interface AgeAnswer {
	driver: string;
	age: number;
	birthDate: string;
	/** The Wikidata page the birth date comes from. */
	proof: string;
}

const DAY_MS = 86_400_000;

function birthDateOf(facts: DriverFacts | undefined): string | null {
	return facts?.birthDate ?? null;
}

/** How old a driver is on `on`, with the page that holds the birth date; null when no date is known. */
export function ageOfDriver(facts: Facts, driver: string, on: Date): AgeAnswer | null {
	const known = facts.drivers[driver];
	const birthDate = birthDateOf(known);

	if (known === undefined || birthDate === null) {
		return null;
	}

	return { driver, age: ageOn(birthDate, on), birthDate, proof: wikidataUrl(known.wikidata) };
}

export interface YoungestWinner {
	driver: string;
	/** The winning race. */
	season: number;
	round: number;
	event: string;
	sessionKey: number;
	ageYears: number;
	/** Days lived on the race day; the measure the winners are ranked by. */
	ageDays: number;
	birthDate: string;
	proof: string;
}

/**
 * The youngest driver to win a race (not a sprint) in the seasons from `since` on, measured on the
 * race day. Winners without a known birth date cannot be placed and are skipped.
 */
export function youngestRaceWinner(
	seasons: readonly SeasonResults[],
	facts: Facts,
	since: number
): YoungestWinner | null {
	let best: YoungestWinner | null = null;

	for (const season of seasons) {
		if (season.season < since) {
			continue;
		}

		for (const round of season.rounds) {
			const race = round.sessions.find((session) => session.type === 'race');
			const winner = race?.rows.find((row) => row.position === 1 && row.classified);
			const known = winner === undefined ? undefined : facts.drivers[winner.driver];
			const birthDate = birthDateOf(known);

			if (race === undefined || winner === undefined || known === undefined || birthDate === null) {
				continue;
			}

			const day = new Date(race.startsAt);
			const lived = Math.floor((day.getTime() - Date.parse(birthDate)) / DAY_MS);

			if (best === null || lived < best.ageDays) {
				best = {
					driver: winner.driver,
					season: season.season,
					round: round.round,
					event: round.name,
					sessionKey: race.key,
					ageYears: ageOn(birthDate, day),
					ageDays: lived,
					birthDate,
					proof: wikidataUrl(known.wikidata)
				};
			}
		}
	}

	return best;
}

/** The decisions that penalised `driver`, newest first, optionally of one season. */
export function penaltiesOf(
	seasons: readonly SeasonDecisions[],
	driver: string,
	season?: number
): Decision[] {
	return seasons
		.filter((entry) => season === undefined || entry.season === season)
		.flatMap((entry) => entry.decisions)
		.filter((decision) => decision.driver === driver && decision.outcome === 'penalty')
		.toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
