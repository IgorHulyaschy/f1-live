import type {
	ResultRound,
	ResultRow,
	SeasonResults,
	SessionFilter,
	SessionResults,
	StandingEntry
} from '@f1-live/shared/results';
import { driverStandings } from '@f1-live/shared/results';

import type { Face, TeamSubject } from '../lib/media.ts';

function rowOf(session: SessionResults, driver: string): ResultRow | undefined {
	return session.rows.find((row) => row.driver === driver);
}

/** The rounds that have a race or sprint result `include` lets through. */
export function scoredRounds(
	season: SeasonResults,
	include: SessionFilter = () => true
): ResultRound[] {
	return season.rounds.filter((round) =>
		round.sessions.some(
			(session) => (session.type === 'race' || session.type === 'sprint') && include(session.key)
		)
	);
}

/** Each driver's team in their latest race or sprint up to `throughRound`. */
export function latestTeams(season: SeasonResults, throughRound = Infinity): Map<string, string> {
	const teams = new Map<string, string>();

	for (const round of season.rounds) {
		for (const session of round.round <= throughRound ? round.sessions : []) {
			for (const row of session.rows) {
				teams.set(row.driver, row.team);
			}
		}
	}

	return teams;
}

/** Each driver's team and race number as of their latest session through a round. */
export function latestEntries(
	season: SeasonResults,
	throughRound = Infinity
): Map<string, { team: string; number: string }> {
	const entries = new Map<string, { team: string; number: string }>();

	for (const round of season.rounds) {
		for (const session of round.round <= throughRound ? round.sessions : []) {
			for (const row of session.rows) {
				entries.set(row.driver, { team: row.team, number: row.number });
			}
		}
	}

	return entries;
}

/** Places moved since the round before, by driver id; absent for a driver new to the table. */
export function standingsMoves(
	season: SeasonResults,
	throughRound: number,
	include: SessionFilter = () => true
): Map<string, number> {
	const rounds = scoredRounds(season, include).filter((round) => round.round < throughRound);
	const previous = rounds.at(-1);

	if (!previous) {
		return new Map();
	}

	const before = new Map(
		driverStandings(season, previous.round, include).map((entry) => [entry.id, entry.position])
	);

	return new Map(
		driverStandings(season, throughRound, include).flatMap((entry): [string, number][] => {
			const was = before.get(entry.id);

			return was === undefined ? [] : [[entry.id, was - entry.position]];
		})
	);
}

/** A driver's season: their numbers and where they ended up. */
export type SeasonSummary = {
	season: number;
	teams: string[];
	races: number;
	wins: number;
	podiums: number;
	poles: number;
	points: number;
	/** Place in the drivers' standings over the sessions counted. */
	position: number | null;
	bestFinish: number | null;
};

/** One weekend of a driver's: their row in each session. */
export type DriverWeekend = {
	season: number;
	round: ResultRound;
	qualifying: ResultRow | null;
	sprint: ResultRow | null;
	race: ResultRow | null;
	sessions: { qualifying?: SessionResults; sprint?: SessionResults; race?: SessionResults };
};

/** Every weekend a driver took part in, oldest first. */
export function driverWeekends(
	seasons: readonly SeasonResults[],
	driver: string,
	include: SessionFilter = () => true
): DriverWeekend[] {
	return seasons.flatMap((season) =>
		season.rounds.flatMap((round): DriverWeekend[] => {
			const find = (type: SessionResults['type']) =>
				round.sessions.find((session) => session.type === type && include(session.key));

			const sessions = {
				qualifying: find('qualifying'),
				sprint: find('sprint'),
				race: find('race')
			};

			const qualifying = sessions.qualifying ? (rowOf(sessions.qualifying, driver) ?? null) : null;
			const sprint = sessions.sprint ? (rowOf(sessions.sprint, driver) ?? null) : null;
			const race = sessions.race ? (rowOf(sessions.race, driver) ?? null) : null;

			return qualifying || sprint || race
				? [{ season: season.season, round, qualifying, sprint, race, sessions }]
				: [];
		})
	);
}

/** A driver's seasons, each summed up, oldest first. */
export function seasonSummaries(
	seasons: readonly SeasonResults[],
	driver: string,
	include: SessionFilter = () => true
): SeasonSummary[] {
	return seasons.flatMap((season): SeasonSummary[] => {
		const weekends = driverWeekends([season], driver, include);

		if (weekends.length === 0) {
			return [];
		}

		const races = weekends.flatMap((weekend) => (weekend.race ? [weekend.race] : []));
		const finished = races.filter((row) => row.classified);

		const standing: StandingEntry | undefined = driverStandings(season, Infinity, include).find(
			(entry) => entry.id === driver
		);

		return [
			{
				season: season.season,
				teams: [
					...new Set(
						weekends.flatMap((weekend) =>
							[weekend.race, weekend.qualifying].flatMap((row) => (row ? [row.team] : []))
						)
					)
				],
				races: races.length,
				wins: finished.filter((row) => row.position === 1).length,
				podiums: finished.filter((row) => row.position <= 3).length,
				poles: weekends.filter((weekend) => weekend.qualifying?.position === 1).length,
				points: standing?.points ?? 0,
				position: standing?.position ?? null,
				bestFinish: finished.length === 0 ? null : Math.min(...finished.map((row) => row.position))
			}
		];
	});
}

export type Teammate = { driver: string; team: string; seasons: number[]; sessions: number };

/** The drivers who shared a team with `driver` in a race or qualifying, latest first. */
export function teammates(seasons: readonly SeasonResults[], driver: string): Teammate[] {
	const found = new Map<string, Teammate>();

	for (const season of seasons) {
		for (const round of season.rounds) {
			for (const session of round.sessions) {
				const own = rowOf(session, driver);

				for (const row of own ? session.rows : []) {
					if (row.driver === driver || row.team !== own?.team) {
						continue;
					}

					const key = `${row.driver}:${row.team}`;

					const entry = found.get(key) ?? {
						driver: row.driver,
						team: row.team,
						seasons: [],
						sessions: 0
					};

					entry.sessions += 1;

					if (!entry.seasons.includes(season.season)) {
						entry.seasons.push(season.season);
					}

					found.set(key, entry);
				}
			}
		}
	}

	return [...found.values()].toSorted(
		(a, b) => (b.seasons.at(-1) ?? 0) - (a.seasons.at(-1) ?? 0) || b.sessions - a.sessions
	);
}

/** Everyone who raced or qualified in `seasons`, by id, with how many sessions: for search. */
export function allDrivers(seasons: readonly SeasonResults[]): Map<string, number> {
	const counts = new Map<string, number>();

	for (const season of seasons) {
		for (const round of season.rounds) {
			for (const session of round.sessions) {
				for (const row of session.rows) {
					counts.set(row.driver, (counts.get(row.driver) ?? 0) + 1);
				}
			}
		}
	}

	return counts;
}

/** A driver of a season as a picture subject: the season's own picture ids, so 2019 shows 2019. */
export function seasonFace(
	season: SeasonResults,
	id: string,
	entry: { team: string; number: string } | undefined
): Face {
	const info = season.drivers[id];
	const team = entry?.team ?? '';

	const face: Face = {
		number: entry?.number ?? '',
		team,
		teamColour: season.teams[team] ?? '888888',
		firstName: info?.firstName ?? id,
		lastName: info?.lastName ?? '',
		season: season.season
	};

	if (info?.imageId !== undefined) {
		face.imageId = info.imageId;
	}

	if (info?.headshotUrl !== undefined) {
		face.headshotUrl = info.headshotUrl;
	}

	return face;
}

/** A team of a season as a picture subject. */
export function seasonTeam(season: SeasonResults, team: string): TeamSubject {
	return { team, teamColour: season.teams[team] ?? '888888', season: season.season };
}
