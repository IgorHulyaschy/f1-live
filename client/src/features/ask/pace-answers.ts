import type { Query, Subject } from '@f1-live/shared/ask';
import type { Driver, RaceSnapshot } from '@f1-live/shared';
import { driverIdOf } from '@f1-live/shared/results';

import { longRuns } from '../../insights/long-runs.ts';
import {
	COMPOUND_NAME,
	MATCHED_SECONDS,
	type PaceEntry,
	type PaceFilter,
	paceSpanText,
	paceVersus,
	racePace,
	stintPairs,
	teammateGaps
} from '../../insights/pace.ts';
import { teamIdOf } from '../../insights/teams.ts';
import { formatLapTime } from '../../lib/format.ts';
import { labelOf } from './ask-context.ts';
import {
	type AskData,
	type AskSessionInfo,
	plural,
	sessionHref,
	sessionLabel
} from './ask-data.ts';
import type { Answer, AskOutcome, Bar, TableRow } from './answers.ts';

type PaceQuery = Extract<Query, { kind: 'pace' }>;

const BARS = 10;

const seconds = (value: number) => `${value.toFixed(2)} s`;

const isSubject = (subject: Subject, driver: Driver) =>
	subject.kind === 'driver'
		? driverIdOf(driver.firstName, driver.lastName) === subject.id
		: teamIdOf(driver.team) === subject.id;

/** The bar for one driver's pace, linking to the first clean lap it was computed from. */
function paceBar(info: AskSessionInfo, entry: PaceEntry): Bar {
	return {
		label: entry.driver.lastName,
		value: entry.deltaToBestSeconds,
		display: entry.deltaToBestSeconds === 0 ? 'Best' : `+${entry.deltaToBestSeconds.toFixed(2)}`,
		href: sessionHref(info.key, entry.driver.number, entry.laps[0]?.lap),
		colour: entry.driver.teamColour
	};
}

function rankingAnswer(
	data: AskData,
	info: AskSessionInfo,
	snapshot: RaceSnapshot,
	query: PaceQuery,
	filter: PaceFilter
): AskOutcome {
	const label = sessionLabel(info);
	const ranked = racePace(snapshot, filter);
	const top = ranked[0];
	const second = ranked[1];

	if (!top || !second) {
		return {
			kind: 'missing',
			message: `Too few clean laps in the ${label} ${paceSpanText(filter)} to rank pace.`
		};
	}

	const { a } = query;
	const mine = a ? ranked.find((entry) => isSubject(a, entry.driver)) : null;
	const shown = mine ?? top;
	const rank = ranked.indexOf(shown) + 1;

	const link = (entry: PaceEntry) => ({
		text: entry.driver.lastName,
		href: sessionHref(info.key, entry.driver.number, entry.laps[0]?.lap)
	});

	const clean = plural(
		ranked.reduce((total, entry) => total + entry.laps.length, 0),
		'clean lap'
	);

	return {
		kind: 'answer',
		hidden: [],
		headline:
			shown === top
				? [
						link(top),
						` had the best pace ${paceSpanText(filter)}, ${seconds(second.deltaToBestSeconds)} a lap clear of `,
						link(second)
					]
				: [
						link(shown),
						` ranks P${rank} on pace ${paceSpanText(filter)}, ${seconds(shown.deltaToBestSeconds)} a lap behind `,
						link(top)
					],
		detail: [
			`Median of the clean laps with fuel, tyre age and compound taken out. `,
			query.a && !mine
				? `${labelOf(data.context, query.a.kind, query.a.id)} has too few clean laps. `
				: ''
		],
		visual: {
			kind: 'bars',
			bars: ranked.slice(0, BARS).map((entry) => paceBar(info, entry))
		},
		source: `${label}, ${clean}`,
		proof: { label: 'Open the pace tile', href: sessionHref(info.key, shown.driver.number) }
	} satisfies Answer;
}

/** Who is quicker in a stint on corrected pace, by how much: "VER 1.82 s quicker", or "Level". */
function aheadText(first: PaceEntry, second: PaceEntry, gap: number | null): string {
	if (gap === null) {
		return '–';
	}

	return Math.abs(gap) < MATCHED_SECONDS
		? 'Level'
		: `${(gap > 0 ? second : first).driver.code} ${seconds(Math.abs(gap))} quicker`;
}

function versusAnswer(
	info: AskSessionInfo,
	snapshot: RaceSnapshot,
	query: PaceQuery,
	filter: PaceFilter
): AskOutcome {
	const label = sessionLabel(info);
	const { a, b } = query;
	const first = a ? snapshot.drivers.find((driver) => isSubject(a, driver)) : undefined;
	const second = b ? snapshot.drivers.find((driver) => isSubject(b, driver)) : undefined;

	if (!first || !second) {
		return { kind: 'missing', message: `Both drivers need to have taken part in the ${label}.` };
	}

	const verdict = paceVersus(snapshot, first.number, second.number, filter);

	if (!verdict) {
		return { kind: 'missing', message: `No pace comparison for the ${label}.` };
	}

	const entries = [verdict.first, verdict.second].flatMap((entry) => entry ?? []);

	const rows: TableRow[] = stintPairs(snapshot, first.number, second.number, filter.compound).map(
		({ stint, first: one, second: two, gainSeconds }) => ({
			cells: [
				`Stint ${stint}`,
				one && two ? aheadText(one, two, gainSeconds) : '–',
				one
					? `${one.laps.length} laps, ${one.compounds.map((c) => COMPOUND_NAME[c]).join('/')}`
					: '–',
				two
					? `${two.laps.length} laps, ${two.compounds.map((c) => COMPOUND_NAME[c]).join('/')}`
					: '–'
			],
			href: sessionHref(info.key, (two ?? one)?.driver.number, (two ?? one)?.laps[0]?.lap),
			colour: null,
			mark: filter.span.kind === 'stint' && filter.span.stint === stint
		})
	);

	return {
		kind: 'answer',
		hidden: [],
		headline: [
			{
				text: verdict.text,
				href: sessionHref(info.key, (verdict.faster ?? first).number, entries[0]?.laps[0]?.lap)
			}
		],
		detail: [
			'The first figure is on the laps both drove clean. The table gives each stint, both drivers allowed for tyre age and compound the same way.'
		],
		visual: {
			kind: 'table',
			columns: ['Stint', 'Allowed-for gap', first.code, second.code],
			rows
		},
		source: `${label}, ${plural(
			entries.reduce((total, entry) => total + entry.laps.length, 0),
			'clean lap'
		)}`,
		proof: {
			label: 'Open the duel',
			href: `${sessionHref(info.key, first.number)}&duel=${first.code},${second.code}`
		}
	} satisfies Answer;
}

function teammatesAnswer(
	data: AskData,
	info: AskSessionInfo,
	snapshot: RaceSnapshot,
	query: PaceQuery,
	filter: PaceFilter
): AskOutcome {
	const label = sessionLabel(info);
	const { a } = query;

	const gaps = teammateGaps(snapshot, filter).filter(
		(gap) => !a || isSubject(a, gap.quicker.driver) || isSubject(a, gap.slower.driver)
	);

	const top = gaps[0];

	if (!top) {
		return {
			kind: 'missing',
			message: `No team in the ${label} has two drivers with enough clean laps ${paceSpanText(filter)}.`
		};
	}

	const link = (entry: PaceEntry) => ({
		text: entry.driver.lastName,
		href: sessionHref(info.key, entry.driver.number, entry.laps[0]?.lap)
	});

	return {
		kind: 'answer',
		hidden: [],
		headline: a
			? [
					link(top.quicker),
					` was ${seconds(top.gapSeconds)} a lap quicker than `,
					link(top.slower),
					` ${paceSpanText(filter)}`
				]
			: [
					`${top.team} had the widest team-mate gap: `,
					link(top.quicker),
					` ${seconds(top.gapSeconds)} a lap ahead of `,
					link(top.slower)
				],
		detail: [`Team-mates compared on corrected pace${a ? '' : ', widest gap first'}.`],
		visual: {
			kind: 'table',
			columns: ['Team', 'Quicker', 'Gap'],
			rows: gaps.slice(0, BARS).map((gap) => ({
				cells: [gap.team, gap.quicker.driver.lastName, seconds(gap.gapSeconds)],
				href: sessionHref(info.key, gap.slower.driver.number, gap.slower.laps[0]?.lap),
				colour: gap.quicker.driver.teamColour,
				mark: a !== null
			}))
		},
		source: `${label}, ${labelOf(data.context, a?.kind ?? 'team', a?.id ?? '') || 'every team'}`,
		proof: { label: 'Open the session', href: sessionHref(info.key, top.quicker.driver.number) }
	} satisfies Answer;
}

function longRunAnswer(info: AskSessionInfo, snapshot: RaceSnapshot, query: PaceQuery): AskOutcome {
	const label = sessionLabel(info);

	const runs = longRuns(snapshot).filter(
		(run) =>
			(!query.compound || run.compound === query.compound) &&
			(!query.a || isSubject(query.a, run.driver))
	);

	const top = runs[0];

	if (!top) {
		return { kind: 'missing', message: `No long runs in the ${label}.` };
	}

	return {
		kind: 'answer',
		hidden: [],
		headline: [
			{
				text: top.driver.lastName,
				href: sessionHref(info.key, top.driver.number, top.fromLap)
			},
			` had the best long run: ${formatLapTime(top.averageMs)} a lap over ${top.laps} laps on ${COMPOUND_NAME[top.compound]}`
		],
		detail: ['Quickest average first. Compounds and fuel differ, so read it as a first guide.'],
		visual: {
			kind: 'table',
			columns: ['Driver', 'Tyre', 'Laps', 'Average'],
			rows: runs.slice(0, BARS).map((run) => ({
				cells: [
					run.driver.lastName,
					COMPOUND_NAME[run.compound],
					`${run.fromLap}–${run.toLap}`,
					formatLapTime(run.averageMs)
				],
				href: sessionHref(info.key, run.driver.number, run.fromLap),
				colour: run.driver.teamColour,
				mark: false
			}))
		},
		source: `${label}, ${plural(runs.length, 'long run')}`,
		proof: { label: 'Open the session', href: sessionHref(info.key, top.driver.number) }
	} satisfies Answer;
}

/** Pace of one session's drivers, in the mode the question asked for. */
export function paceAnswer(
	data: AskData,
	info: AskSessionInfo,
	query: PaceQuery,
	snapshot: RaceSnapshot
): AskOutcome {
	const filter: PaceFilter = { span: query.span, compound: query.compound };

	switch (query.mode) {
		case 'ranking': {
			return rankingAnswer(data, info, snapshot, query, filter);
		}

		case 'versus': {
			return versusAnswer(info, snapshot, query, filter);
		}

		case 'teammates': {
			return teammatesAnswer(data, info, snapshot, query, filter);
		}

		case 'long_run': {
			return longRunAnswer(info, snapshot, query);
		}
	}
}
