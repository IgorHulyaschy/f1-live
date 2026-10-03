import type { ResultRow, SessionResults } from '@f1-live/shared/results';

import { type H2HEvent, type H2HTotals, type Meeting, winnerOf } from './head-to-head.ts';

/** A session a fact rests on, to open from the fact. */
export type Evidence = {
	session: SessionResults;
	/** "2023 Bahrain Qualifying". */
	label: string;
	/** The car to open in the session's driver view, when the fact is about one driver. */
	carNumber?: string;
};

export type Fact = {
	/** Stable across renders, for keys and tests. */
	id: string;
	/** Higher reads first. */
	score: number;
	text: string;
	evidence: Evidence[];
};

type Names = { a: string; b: string };

type Kind = 'qualifying' | 'race';

const KIND_NOUN: Record<Kind, { one: string; many: string }> = {
	qualifying: { one: 'qualifying', many: 'qualifyings' },
	race: { one: 'race', many: 'races' }
};

const MIN_STREAK = 3;

const MIN_COMEBACK = 5;

const MIN_CIRCUIT_SESSIONS = 3;

export function eventLabel(event: H2HEvent): string {
	return `${event.season} ${event.round.name.replace(/ Grand Prix$/, '')}`;
}

function evidence(event: H2HEvent, meeting: Meeting, row?: ResultRow): Evidence {
	const item: Evidence = {
		session: meeting.session,
		label: `${eventLabel(event)} ${meeting.session.name}`
	};

	if (row) {
		item.carNumber = row.number;
	}

	return item;
}

function seconds(ms: number): string {
	return `${(Math.abs(ms) / 1000).toFixed(3)} s`;
}

type Decided = { event: H2HEvent; meeting: Meeting; winner: 'a' | 'b' };

function decided(events: readonly H2HEvent[], kind: Kind): Decided[] {
	return events.flatMap((event) => {
		const meeting = kind === 'race' ? event.race : event.qualifying;
		const winner = meeting ? winnerOf(meeting) : null;

		return meeting && winner ? [{ event, meeting, winner }] : [];
	});
}

/** Each side's longest run of beating the other, and the run still going at the end. */
function streakFacts(events: readonly H2HEvent[], kind: Kind, names: Names): Fact[] {
	const runs = decided(events, kind);
	const facts: Fact[] = [];
	const longest: Record<'a' | 'b', Decided[]> = { a: [], b: [] };
	let current: Decided[] = [];

	for (const item of runs) {
		current = current[0]?.winner === item.winner ? [...current, item] : [item];

		if (current.length > longest[item.winner].length) {
			longest[item.winner] = current;
		}
	}

	for (const side of ['a', 'b'] as const) {
		const run = longest[side];
		const first = run[0];
		const last = run.at(-1);

		if (run.length < MIN_STREAK || !first || !last) {
			continue;
		}

		const other = side === 'a' ? names.b : names.a;
		const ongoing = current === run && runs.length > run.length;

		facts.push({
			id: `${kind}-streak-${side}`,
			score: run.length * (kind === 'qualifying' ? 10 : 12) + (ongoing ? 15 : 0),
			text: ongoing
				? `${names[side]} has beaten ${other} in the last ${run.length} ${KIND_NOUN[kind].many}, since ${eventLabel(first.event)}`
				: `${names[side]} beat ${other} in ${run.length} ${KIND_NOUN[kind].many} in a row, ${eventLabel(first.event)} to ${eventLabel(last.event)}`,
			evidence: [evidence(first.event, first.meeting), evidence(last.event, last.meeting)]
		});
	}

	return facts;
}

/** The closest and the widest qualifying gap between teammates. */
function gapFacts(totals: H2HTotals, names: Names): Fact[] {
	const byClosest = totals.gaps.toSorted((x, y) => Math.abs(x.ms) - Math.abs(y.ms));
	const closest = byClosest[0];
	const widest = byClosest.at(-1);
	const facts: Fact[] = [];

	for (const [id, gap, score] of [
		['closest-gap', closest, Math.abs(closest?.ms ?? Infinity) < 20 ? 45 : 30],
		['widest-gap', widest, 22]
	] as const) {
		if (!gap?.event.qualifying || gap.ms === 0 || (id === 'widest-gap' && totals.gaps.length < 2)) {
			continue;
		}

		const quicker = gap.ms < 0 ? names.a : names.b;
		const adjective = id === 'closest-gap' ? 'Closest' : 'Widest';

		facts.push({
			id,
			score,
			text: `${adjective} qualifying gap: ${quicker} by ${seconds(gap.ms)} at ${eventLabel(gap.event)}`,
			evidence: [evidence(gap.event, gap.event.qualifying)]
		});
	}

	return facts;
}

/** The most places either made up from the grid in a race they finished. */
function comebackFact(events: readonly H2HEvent[], names: Names): Fact[] {
	let top: {
		event: H2HEvent;
		meeting: Meeting;
		row: ResultRow;
		side: 'a' | 'b';
		gained: number;
	} | null = null;

	for (const event of events) {
		for (const side of ['a', 'b'] as const) {
			for (const row of event.race?.[side] ?? []) {
				const gained = row.grid && row.classified ? row.grid - row.position : 0;

				if (event.race && gained >= MIN_COMEBACK && (top === null || gained > top.gained)) {
					top = { event, meeting: event.race, row, side, gained };
				}
			}
		}
	}

	return top
		? [
				{
					id: 'comeback',
					score: 10 + top.gained * 2,
					text: `Biggest comeback: ${names[top.side]} from P${top.row.grid} to P${top.row.position} at ${eventLabel(top.event)}`,
					evidence: [evidence(top.event, top.meeting, top.row)]
				}
			]
		: [];
}

function bestPlace(rows: readonly ResultRow[]): number {
	return Math.min(...rows.flatMap((row) => (row.classified ? [row.position] : [])));
}

/** Races where one side won and the other came second. */
function oneTwoFact(events: readonly H2HEvent[]): Fact[] {
	const oneTwos = events.filter((event) => {
		const places = event.race ? [bestPlace(event.race.a), bestPlace(event.race.b)] : [];

		return places.includes(1) && places.includes(2);
	});

	const first = oneTwos[0];

	if (!first?.race) {
		return [];
	}

	return [
		{
			id: 'one-two',
			score: 15 + oneTwos.length * 6,
			text:
				oneTwos.length === 1
					? `One one-two finish together, at ${eventLabel(first)}`
					: `${oneTwos.length} one-two finishes together, the first at ${eventLabel(first)}`,
			evidence: [evidence(first, first.race)]
		}
	];
}

/** A circuit where one side has won every qualifying between them, three or more times. */
function circuitFacts(events: readonly H2HEvent[], names: Names): Fact[] {
	const byCircuit = new Map<string, Decided[]>();

	for (const item of decided(events, 'qualifying')) {
		const location = item.event.round.location;

		byCircuit.set(location, [...(byCircuit.get(location) ?? []), item]);
	}

	return [...byCircuit].flatMap(([location, items]): Fact[] => {
		const winner = items[0]?.winner;
		const last = items.at(-1);

		if (
			!winner ||
			!last ||
			items.length < MIN_CIRCUIT_SESSIONS ||
			items.some((item) => item.winner !== winner)
		) {
			return [];
		}

		return [
			{
				id: `circuit-${location}`,
				score: items.length * 6,
				text: `${names[winner]} is ${items.length}–0 in qualifying against ${winner === 'a' ? names.b : names.a} at ${location}`,
				evidence: [evidence(last.event, last.meeting)]
			}
		];
	});
}

/** Where it began, and the first time the side behind overall got one back. */
function firstFacts(events: readonly H2HEvent[], totals: H2HTotals, names: Names): Fact[] {
	const facts: Fact[] = [];
	const opener = events.find((event) => event.race);

	if (opener?.race) {
		facts.push({
			id: 'first-race',
			score: 8,
			text: `First race together: ${eventLabel(opener)}`,
			evidence: [evidence(opener, opener.race)]
		});
	}

	const trailing = totals.race.a < totals.race.b ? 'a' : 'b';
	const firstWin = decided(events, 'race').find((item) => item.winner === trailing);

	if (firstWin && totals.race.a !== totals.race.b) {
		facts.push({
			id: 'first-race-win',
			score: 9,
			text: `${names[trailing]} first finished ahead in a race at ${eventLabel(firstWin.event)}`,
			evidence: [evidence(firstWin.event, firstWin.meeting)]
		});
	}

	return facts;
}

/**
 * Facts about two sides over their shared events, most interesting first: streaks, the closest and
 * widest qualifying gaps, the biggest comeback, one-two finishes, circuits one side owns and
 * where it began. Each names the sessions it rests on.
 */
export function h2hFacts(events: readonly H2HEvent[], totals: H2HTotals, names: Names): Fact[] {
	return [
		...streakFacts(events, 'qualifying', names),
		...streakFacts(events, 'race', names),
		...gapFacts(totals, names),
		...comebackFact(events, names),
		...oneTwoFact(events),
		...circuitFacts(events, names),
		...firstFacts(events, totals, names)
	].toSorted((x, y) => y.score - x.score || x.id.localeCompare(y.id));
}
