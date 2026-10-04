import { z } from 'zod';

/**
 * The results index: one file per season (`out/results/<season>.json.gz`), written at import
 * time from the saved sessions, read by the calendar, standings, driver pages and head-to-head.
 */

/** Sessions that count for results; practice is left out. */
export const RESULT_SESSION_TYPES = ['race', 'sprint', 'qualifying', 'sprint_qualifying'] as const;

export type ResultSessionType = (typeof RESULT_SESSION_TYPES)[number];

/**
 * How a car ended a race or sprint: running at the flag (`finished`), running but short of 90% of
 * the winner's distance (`nc`), retired (`dnf`), never started (`dns`) or disqualified (`dsq`).
 * Qualifying rows are `finished`, or `dsq`.
 */
export const RESULT_STATUSES = ['finished', 'nc', 'dnf', 'dns', 'dsq'] as const;

export type ResultStatus = (typeof RESULT_STATUSES)[number];

const resultRowSchema = z.object({
	/** A driver id from `driverIdOf`, the same across seasons. */
	driver: z.string(),
	number: z.string(),
	team: z.string(),
	/** The order at the end: classified cars first, then the rest by laps, as the timing screen has it. */
	position: z.int().positive(),
	status: z.enum(RESULT_STATUSES),
	/** In the classification: covered 90% of the winner's laps and not disqualified; a car that retired after that is classified too. */
	classified: z.boolean(),
	/** Races and sprints: the starting place; null for a pit-lane start or no grid in the data. */
	grid: z.int().positive().nullable().optional(),
	laps: z.int().nonnegative(),
	/** Behind the winner on the same lap, ms; null when lapped or not classified. */
	gapMs: z.number().nullable().optional(),
	points: z.number(),
	bestLapMs: z.number().nullable(),
	/** A retired car (`dnf`): the lap it stopped on and the feed's signal for it ("Retired", "Stopped"). */
	retirement: z.object({ lap: z.int().positive(), reason: z.string() }).optional(),
	/** The session's fastest lap. */
	fastestLap: z.boolean().optional(),
	lapsLed: z.int().nonnegative().optional(),
	/** Qualifying: the best time in each part, ms; null where none was set. */
	parts: z.array(z.number().nullable()).optional()
});

export type ResultRow = z.infer<typeof resultRowSchema>;

const sessionResultsSchema = z.object({
	key: z.int(),
	type: z.enum(RESULT_SESSION_TYPES),
	name: z.string(),
	/** ISO 8601, UTC. */
	startsAt: z.string(),
	/** Races and sprints: the laps scheduled and the laps the winner ran. */
	scheduledLaps: z.int().optional(),
	leaderLaps: z.int().optional(),
	rows: z.array(resultRowSchema)
});

export type SessionResults = z.infer<typeof sessionResultsSchema>;

const roundSchema = z.object({
	/** From 1, counting the meetings with a race. */
	round: z.int().positive(),
	meetingKey: z.int(),
	name: z.string(),
	location: z.string(),
	circuit: z.string(),
	countryCode: z.string(),
	/** The race's start, ISO 8601 UTC. */
	startsAt: z.string(),
	/** The sessions with saved results, in the order they ran. */
	sessions: z.array(sessionResultsSchema)
});

export type ResultRound = z.infer<typeof roundSchema>;

const driverInfoSchema = z.object({
	code: z.string(),
	firstName: z.string(),
	lastName: z.string(),
	headshotUrl: z.string().optional(),
	/** The side-on cut-out's media id (`driverImageId`); absent where the host has none. */
	imageId: z.string().optional()
});

export type ResultDriver = z.infer<typeof driverInfoSchema>;

/** A constructors' points change the stewards or the FIA decided outside any session. */
const adjustmentSchema = z.object({
	team: z.string(),
	/** Counts in the standings from this round on. */
	round: z.int().positive(),
	points: z.number(),
	reason: z.string(),
	source: z.string()
});

export type ResultAdjustment = z.infer<typeof adjustmentSchema>;

export const seasonResultsSchema = z.object({
	season: z.int(),
	/** Each driver as last seen in the season. */
	drivers: z.record(z.string(), driverInfoSchema),
	/** Each team's colour, hex without "#". */
	teams: z.record(z.string(), z.string()),
	rounds: z.array(roundSchema),
	adjustments: z.array(adjustmentSchema)
});

export type SeasonResults = z.infer<typeof seasonResultsSchema>;

/** "DNF", with the lap the car stopped on where the feed said. */
export function dnfLabel(row: Pick<ResultRow, 'retirement'>): string {
	return row.retirement ? `DNF L${row.retirement.lap}` : 'DNF';
}

/** Names the timing feed has printed two ways for one driver, by the id of the other. */
const DRIVER_ALIASES = new Map([['andrea-kimi-antonelli', 'kimi-antonelli']]);

/**
 * A driver's id across seasons, from the name the timing feed prints: "Kimi Räikkönen" is
 * "kimi-raikkonen". Numbers and team change between seasons; the name does not.
 */
export function driverIdOf(firstName: string, lastName: string): string {
	const id = `${firstName} ${lastName}`
		.normalize('NFD')
		.replaceAll(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, '-')
		.replaceAll(/^-|-$/g, '');

	return DRIVER_ALIASES.get(id) ?? id;
}

/** A place in the drivers' or the constructors' standings. */
export interface StandingEntry {
	/** A driver id, or a team name as the timing feed printed it. */
	id: string;
	position: number;
	points: number;
	wins: number;
	podiums: number;
	/** Race finishing places, counted for the tie-break: `places[0]` is wins. */
	places: number[];
}

/** Which sessions count: by default all of them. */
export type SessionFilter = (key: number) => boolean;

function tally(
	season: SeasonResults,
	throughRound: number,
	include: SessionFilter,
	idOf: (row: ResultRow) => string
): Map<string, StandingEntry> {
	const table = new Map<string, StandingEntry>();

	for (const round of season.rounds) {
		if (round.round > throughRound) {
			continue;
		}

		for (const session of round.sessions) {
			if ((session.type !== 'race' && session.type !== 'sprint') || !include(session.key)) {
				continue;
			}

			for (const row of session.rows) {
				const id = idOf(row);

				const entry = table.get(id) ?? {
					id,
					position: 0,
					points: 0,
					wins: 0,
					podiums: 0,
					places: []
				};

				entry.points += row.points;

				if (session.type === 'race' && row.classified) {
					entry.places[row.position - 1] = (entry.places[row.position - 1] ?? 0) + 1;
					entry.wins += row.position === 1 ? 1 : 0;
					entry.podiums += row.position <= 3 ? 1 : 0;
				}

				table.set(id, entry);
			}
		}
	}

	return table;
}

/** More points first; a tie goes to more wins, then more second places, and so on. */
function ranked(entries: Iterable<StandingEntry>): StandingEntry[] {
	const countback = (a: StandingEntry, b: StandingEntry) => {
		for (let place = 0; place < Math.max(a.places.length, b.places.length); place++) {
			const difference = (b.places[place] ?? 0) - (a.places[place] ?? 0);

			if (difference !== 0) {
				return difference;
			}
		}

		return a.id.localeCompare(b.id);
	};

	return [...entries]
		.toSorted((a, b) => b.points - a.points || countback(a, b))
		.map((entry, index) => ({ ...entry, position: index + 1 }));
}

/** The drivers' standings after `throughRound` (the whole season by default). */
export function driverStandings(
	season: SeasonResults,
	throughRound = Infinity,
	include: SessionFilter = () => true
): StandingEntry[] {
	return ranked(tally(season, throughRound, include, (row) => row.driver).values());
}

/**
 * The constructors' standings after `throughRound`: every car's points, with the season's
 * adjustments from their round on.
 */
export function teamStandings(
	season: SeasonResults,
	throughRound = Infinity,
	include: SessionFilter = () => true
): StandingEntry[] {
	const table = tally(season, throughRound, include, (row) => row.team);

	for (const adjustment of season.adjustments) {
		const entry = table.get(adjustment.team);

		if (entry !== undefined && adjustment.round <= throughRound) {
			entry.points += adjustment.points;
		}
	}

	return ranked(table.values());
}
