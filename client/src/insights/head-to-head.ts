import type {
	ResultRound,
	ResultRow,
	SeasonResults,
	SessionFilter,
	SessionResults
} from '@f1-live/shared/results';

import { teamIdOf } from './teams.ts';

/** Who is compared: a driver by id, or a team by its line across names (`teamIdOf`). */
export type Side = { kind: 'driver'; id: string } | { kind: 'team'; id: string };

/** A place in the calendar: a season and a round of it. */
export type RoundRef = { season: number; round: number };

export type H2HRange = { from: RoundRef; to: RoundRef };

/** One session both sides took part in, with each side's rows (a team has one per car). */
export type Meeting = {
	session: SessionResults;
	a: readonly ResultRow[];
	b: readonly ResultRow[];
};

/** One weekend both sides raced or qualified at. */
export type H2HEvent = {
	season: number;
	round: ResultRound;
	race: Meeting | null;
	qualifying: Meeting | null;
	sprint: Meeting | null;
	sprintQualifying: Meeting | null;
};

/** A side's numbers over the events. */
export type SideTotals = {
	races: number;
	wins: number;
	podiums: number;
	poles: number;
	/** Retirements short of the classification distance, cars counted one by one. */
	dnfs: number;
	points: number;
	/** Qualifying sessions with three parts the side reached the last of. */
	q3: number;
	fastestLaps: number;
	lapsLed: number;
	/** Classified finishes, for the averages. */
	finishes: number;
	averageGrid: number | null;
	averageFinish: number | null;
	/** Grid place minus finishing place over the classified finishes. */
	positionsGained: number;
	pointsPerRace: number;
	/** The best race finish and how often. */
	bestFinish: { position: number; times: number } | null;
};

export type Tally = { a: number; b: number };

/** The qualifying gap in one session both drivers of a team took part in. */
export type QualifyingGap = {
	event: H2HEvent;
	/** Driver A's time minus driver B's, ms: negative when A was quicker. */
	ms: number;
	/** The same gap as a share of B's time. */
	pct: number;
	/** The part both set a time in last, from 1. */
	part: number;
};

export type H2HTotals = {
	events: number;
	racesTogether: number;
	qualifying: Tally;
	race: Tally;
	sprint: Tally;
	sprintQualifying: Tally;
	a: SideTotals;
	b: SideTotals;
	/** Teammates only: each shared qualifying, in order. */
	gaps: QualifyingGap[];
	averageGapMs: number | null;
	medianGapMs: number | null;
	averageGapPct: number | null;
};

function compareRefs(a: RoundRef, b: RoundRef): number {
	return a.season - b.season || a.round - b.round;
}

export function inRange(ref: RoundRef, range: H2HRange): boolean {
	return compareRefs(ref, range.from) >= 0 && compareRefs(ref, range.to) <= 0;
}

/** The rows of `side` in a session. */
export function rowsOf(session: SessionResults, side: Side): ResultRow[] {
	return session.rows.filter((row) =>
		side.kind === 'driver' ? row.driver === side.id : teamIdOf(row.team) === side.id
	);
}

function meetingOf(
	round: ResultRound,
	type: SessionResults['type'],
	a: Side,
	b: Side,
	include: SessionFilter
): Meeting | null {
	const session = round.sessions.find((candidate) => candidate.type === type);

	if (!session || !include(session.key)) {
		return null;
	}

	const rowsA = rowsOf(session, a);
	const rowsB = rowsOf(session, b);

	return rowsA.length > 0 && rowsB.length > 0 ? { session, a: rowsA, b: rowsB } : null;
}

/** The weekends in `range` where both sides were in at least one session that `include` lets through. */
export function sharedEvents(
	seasons: readonly SeasonResults[],
	a: Side,
	b: Side,
	range: H2HRange,
	include: SessionFilter = () => true
): H2HEvent[] {
	return seasons.flatMap((season) =>
		season.rounds.flatMap((round): H2HEvent[] => {
			if (!inRange({ season: season.season, round: round.round }, range)) {
				return [];
			}

			const event: H2HEvent = {
				season: season.season,
				round,
				race: meetingOf(round, 'race', a, b, include),
				qualifying: meetingOf(round, 'qualifying', a, b, include),
				sprint: meetingOf(round, 'sprint', a, b, include),
				sprintQualifying: meetingOf(round, 'sprint_qualifying', a, b, include)
			};

			return event.race || event.qualifying || event.sprint || event.sprintQualifying
				? [event]
				: [];
		})
	);
}

/**
 * Sessions in `range` that `include` holds back and in which both sides took part: what revealing
 * them would add.
 */
export function hiddenSessions(
	seasons: readonly SeasonResults[],
	a: Side,
	b: Side,
	range: H2HRange,
	include: SessionFilter
): SessionResults[] {
	return seasons.flatMap((season) =>
		season.rounds.flatMap((round) =>
			inRange({ season: season.season, round: round.round }, range)
				? round.sessions.filter(
						(session) =>
							!include(session.key) &&
							rowsOf(session, a).length > 0 &&
							rowsOf(session, b).length > 0
					)
				: []
		)
	);
}

function best(rows: readonly ResultRow[]): ResultRow | null {
	return rows.reduce<ResultRow | null>(
		(top, row) => (top === null || row.position < top.position ? row : top),
		null
	);
}

/**
 * Who came out ahead in one session, by the better-placed car: in qualifying the higher grid
 * place; in a race or sprint the better finish, counted only when at least one of them was
 * classified (a classified car beats one that was not).
 */
export function winnerOf(meeting: Meeting): 'a' | 'b' | null {
	const a = best(meeting.a);
	const b = best(meeting.b);

	if (!a || !b) {
		return null;
	}

	const race = meeting.session.type === 'race' || meeting.session.type === 'sprint';

	if (race && !a.classified && !b.classified) {
		return null;
	}

	return a.position < b.position ? 'a' : 'b';
}

function tally(meetings: readonly (Meeting | null)[]): Tally {
	const result = { a: 0, b: 0 };

	for (const meeting of meetings) {
		const winner = meeting ? winnerOf(meeting) : null;

		if (winner) {
			result[winner] += 1;
		}
	}

	return result;
}

function average(values: readonly number[]): number | null {
	return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: readonly number[]): number | null {
	const sorted = values.toSorted((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);

	if (sorted.length === 0) {
		return null;
	}

	return sorted.length % 2 === 1
		? (sorted[middle] ?? null)
		: ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function sideTotals(events: readonly H2HEvent[], side: 'a' | 'b'): SideTotals {
	const races = events.flatMap((event) => (event.race ? [event.race[side]] : []));
	const sprints = events.flatMap((event) => (event.sprint ? [event.sprint[side]] : []));
	const qualifying = events.flatMap((event) => (event.qualifying ? [event.qualifying] : []));
	const raceRows = races.flat();
	const finished = raceRows.filter((row) => row.classified);
	const grids = raceRows.flatMap((row) => (row.grid ? [row.grid] : []));
	const bestPosition = Math.min(...finished.map((row) => row.position));
	const points = [...raceRows, ...sprints.flat()].reduce((sum, row) => sum + row.points, 0);

	return {
		races: races.length,
		wins: finished.filter((row) => row.position === 1).length,
		podiums: finished.filter((row) => row.position <= 3).length,
		poles: qualifying.filter((meeting) => meeting[side].some((row) => row.position === 1)).length,
		dnfs: raceRows.filter((row) => row.status === 'dnf' && !row.classified).length,
		points,
		q3: qualifying.filter(
			(meeting) =>
				(meeting[side][0]?.parts?.length ?? 0) >= 3 &&
				meeting[side].some((row) => row.position <= 10)
		).length,
		fastestLaps: raceRows.filter((row) => row.fastestLap).length,
		lapsLed: raceRows.reduce((sum, row) => sum + (row.lapsLed ?? 0), 0),
		finishes: finished.length,
		averageGrid: average(grids),
		averageFinish: average(finished.map((row) => row.position)),
		positionsGained: finished.reduce(
			(sum, row) => sum + (row.grid ? row.grid - row.position : 0),
			0
		),
		pointsPerRace: races.length === 0 ? 0 : points / races.length,
		bestFinish: Number.isFinite(bestPosition)
			? {
					position: bestPosition,
					times: finished.filter((row) => row.position === bestPosition).length
				}
			: null
	};
}

/** The quickest time of the last part both drivers set a time in. */
export function qualifyingGap(event: H2HEvent): QualifyingGap | null {
	const meeting = event.qualifying;
	const a = meeting?.a[0]?.parts;
	const b = meeting?.b[0]?.parts;

	if (!meeting || !a || !b || meeting.a.length !== 1 || meeting.b.length !== 1) {
		return null;
	}

	for (let part = Math.min(a.length, b.length) - 1; part >= 0; part--) {
		const timeA = a[part];
		const timeB = b[part];

		if (timeA !== null && timeA !== undefined && timeB !== null && timeB !== undefined) {
			return { event, ms: timeA - timeB, pct: ((timeA - timeB) / timeB) * 100, part: part + 1 };
		}
	}

	return null;
}

/** Sessions in which both drivers drove for the same team. */
export function asTeammates(event: H2HEvent): boolean {
	const meeting = event.qualifying ?? event.race;

	return meeting !== null && meeting.a[0]?.team === meeting.b[0]?.team;
}

/** The totals the comparison opens with, over `events` from `sharedEvents`. */
export function headToHead(events: readonly H2HEvent[], sides: { a: Side; b: Side }): H2HTotals {
	const gaps =
		sides.a.kind === 'driver'
			? events.flatMap((event) => {
					const gap = asTeammates(event) ? qualifyingGap(event) : null;

					return gap ? [gap] : [];
				})
			: [];

	return {
		events: events.length,
		racesTogether: events.filter((event) => event.race).length,
		qualifying: tally(events.map((event) => event.qualifying)),
		race: tally(events.map((event) => event.race)),
		sprint: tally(events.map((event) => event.sprint)),
		sprintQualifying: tally(events.map((event) => event.sprintQualifying)),
		a: sideTotals(events, 'a'),
		b: sideTotals(events, 'b'),
		gaps,
		averageGapMs: average(gaps.map((gap) => gap.ms)),
		medianGapMs: median(gaps.map((gap) => gap.ms)),
		averageGapPct: average(gaps.map((gap) => gap.pct))
	};
}

export type Breakdown = {
	/** A season as text, or a circuit's location. */
	id: string;
	label: string;
	events: H2HEvent[];
	totals: H2HTotals;
};

/** The totals per season, and per circuit (by its location), oldest season and A–Z circuit first. */
export function breakdowns(
	events: readonly H2HEvent[],
	sides: { a: Side; b: Side },
	by: 'season' | 'circuit'
): Breakdown[] {
	const groups = new Map<string, H2HEvent[]>();

	for (const event of events) {
		const id = by === 'season' ? String(event.season) : event.round.location;

		groups.set(id, [...(groups.get(id) ?? []), event]);
	}

	return [...groups]
		.map(([id, grouped]) => ({
			id,
			label: id,
			events: grouped,
			totals: headToHead(grouped, sides)
		}))
		.toSorted((x, y) => (by === 'season' ? Number(x.id) - Number(y.id) : x.id.localeCompare(y.id)));
}

/** The qualifying gap averaged over the last `window` sessions, for the trend chart. */
export function rollingGap(
	gaps: readonly QualifyingGap[],
	window = 5
): { gap: QualifyingGap; rollingPct: number }[] {
	return gaps.map((gap, index) => {
		const recent = gaps.slice(Math.max(0, index - window + 1), index + 1);

		return { gap, rollingPct: recent.reduce((sum, item) => sum + item.pct, 0) / recent.length };
	});
}
