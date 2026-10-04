import type { AskSession, AskStat, Query, Subject } from '@f1-live/shared/ask';
import type { RaceSnapshot } from '@f1-live/shared';
import {
	driverStandings,
	type ResultRow,
	type SeasonResults,
	type SessionResults,
	teamStandings
} from '@f1-live/shared/results';

import { h2hFacts } from '../../insights/h2h-facts.ts';
import {
	asTeammates,
	type H2HRange,
	headToHead,
	hiddenSessions,
	rowsOf,
	sharedEvents,
	type Side,
	type Tally
} from '../../insights/head-to-head.ts';
import { formatLocalStart, formatUntil, sessionEntries } from '../../data/catalog.ts';
import { scoredRounds } from '../../insights/season-results.ts';
import { teamIdOf, teamLineName } from '../../insights/teams.ts';
import { formatGap, formatLapTime } from '../../lib/format.ts';
import { eventIdOf, eventShortName, labelOf } from './ask-context.ts';
import {
	type AskData,
	type AnswerPicture,
	type AskSessionInfo,
	driverHref,
	findAskSession,
	formatPoints,
	type HeldSession,
	heldOf,
	pictureOf,
	plural,
	practiceOf,
	type Rich,
	sessionHref,
	sessionLabel,
	spanOf,
	standingsHref
} from './ask-data.ts';
import { insightAnswer } from './insight-answers.ts';
import { STEWARDS_LOADING, type Stewards, stewardsAnswer } from './steward-answers.ts';

export type Bar = {
	label: string;
	value: number;
	display: string;
	href: string;
	colour: string | null;
};

export type TableRow = {
	cells: readonly string[];
	href: string;
	colour: string | null;
	mark: boolean;
};

/** The small picture under an answer. */
export type Visual =
	{ kind: 'bars'; bars: Bar[] } | { kind: 'table'; columns: readonly string[]; rows: TableRow[] };

export type Answer = {
	kind: 'answer';
	headline: Rich;
	detail: Rich | null;
	visual: Visual | null;
	/** What it was computed from: "2024 Italian GP Race, 53 laps". */
	source: string;
	/** The view that shows the same numbers in full. */
	proof: { label: string; href: string };
	/** Sessions left out until the viewer reveals them. */
	hidden: HeldSession[];
	/** The driver or team the answer is about, where it is about one. */
	picture?: AnswerPicture | undefined;
};

export type AskOutcome =
	| Answer
	/** The answer is one session's result the viewer has not seen. */
	| { kind: 'held'; sessions: HeldSession[] }
	| { kind: 'missing'; message: string }
	/** The answer needs the session's saved data, which is not loaded yet. */
	| { kind: 'snapshot'; key: string; label: string }
	/** The answer needs documents that are still loading. */
	| { kind: 'loading'; label: string };

const STAT_NOUN: Record<Exclude<AskStat, 'summary'>, { one: string; many: string }> = {
	wins: { one: 'win', many: 'wins' },
	poles: { one: 'pole', many: 'poles' },
	podiums: { one: 'podium', many: 'podiums' },
	points: { one: 'point', many: 'points' },
	dnfs: { one: 'retirement', many: 'retirements' },
	fastest_laps: { one: 'fastest lap', many: 'fastest laps' },
	starts: { one: 'start', many: 'starts' },
	laps_led: { one: 'lap led', many: 'laps led' },
	q3: { one: 'Q3 appearance', many: 'Q3 appearances' }
};

type CountedStat = keyof typeof STAT_NOUN;

/** What one row adds to a stat. Points come from the standings, which also apply adjustments. */
function countOf(stat: CountedStat, session: SessionResults, row: ResultRow): number {
	const race = session.type === 'race';

	switch (stat) {
		case 'wins': {
			return race && row.classified && row.position === 1 ? 1 : 0;
		}

		case 'poles': {
			return session.type === 'qualifying' && row.position === 1 ? 1 : 0;
		}

		case 'podiums': {
			return race && row.classified && row.position <= 3 ? 1 : 0;
		}

		case 'points': {
			return race || session.type === 'sprint' ? row.points : 0;
		}

		case 'dnfs': {
			return race && row.status === 'dnf' ? 1 : 0;
		}

		case 'fastest_laps': {
			return race && row.fastestLap ? 1 : 0;
		}

		case 'starts': {
			return race && row.status !== 'dns' ? 1 : 0;
		}

		case 'laps_led': {
			return race ? (row.lapsLed ?? 0) : 0;
		}

		case 'q3': {
			return session.type === 'qualifying' && row.position <= 10 ? 1 : 0;
		}
	}
}

function sideOf(subject: Subject): Side {
	return subject.kind === 'driver'
		? { kind: 'driver', id: subject.id }
		: { kind: 'team', id: subject.id };
}

function nameOf(data: AskData, subject: Subject): string {
	return labelOf(data.context, subject.kind, subject.id);
}

function subjectHref(subject: Subject, season: number | undefined, latest: number): string {
	return subject.kind === 'driver'
		? driverHref(subject.id, season)
		: standingsHref(season ?? latest, null, true);
}

function isCounted(data: AskData, session: SessionResults): boolean {
	return !data.held(String(session.key), session.startsAt);
}

/** Every session of `seasons` with its season, round and whether it counts. */
function allSessions(seasons: readonly SeasonResults[]) {
	return seasons.flatMap((season) =>
		season.rounds.flatMap((round) => round.sessions.map((session) => ({ season, round, session })))
	);
}

function heldSessions(
	data: AskData,
	entries: readonly { season: SeasonResults; round: { name: string }; session: SessionResults }[]
): HeldSession[] {
	return entries.flatMap((entry) =>
		isCounted(data, entry.session)
			? []
			: [
					{
						key: String(entry.session.key),
						startsAt: entry.session.startsAt,
						label: `${entry.season.season} ${eventShortName(entry.round.name)} GP ${entry.session.name}`
					}
				]
	);
}

function rowTime(session: SessionResults, row: ResultRow, leader: ResultRow | undefined): string {
	if (session.type === 'qualifying' || session.type === 'sprint_qualifying') {
		const best = row.parts?.findLast((part) => part !== null) ?? row.bestLapMs;

		return best ? formatLapTime(best) : 'No time';
	}

	if (row.status !== 'finished' && row.status !== 'nc') {
		return row.status.toUpperCase();
	}

	if (row.position === 1) {
		return plural(row.laps, 'lap');
	}

	if (row.gapMs !== null && row.gapMs !== undefined) {
		return formatGap(row.gapMs);
	}

	const down = (leader?.laps ?? row.laps) - row.laps;

	return down > 0 ? `+${plural(down, 'lap')}` : '';
}

function finishVerb(info: AskSessionInfo): string {
	return info.type === 'qualifying' || info.type === 'sprint_qualifying' ? 'qualified' : 'finished';
}

function resultAnswer(
	data: AskData,
	info: AskSessionInfo,
	results: SessionResults,
	subject: Subject | null
): AskOutcome {
	const season = data.seasons.find((entry) => entry.season === info.season);
	const colourOf = (row: ResultRow) => season?.teams[row.team] ?? null;
	const label = sessionLabel(info);
	const leader = results.rows[0];

	if (!leader) {
		return { kind: 'missing', message: `The ${label} has no classification.` };
	}

	const mine = subject ? rowsOf(results, sideOf(subject)) : [];

	if (subject && mine.length === 0) {
		return {
			kind: 'missing',
			message: `${nameOf(data, subject)} did not take part in the ${label}.`
		};
	}

	const name = (row: ResultRow) => labelOf(data.context, 'driver', row.driver);
	const car = (row: ResultRow) => ({ text: name(row), href: sessionHref(info.key, row.number) });

	const place = (row: ResultRow) => ({
		text:
			row.classified || row.status === 'finished' ? `P${row.position}` : row.status.toUpperCase(),
		href: sessionHref(info.key, row.number)
	});

	const headline: Rich =
		subject === null
			? info.type === 'qualifying'
				? [car(leader), ` took pole at the ${info.season} ${info.eventName}`]
				: info.type === 'sprint_qualifying'
					? [car(leader), ` took sprint pole at the ${info.season} ${info.eventName}`]
					: [car(leader), ` won the ${label}`]
			: mine.flatMap((row, index) => [
					...(index > 0 ? [' and '] : []),
					car(row),
					` ${row.status === 'dnf' ? 'retired, classified' : finishVerb(info)} `,
					place(row)
				]);

	const rows = results.rows.slice(0, 10);

	for (const row of mine) {
		if (!rows.includes(row)) {
			rows.push(row);
		}
	}

	const points = mine.reduce((sum, row) => sum + row.points, 0);

	return {
		kind: 'answer',
		headline: subject === null ? headline : [...headline, ` in the ${label}`],
		detail:
			subject !== null && points > 0
				? [`${plural(points, 'point')} scored.`]
				: info.type === 'race' && results.rows[1]
					? [
							car(results.rows[1]),
							' second, ',
							...(results.rows[2] ? [car(results.rows[2]), ' third.'] : [])
						]
					: null,
		visual: {
			kind: 'table',
			columns: ['Pos', 'Driver', 'Team', info.type.includes('qualifying') ? 'Time' : 'Gap'],
			rows: rows.map((row) => ({
				cells: [
					row.classified || row.status === 'finished' ? String(row.position) : '–',
					name(row),
					teamLineName(teamIdOf(row.team), row.team),
					rowTime(results, row, leader)
				],
				href: sessionHref(info.key, row.number),
				colour: colourOf(row),
				mark: mine.includes(row)
			}))
		},
		source: `${label}${results.leaderLaps ? `, ${plural(results.leaderLaps, 'lap')}` : ''}`,
		proof: {
			label: 'Open the session',
			href: sessionHref(info.key, mine.length === 1 ? mine[0]?.number : undefined)
		},
		hidden: []
	};
}

/** A season's table over the rounds the viewer has seen, through `asked` when given. */
function countedStandings(
	data: AskData,
	season: SeasonResults,
	teams: boolean,
	asked: number | null
) {
	const include = (key: number) => {
		const session = season.rounds
			.flatMap((round) => round.sessions)
			.find((entry) => entry.key === key);

		return session ? isCounted(data, session) : true;
	};

	const through = scoredRounds(season, include).findLast(
		(round) => asked === null || round.round <= asked
	);

	const hidden = heldSessions(
		data,
		allSessions([season]).filter(
			(entry) =>
				(entry.session.type === 'race' || entry.session.type === 'sprint') &&
				(asked === null || entry.round.round <= asked)
		)
	);

	const table = through
		? teams
			? teamStandings(season, through.round, include)
			: driverStandings(season, through.round, include)
		: [];

	const entryName = (id: string) =>
		teams ? teamLineName(teamIdOf(id), id) : labelOf(data.context, 'driver', id);

	const hrefOf = (id: string) =>
		teams
			? standingsHref(season.season, through?.round ?? null, true)
			: driverHref(id, season.season);

	const colourOf = (id: string) => {
		if (teams) {
			return season.teams[id] ?? null;
		}

		const team = season.rounds
			.flatMap((round) => round.sessions)
			.findLast((session) => session.rows.some((row) => row.driver === id))
			?.rows.find((row) => row.driver === id)?.team;

		return team ? (season.teams[team] ?? null) : null;
	};

	const barOf = (entry: { id: string; points: number }): Bar => ({
		label: entryName(entry.id),
		value: entry.points,
		display: formatPoints(entry.points),
		href: hrefOf(entry.id),
		colour: colourOf(entry.id)
	});

	return { through, hidden, table, entryName, hrefOf, barOf };
}

function standingsAnswer(data: AskData, query: Extract<Query, { kind: 'standings' }>): AskOutcome {
	const season = data.seasons.find((entry) => entry.season === query.season);

	if (!season) {
		return { kind: 'missing', message: `There are no results for ${query.season}.` };
	}

	const after = query.after;

	const asked =
		after === null
			? null
			: 'round' in after
				? after.round
				: (season.rounds.find((round) => eventIdOf(round.name) === after.event)?.round ?? null);

	if (query.after !== null && asked === null) {
		return { kind: 'missing', message: `That grand prix was not part of ${season.season}.` };
	}

	const teams = query.table === 'teams';

	const {
		through,
		hidden,
		table,
		entryName: nameOfEntry,
		hrefOf,
		barOf
	} = countedStandings(data, season, teams, asked);

	if (!through) {
		return hidden.length > 0
			? { kind: 'held', sessions: hidden }
			: { kind: 'missing', message: `No race of ${season.season} has run yet.` };
	}

	const leader = table[0];

	if (!leader) {
		return { kind: 'missing', message: `No race of ${season.season} has counted yet.` };
	}

	const proof = standingsHref(season.season, through.round, teams);
	const lastRound = season.rounds.at(-1)?.round ?? through.round;

	const champion =
		asked === null && season.season < data.context.season && through.round === lastRound;

	const championship = teams ? "constructors' championship" : "drivers' championship";

	const second = table[1];

	return {
		kind: 'answer',
		headline: champion
			? [
					{ text: nameOfEntry(leader.id), href: hrefOf(leader.id) },
					` won the ${season.season} ${championship} with `,
					{ text: `${formatPoints(leader.points)} points`, href: proof }
				]
			: [
					{ text: nameOfEntry(leader.id), href: hrefOf(leader.id) },
					` led the ${season.season} ${teams ? "constructors'" : "drivers'"} standings after round ${through.round} with `,
					{ text: `${formatPoints(leader.points)} points`, href: proof }
				],
		detail: second
			? [
					{ text: nameOfEntry(second.id), href: hrefOf(second.id) },
					` ${champion ? 'finished' : 'was'} second, `,
					{ text: `${formatPoints(leader.points - second.points)} points behind`, href: proof },
					'.'
				]
			: null,
		visual: { kind: 'bars', bars: table.slice(0, 10).map(barOf) },
		source: `${season.season} standings after round ${through.round}, ${eventShortName(through.name)} GP`,
		proof: { label: 'Open the standings', href: proof },
		hidden
	};
}

/**
 * The most one race or sprint can give one driver or team: a win, and for a team second place
 * too, plus the fastest lap point of 2019 to 2024. Sprints gave 3 points to the winner in 2021.
 */
function pointsOnOffer(type: 'race' | 'sprint', season: number, teams: boolean): number {
	if (type === 'sprint') {
		return season === 2021 ? (teams ? 5 : 3) : teams ? 15 : 8;
	}

	return (teams ? 43 : 25) + (season >= 2019 && season <= 2024 ? 1 : 0);
}

function gapAnswer(data: AskData, query: Extract<Query, { kind: 'gap' }>): AskOutcome {
	const season = data.seasons.find((entry) => entry.season === query.season);

	if (!season) {
		return { kind: 'missing', message: `There are no results for ${query.season}.` };
	}

	const teams = query.table === 'teams';

	const { through, hidden, table, entryName, hrefOf, barOf } = countedStandings(
		data,
		season,
		teams,
		null
	);

	const [leader, runnerUp] = table;

	if (!through || !leader || !runnerUp) {
		return hidden.length > 0
			? { kind: 'held', sessions: hidden }
			: { kind: 'missing', message: `No race of ${season.season} has run yet.` };
	}

	const subject = query.subject;

	const place = subject
		? table.findIndex((entry) =>
				subject.kind === 'team' ? teamIdOf(entry.id) === subject.id : entry.id === subject.id
			)
		: 1;

	const asked = table[place];

	if (!asked) {
		return {
			kind: 'missing',
			message: `${subject ? labelOf(data.context, subject.kind, subject.id) : 'Nobody'} has no points in ${season.season}.`
		};
	}

	const ahead = table[place - 1];

	// Races still to come and the ones the viewer has not seen are both still open to them.
	const counted = new Set(
		season.rounds.flatMap((round) => round.sessions.map((session) => String(session.key)))
	);

	const hiddenKeys = new Set(hidden.map((session) => session.key));

	const toCome = (data.catalog ? sessionEntries(data.catalog) : []).filter(
		(candidate) =>
			candidate.year === season.season &&
			/Grand Prix/.test(candidate.meeting.name) &&
			(candidate.session.type === 'race' || candidate.session.type === 'sprint') &&
			Date.parse(candidate.session.startsAt) > data.now &&
			!counted.has(candidate.key)
	);

	const open = [
		...allSessions([season]).flatMap((candidate) =>
			hiddenKeys.has(String(candidate.session.key)) ? [candidate.session.type] : []
		),
		...toCome.map((candidate) => candidate.session.type)
	].filter((type): type is 'race' | 'sprint' => type === 'race' || type === 'sprint');

	const available = open.reduce(
		(total, type) => total + pointsOnOffer(type, season.season, teams),
		0
	);

	const proof = standingsHref(season.season, through.round, teams);
	const toLeader = leader.points - asked.points;
	const link = (id: string) => ({ text: entryName(id), href: hrefOf(id) });
	const points = (value: number) => ({ text: `${formatPoints(value)} points`, href: proof });

	const headline: Rich =
		place === 0
			? [
					link(leader.id),
					` leads the ${season.season} standings by `,
					points(leader.points - runnerUp.points),
					' over ',
					link(runnerUp.id)
				]
			: [
					link(asked.id),
					' is ',
					points(toLeader),
					' behind the leader, ',
					link(leader.id),
					...(ahead && ahead !== leader
						? [
								', and ',
								points(ahead.points - asked.points),
								' behind ',
								link(ahead.id),
								` in P${place}`
							]
						: [])
				];

	const title =
		available === 0
			? `With no race left to count, ${entryName(leader.id)} has the title.`
			: place === 0
				? `${formatPoints(available)} points are still available.`
				: toLeader <= available
					? `${formatPoints(available)} points are still available, so ${entryName(asked.id)} can still win the title.`
					: `Only ${formatPoints(available)} points are still available, so ${entryName(asked.id)} can no longer win the title.`;

	const held =
		hidden.length === 0
			? ''
			: ` ${plural(hidden.length, 'session')} you have not seen ${hidden.length === 1 ? 'is' : 'are'} left out and counted as still available.`;

	const shown = table.filter((_, index) => index === 0 || Math.abs(index - place) <= 1);

	return {
		kind: 'answer',
		headline,
		detail: [`After round ${through.round}. ${title}${held}`],
		visual: { kind: 'bars', bars: shown.map(barOf) },
		source: `${season.season} standings after round ${through.round}, ${eventShortName(through.name)} GP`,
		proof: { label: 'Open the standings', href: proof },
		hidden
	};
}

/** Which ask session a catalog session is: practice by its name, the rest by type. */
function askSessionOf(session: { type: string; name?: string | null }): AskSession | null {
	if (session.type === 'practice') {
		return practiceOf(session.name ?? '');
	}

	return session.type === 'race' ||
		session.type === 'qualifying' ||
		session.type === 'sprint' ||
		session.type === 'sprint_qualifying'
		? session.type
		: null;
}

function scheduleAnswer(data: AskData, query: Extract<Query, { kind: 'schedule' }>): AskOutcome {
	if (!data.catalog) {
		return { kind: 'missing', message: 'The calendar has not loaded.' };
	}

	const weekends = sessionEntries(data.catalog).filter(
		(entry) => /Grand Prix/.test(entry.meeting.name) && askSessionOf(entry.session) !== null
	);

	const next = weekends
		.filter(
			(entry) =>
				Date.parse(entry.session.startsAt) > data.now &&
				(query.session === null || askSessionOf(entry.session) === query.session) &&
				(query.event === null || eventIdOf(entry.meeting.name) === query.event)
		)
		.toSorted((a, b) => a.session.startsAt.localeCompare(b.session.startsAt))[0];

	if (!next) {
		return { kind: 'missing', message: 'Nothing like that is on the calendar yet.' };
	}

	const calendar = `/calendar?season=${next.year}`;
	const starts = Date.parse(next.session.startsAt);
	const event = `${eventShortName(next.meeting.name)} GP`;

	return {
		kind: 'answer',
		headline: [
			{ text: `${next.year} ${event} ${next.session.name}`, href: calendar },
			` starts ${formatLocalStart(next.session.startsAt)}, in `,
			{ text: formatUntil(data.now, starts), href: calendar }
		],
		detail: ['Times are in your time zone.'],
		visual: {
			kind: 'table',
			columns: ['Session', 'Starts'],
			rows: weekends
				.filter((entry) => entry.meeting.key === next.meeting.key && entry.year === next.year)
				.toSorted((a, b) => a.session.startsAt.localeCompare(b.session.startsAt))
				.map((entry) => ({
					cells: [entry.session.name, formatLocalStart(entry.session.startsAt)],
					href: calendar,
					colour: null,
					mark: entry.key === next.key
				}))
		},
		source: `${next.year} calendar, ${event}, in your time`,
		proof: { label: 'Open the calendar', href: calendar },
		hidden: []
	};
}

function tallyLine(
	tally: Tally,
	names: { a: string; b: string },
	noun: string,
	verb: string
): string {
	const total = tally.a + tally.b;

	if (tally.a === tally.b) {
		return `${names.a} and ${names.b} are level in ${noun}, ${tally.a} each`;
	}

	const [ahead, behind, won] =
		tally.a > tally.b ? [names.a, names.b, tally.a] : [names.b, names.a, tally.b];

	return `${ahead} ${verb} ${behind} in ${won} of ${total} ${noun}`;
}

function refText(ref: { season: number; round: number }): string {
	return `${ref.season}.${ref.round}`;
}

/** A line of the head-to-head table: what, A's value, B's value, how to show them. */
type TallyRow = [string, number, number, (value: number) => string];

function h2hAnswer(data: AskData, query: Extract<Query, { kind: 'h2h' }>): AskOutcome {
	const a = sideOf(query.a);
	const b = sideOf(query.b);
	const span = spanOf(data, query.seasons);

	const range: H2HRange = {
		from: { season: span.from, round: 0 },
		to: { season: span.to, round: Infinity }
	};

	const include = (key: number) => {
		const found = allSessions(span.seasons).find((entry) => entry.session.key === key);

		return found ? isCounted(data, found.session) : true;
	};

	const all = sharedEvents(span.seasons, a, b, range, include);
	const events = query.teammates ? all.filter(asTeammates) : all;
	const names = { a: nameOf(data, query.a), b: nameOf(data, query.b) };

	const hidden = hiddenSessions(span.seasons, a, b, range, include).map((session) => {
		const entry = allSessions(span.seasons).find((item) => item.session.key === session.key);

		return {
			key: String(session.key),
			startsAt: session.startsAt,
			label: entry
				? `${entry.season.season} ${eventShortName(entry.round.name)} GP ${session.name}`
				: session.name
		};
	});

	const first = events[0];
	const last = events.at(-1);

	if (!first || !last) {
		return hidden.length > 0
			? { kind: 'held', sessions: hidden }
			: {
					kind: 'missing',
					message: `${names.a} and ${names.b} never ${query.teammates ? 'were teammates' : 'raced each other'} ${span.label}.`
				};
	}

	const totals = headToHead(events, { a, b });

	const when =
		query.seasons !== null
			? span.label
			: first.season === last.season
				? `in ${first.season}`
				: `from ${first.season} to ${last.season}`;

	const params = new URLSearchParams({
		a: query.a.id,
		b: query.b.id,
		from: refText({ season: first.season, round: first.round.round }),
		to: refText({ season: last.season, round: last.round.round })
	});

	if (query.a.kind === 'team') {
		params.set('mode', 'teams');
	}

	const proof = `/h2h?${params.toString()}`;

	const lines = {
		qualifying: tallyLine(totals.qualifying, names, 'qualifying sessions', 'out-qualified'),
		race: tallyLine(totals.race, names, 'races', 'finished ahead of'),
		sprint: tallyLine(totals.sprint, names, 'sprints', 'finished ahead of')
	};

	const focus = query.focus ?? 'race';
	const fact = h2hFacts(events, totals, names)[0];
	const evidence = fact?.evidence[0];

	const sprintRow: TallyRow = ['Sprints ahead', totals.sprint.a, totals.sprint.b, String];

	const rows: TallyRow[] = [
		['Qualifying', totals.qualifying.a, totals.qualifying.b, String],
		['Races ahead', totals.race.a, totals.race.b, String],
		...(totals.sprint.a + totals.sprint.b > 0 ? [sprintRow] : []),
		['Wins', totals.a.wins, totals.b.wins, String],
		['Podiums', totals.a.podiums, totals.b.podiums, String],
		['Poles', totals.a.poles, totals.b.poles, String],
		['Points', totals.a.points, totals.b.points, formatPoints]
	];

	return {
		kind: 'answer',
		headline: [
			{ text: lines[focus], href: proof },
			` ${query.teammates ? 'as teammates ' : ''}${when}`
		],
		detail: [
			...(focus === 'race' ? [] : [`${lines.race}. `]),
			...(focus === 'qualifying' ? [] : [`${lines.qualifying}. `]),
			...(fact ? [`${fact.text}.`] : []),
			...(evidence
				? [
						' From ',
						{ text: evidence.label, href: sessionHref(evidence.session.key, evidence.carNumber) },
						'.'
					]
				: [])
		],
		visual: {
			kind: 'table',
			columns: ['', names.a, names.b],
			rows: rows.map(([label, valueA, valueB, format]) => ({
				cells: [label, format(valueA), format(valueB)],
				href: proof,
				colour: null,
				mark: false
			}))
		},
		source: `${plural(events.length, 'weekend')}, ${first.season} ${eventShortName(first.round.name)} GP to ${last.season} ${eventShortName(last.round.name)} GP`,
		proof: { label: 'Open the head to head', href: proof },
		hidden
	};
}

type Count = { id: string; total: number; bySeason: Map<number, number>; colour: string | null };

/** Each side's count of `stat` over `seasons`, sessions the viewer has not seen left out. */
function countAll(
	data: AskData,
	seasons: readonly SeasonResults[],
	stat: CountedStat,
	teams: boolean
): Map<string, Count> {
	const counts = new Map<string, Count>();

	const add = (id: string, season: SeasonResults, value: number, team: string) => {
		const count = counts.get(id) ?? { id, total: 0, bySeason: new Map(), colour: null };

		count.total += value;
		count.bySeason.set(season.season, (count.bySeason.get(season.season) ?? 0) + value);
		count.colour = season.teams[team] ?? count.colour;
		counts.set(id, count);
	};

	for (const { season, session } of allSessions(seasons)) {
		if (!isCounted(data, session)) {
			continue;
		}

		for (const row of session.rows) {
			add(teams ? teamIdOf(row.team) : row.driver, season, countOf(stat, session, row), row.team);
		}
	}

	if (stat === 'points' && teams) {
		for (const season of seasons) {
			for (const adjustment of season.adjustments) {
				add(teamIdOf(adjustment.team), season, adjustment.points, adjustment.team);
			}
		}
	}

	return counts;
}

function statFormat(stat: CountedStat, value: number): string {
	return stat === 'points' ? formatPoints(value) : value.toLocaleString('en-GB');
}

function recordAnswer(data: AskData, query: Extract<Query, { kind: 'record' }>): AskOutcome {
	const span = spanOf(data, query.seasons);
	const teams = query.subject.kind === 'team';
	const name = nameOf(data, query.subject);
	const side = sideOf(query.subject);

	const taking = allSessions(span.seasons).filter(
		(entry) => rowsOf(entry.session, side).length > 0
	);

	const hidden = heldSessions(data, taking);

	const races = taking.filter(
		(entry) => entry.session.type === 'race' && isCounted(data, entry.session)
	);

	if (taking.length === 0) {
		return { kind: 'missing', message: `${name} has no results ${span.label}.` };
	}

	if (races.length === 0 && hidden.length > 0) {
		return { kind: 'held', sessions: hidden };
	}

	const seasonsIn = [...new Set(taking.map((entry) => entry.season.season))];

	const proof = subjectHref(
		query.subject,
		seasonsIn.length === 1 ? seasonsIn[0] : undefined,
		span.to
	);

	const source = `${plural(races.length, 'race')} ${span.label}`;
	const picture = pictureOf(span.seasons, query.subject) ?? undefined;

	if (query.stat === 'summary') {
		const stats = ['wins', 'poles', 'podiums', 'points'] as const;

		const counts = new Map(
			stats.map((stat) => [stat, countAll(data, span.seasons, stat, teams).get(query.subject.id)])
		);

		return {
			kind: 'answer',
			headline: [
				`${name} ${span.label}: `,
				...stats.flatMap((stat, index) => [
					...(index > 0 ? [', '] : []),
					{
						text: `${statFormat(stat, counts.get(stat)?.total ?? 0)} ${STAT_NOUN[stat].many}`,
						href: proof
					}
				])
			],
			detail: [`From ${plural(races.length, 'race')}.`],
			visual: {
				kind: 'table',
				columns: ['Season', 'Wins', 'Poles', 'Podiums', 'Points'],
				rows: seasonsIn.map((season) => ({
					cells: [
						String(season),
						...stats.map((stat) => statFormat(stat, counts.get(stat)?.bySeason.get(season) ?? 0))
					],
					href: subjectHref(query.subject, season, span.to),
					colour: counts.get('wins')?.colour ?? null,
					mark: false
				}))
			},
			source,
			proof: { label: teams ? 'Open the standings' : `Open ${name}'s page`, href: proof },
			hidden,
			picture
		};
	}

	const stat = query.stat;
	const count = countAll(data, span.seasons, stat, teams).get(query.subject.id);
	const total = count?.total ?? 0;
	const noun = total === 1 ? STAT_NOUN[stat].one : STAT_NOUN[stat].many;

	const latest = allSessions(span.seasons)
		.filter((entry) => isCounted(data, entry.session))
		.findLast((entry) =>
			rowsOf(entry.session, side).some((row) => countOf(stat, entry.session, row) > 0)
		);

	return {
		kind: 'answer',
		headline: [
			`${name} ${stat === 'points' ? 'scored' : 'has'} `,
			{ text: `${statFormat(stat, total)} ${noun}`, href: proof },
			` ${span.label}`
		],
		detail:
			latest && stat !== 'points' && stat !== 'starts'
				? [
						'Latest: ',
						{
							text: `${latest.season.season} ${eventShortName(latest.round.name)} GP ${latest.session.name}`,
							href: sessionHref(latest.session.key, rowsOf(latest.session, side)[0]?.number)
						},
						'.'
					]
				: [`From ${plural(races.length, 'race')}.`],
		visual:
			seasonsIn.length > 1
				? {
						kind: 'bars',
						bars: seasonsIn.map((season) => ({
							label: String(season),
							value: count?.bySeason.get(season) ?? 0,
							display: statFormat(stat, count?.bySeason.get(season) ?? 0),
							href: subjectHref(query.subject, season, span.to),
							colour: count?.colour ?? null
						}))
					}
				: null,
		source,
		proof: { label: teams ? 'Open the standings' : `Open ${name}'s page`, href: proof },
		hidden,
		picture
	};
}

function leadersAnswer(data: AskData, query: Extract<Query, { kind: 'leaders' }>): AskOutcome {
	const span = spanOf(data, query.seasons);
	const teams = query.table === 'teams';
	const stat: CountedStat = query.stat === 'summary' ? 'wins' : query.stat;
	const hidden = heldSessions(data, allSessions(span.seasons));

	const ranked = [...countAll(data, span.seasons, stat, teams).values()]
		.filter((count) => count.total > 0)
		.toSorted((x, y) => y.total - x.total || x.id.localeCompare(y.id));

	const top = ranked[0];

	if (!top) {
		return hidden.length > 0
			? { kind: 'held', sessions: hidden }
			: { kind: 'missing', message: `Nobody has any ${STAT_NOUN[stat].many} ${span.label}.` };
	}

	const single = span.from === span.to;

	const nameOfId = (id: string) =>
		teams ? teamLineName(id, id) : labelOf(data.context, 'driver', id);

	const hrefOf = (id: string) =>
		teams ? standingsHref(span.to, null, true) : driverHref(id, single ? span.from : undefined);

	const proof = single || stat === 'points' ? standingsHref(span.to, null, teams) : hrefOf(top.id);
	const second = ranked[1];

	return {
		kind: 'answer',
		headline: [
			{ text: nameOfId(top.id), href: hrefOf(top.id) },
			` has the most ${STAT_NOUN[stat].many} ${span.label}: `,
			{ text: statFormat(stat, top.total), href: proof }
		],
		detail: second
			? [
					{ text: nameOfId(second.id), href: hrefOf(second.id) },
					' is next with ',
					{ text: statFormat(stat, second.total), href: hrefOf(second.id) },
					'.'
				]
			: null,
		visual: {
			kind: 'bars',
			bars: ranked.slice(0, 8).map((count) => ({
				label: nameOfId(count.id),
				value: count.total,
				display: statFormat(stat, count.total),
				href: hrefOf(count.id),
				colour: count.colour
			}))
		},
		source: `${plural(
			allSessions(span.seasons).filter(
				(entry) => entry.session.type === 'race' && isCounted(data, entry.session)
			).length,
			'race'
		)} ${span.label}`,
		proof: {
			label: single || stat === 'points' ? 'Open the standings' : `Open ${nameOfId(top.id)}'s page`,
			href: proof
		},
		hidden
	};
}

/**
 * The answer to a question, with the view it can be checked in. A single session's result the
 * viewer has not seen is held for a reveal; counts over many sessions leave those out and say so.
 * Insights read a session's saved data: pass it once loaded, or the outcome asks for it.
 */
export function answerQuery(
	data: AskData,
	query: Query,
	snapshot: RaceSnapshot | null,
	stewards: Stewards = STEWARDS_LOADING
): AskOutcome {
	switch (query.kind) {
		case 'result':
		case 'insight': {
			const lookup = findAskSession(data, query.session);

			if ('missing' in lookup) {
				return { kind: 'missing', message: lookup.missing };
			}

			const info = lookup.found;

			if (data.held(info.key, info.startsAt)) {
				return { kind: 'held', sessions: [heldOf(info)] };
			}

			if (query.kind === 'result') {
				return info.results
					? resultAnswer(data, info, info.results, query.subject)
					: {
							kind: 'missing',
							message: `There is no classification for the ${sessionLabel(info)}.`
						};
			}

			return snapshot && snapshot.session.id === info.key
				? insightAnswer(data, info, query.insight, query.subject, snapshot)
				: { kind: 'snapshot', key: info.key, label: sessionLabel(info) };
		}

		case 'standings': {
			return standingsAnswer(data, query);
		}

		case 'h2h': {
			return h2hAnswer(data, query);
		}

		case 'record': {
			return recordAnswer(data, query);
		}

		case 'leaders': {
			return leadersAnswer(data, query);
		}

		case 'schedule': {
			return scheduleAnswer(data, query);
		}

		case 'gap': {
			return gapAnswer(data, query);
		}

		case 'penalties':
		case 'age':
		case 'youngest_winner': {
			return stewardsAnswer(data, query, stewards);
		}
	}
}
