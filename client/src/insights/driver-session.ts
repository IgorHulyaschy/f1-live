import type { Lap, Penalty, RaceSnapshot, TyreCompound } from '@f1-live/shared';

import { isKnockout, isTimedSession, partOfLap, partStarts } from './qualifying.ts';
import { deletedLaps, type SectorMark } from './standings.ts';

const SECTORS = [0, 1, 2] as const;

/**
 * On the clock, a lap within this share of the car's best of the part is a push lap; preparation
 * laps and cool-downs, a tenth slower or more, are not.
 */
const PUSH_LAP_LIMIT = 1.07;

/** One of a driver's laps, as the driver view's table reads it. */
export type DriverLap = {
	lap: Lap;
	/** Purple for the session's fastest lap, green for the driver's own best. */
	lapMark: SectorMark;
	sectorMarks: readonly [SectorMark, SectorMark, SectorMark];
	/** The stewards deleted its time. */
	deleted: boolean;
	/** Penalties given on this lap. */
	penalties: readonly Penalty[];
	/** The qualifying part it was set in, from 1; 1 outside knockout sessions. */
	part: number;
	/** A push lap: timed, neither in nor out of the pits, and not a cool-down. */
	push: boolean;
};

type Marks = { lap: SectorMark; sectors: [SectorMark, SectorMark, SectorMark] };

const NO_MARKS: Marks = { lap: 'none', sectors: ['none', 'none', 'none'] };

type Bests = { lapMs: number; sectorsMs: [number, number, number] };

function freshBests(): Bests {
	return { lapMs: Infinity, sectorsMs: [Infinity, Infinity, Infinity] };
}

/** Purple when the time beat every time before it, green when it beat the driver's own. */
function markOf(time: number, session: number, own: number): SectorMark {
	if (time <= 0 || time >= own) {
		return 'none';
	}

	return time < session ? 'fastest' : 'personal-best';
}

/** When a lap was completed, for ordering; the modelled replay has only lap numbers. */
function completion(lap: Lap): number {
	return lap.completedAt === undefined ? lap.lap : Date.parse(lap.completedAt);
}

/**
 * Each lap's marks as the timing screen gave them when it was completed: purple for a new
 * session best, green for a new personal best. Laps that do not count (a race's standing start,
 * in and out laps, deleted times) are never marked and never set a best.
 */
function marksWhenSet(laps: readonly Lap[], counts: (lap: Lap) => boolean): Map<Lap, Marks> {
	const session = freshBests();
	const own = new Map<string, Bests>();
	const marks = new Map<Lap, Marks>();

	for (const lap of laps.filter(counts).toSorted((a, b) => completion(a) - completion(b))) {
		const mine = own.get(lap.driverNumber) ?? freshBests();

		marks.set(lap, {
			lap: markOf(lap.lapTimeMs, session.lapMs, mine.lapMs),
			sectors: [
				markOf(lap.sectorTimesMs[0], session.sectorsMs[0], mine.sectorsMs[0]),
				markOf(lap.sectorTimesMs[1], session.sectorsMs[1], mine.sectorsMs[1]),
				markOf(lap.sectorTimesMs[2], session.sectorsMs[2], mine.sectorsMs[2])
			]
		});

		for (const bests of [session, mine]) {
			bests.lapMs = Math.min(bests.lapMs, lap.lapTimeMs);

			for (const index of SECTORS) {
				const time = lap.sectorTimesMs[index];

				if (time > 0) {
					bests.sectorsMs[index] = Math.min(bests.sectorsMs[index], time);
				}
			}
		}

		own.set(lap.driverNumber, mine);
	}

	return marks;
}

/** A driver's laps in order, with the marks, rulings and penalties the driver view shows. */
export function driverLaps(snapshot: RaceSnapshot, driverNumber: string): DriverLap[] {
	const { type } = snapshot.session;
	const timed = isTimedSession(type);
	const starts = isKnockout(type) ? partStarts(snapshot) : [];
	const deleted = deletedLaps(snapshot);
	const partOf = (lap: Lap) => (starts.length > 0 ? partOfLap(lap, starts) : 1);
	const runKey = (lap: Lap) => `${lap.driverNumber} ${partOf(lap)}`;

	const timedLap = (lap: Lap) =>
		lap.lapTimeMs > 0 && !lap.pitIn && !lap.pitOut && (timed || lap.lap > 1);

	// On the clock, out-laps and cool-downs are timed too: only laps near the car's best of the
	// part are push laps.
	const partBests = new Map<string, number>();

	for (const lap of snapshot.laps.filter((entry) => timedLap(entry) && !deleted.has(entry))) {
		partBests.set(runKey(lap), Math.min(partBests.get(runKey(lap)) ?? Infinity, lap.lapTimeMs));
	}

	const pushed = (lap: Lap) =>
		timedLap(lap) &&
		(!timed || lap.lapTimeMs <= (partBests.get(runKey(lap)) ?? Infinity) * PUSH_LAP_LIMIT);

	const marks = marksWhenSet(snapshot.laps, (lap) => pushed(lap) && !deleted.has(lap));

	return snapshot.laps
		.filter((lap) => lap.driverNumber === driverNumber)
		.toSorted((a, b) => a.lap - b.lap)
		.map((lap) => {
			const { lap: lapMark, sectors } = marks.get(lap) ?? NO_MARKS;

			return {
				lap,
				lapMark,
				sectorMarks: sectors,
				deleted: deleted.has(lap),
				penalties: (snapshot.penalties ?? []).filter(
					(penalty) => penalty.driverNumber === driverNumber && penalty.lap === lap.lap
				),
				part: partOf(lap),
				push: pushed(lap)
			};
		});
}

/** One run in qualifying: out of the garage, some push laps, back in. */
export type QualifyingRun = {
	part: number;
	/** The run's number within its part, from 1. */
	number: number;
	compound: TyreCompound;
	/** Laps on the set at the first lap of the run. */
	tyreAge: number;
	laps: readonly DriverLap[];
	/** Its push laps only. */
	pushLaps: readonly DriverLap[];
	/** The quickest push lap whose time stood. */
	best: DriverLap | null;
};

/** A driver's qualifying runs part by part: each starts out of the pit lane or at a new part. */
export function qualifyingRuns(laps: readonly DriverLap[]): QualifyingRun[] {
	const runs: { part: number; laps: DriverLap[] }[] = [];

	for (const entry of laps) {
		const current = runs.at(-1);
		const previous = current?.laps.at(-1);

		if (!current || entry.part !== current.part || entry.lap.pitOut || previous?.lap.pitIn) {
			runs.push({ part: entry.part, laps: [entry] });
		} else {
			current.laps.push(entry);
		}
	}

	// A part's first in-lap can arrive after the next part starts; only runs with push laps count.
	const pushedRuns = runs.filter((run) => run.laps.some((entry) => entry.push));

	return pushedRuns.flatMap((run, index) => {
		const first = run.laps[0];

		if (!first) {
			return [];
		}

		const pushLaps = run.laps.filter((entry) => entry.push);

		const best = pushLaps
			.filter((entry) => !entry.deleted)
			.reduce<DriverLap | null>(
				(fastest, entry) =>
					!fastest || entry.lap.lapTimeMs < fastest.lap.lapTimeMs ? entry : fastest,
				null
			);

		return [
			{
				part: run.part,
				number: pushedRuns.slice(0, index).filter((other) => other.part === run.part).length + 1,
				compound: first.lap.compound,
				tyreAge: first.lap.tyreAge,
				laps: run.laps,
				pushLaps,
				best
			}
		];
	});
}

/** The driver's best lap that stood: the last one marked, since each mark beat the one before. */
export function bestDriverLap(laps: readonly DriverLap[]): DriverLap | null {
	return laps.findLast((entry) => entry.lapMark !== 'none') ?? null;
}
