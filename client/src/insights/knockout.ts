import type { Driver, Lap, RaceSnapshot } from '@f1-live/shared';

import { cutLines, isKnockout, partOfLap, partStarts, qualifyingProgress } from './qualifying.ts';
import type { SectorMark, StandingRow } from './standings.ts';

/** Where a qualifying session stands: the part, its cut and who would go out now. */
export type Knockout = {
	/** "Q" or "SQ". */
	prefix: string;
	/** The part running now or run last, from 1; null before the first. */
	part: number | null;
	running: boolean;
	finished: boolean;
	/** The last position that goes through, while a part with a cut runs. */
	cutAfter: number | null;
	/** Cars that would go out if the part ended now, best first. */
	dropZone: StandingRow[];
	/** Cars still in this part: everyone above the cars already out. */
	field: StandingRow[];
	/** The car on the cut, whose time is the one to beat. */
	cutRow: StandingRow | null;
	pole: StandingRow | null;
};

export function knockout(snapshot: RaceSnapshot, rows: readonly StandingRow[]): Knockout | null {
	if (!isKnockout(snapshot.session.type)) {
		return null;
	}

	const { part, running, finished } = qualifyingProgress(snapshot);
	const lines = cutLines(snapshot, rows.length);
	const open = lines.find((line) => !line.settled);

	const settled = Math.min(
		rows.length,
		...lines.flatMap((line) => (line.settled ? [line.after] : []))
	);

	const field = rows.slice(0, settled);
	const cutAfter = open && running ? open.after : null;

	return {
		prefix: snapshot.session.type === 'sprint_qualifying' ? 'SQ' : 'Q',
		part,
		running,
		finished,
		cutAfter,
		dropZone: cutAfter === null ? [] : field.slice(cutAfter),
		field,
		cutRow: cutAfter === null ? null : (rows[cutAfter - 1] ?? null),
		pole: rows[0] ?? null
	};
}

/** A car's best time in a part, from 1. */
export function partTime(row: StandingRow, part: number): number | null {
	return row.partBestsMs[part - 1] ?? null;
}

/** Behind the cut when positive, ahead of it when negative; null without both times. */
export function gapToCut(row: StandingRow, state: Knockout): number | null {
	const own = state.part === null ? null : partTime(row, state.part);
	const cut = state.part === null || !state.cutRow ? null : partTime(state.cutRow, state.part);

	return own === null || cut === null ? null : own - cut;
}

/** Behind the quickest time of the part, which is pole in the last one. */
export function gapToPole(row: StandingRow, state: Knockout): number | null {
	const own = state.part === null ? null : partTime(row, state.part);
	const pole = state.part === null || !state.pole ? null : partTime(state.pole, state.part);

	return own === null || pole === null ? null : own - pole;
}

/** A lap takes about this long at most; a car whose last lap ended longer ago is not on one. */
const LAP_WINDOW_MS = 150_000;

/**
 * Cars that are out on track at `timeMs`. The feed's own pit flag says so for the latest state;
 * a replay has only laps, so a car counts as out while its last lap, not an in-lap, is recent.
 */
export function onTrack(
	snapshot: RaceSnapshot,
	rows: readonly StandingRow[],
	timeMs: number
): Set<string> {
	if (snapshot.standings && snapshot.standings.length > 0) {
		return new Set(
			snapshot.standings.flatMap((standing) =>
				standing.inPit || standing.retired ? [] : [standing.driverNumber]
			)
		);
	}

	return new Set(
		rows.flatMap((row) => {
			const ended = row.lastLap?.completedAt ? Date.parse(row.lastLap.completedAt) : null;

			return ended !== null && !row.lastLap?.pitIn && timeMs - ended < LAP_WINDOW_MS
				? [row.driver.number]
				: [];
		})
	);
}

/** Cars that can still change the order in this part: out on track, or yet to set a time. */
export function stillToRun(state: Knockout, out: ReadonlySet<string>): StandingRow[] {
	const part = state.part;

	if (part === null || !state.running) {
		return [];
	}

	return state.field.filter(
		(row) => row.out === null && (out.has(row.driver.number) || partTime(row, part) === null)
	);
}

/** A lap that took a car up the order of its part. */
export type Improvement = {
	driver: Driver;
	lap: Lap;
	part: number;
	/** The place before the lap; null for the car's first time in the part. */
	from: number | null;
	to: number;
	/** Each sector against the session's bests as they stood when the lap was done. */
	marks: readonly [SectorMark, SectorMark, SectorMark];
	/** The quickest of the part so far. */
	fastest: boolean;
};

/** Laps this much slower than the quickest of their part so far are not attempts at a time. */
const FLYING_LAP_LIMIT = 1.12;

const SECTORS = [0, 1, 2] as const;

/**
 * Every lap that improved a car's time in its part, newest first. A run's first lap leaves the
 * garage and does not count, as in the timing tower.
 */
export function improvements(snapshot: RaceSnapshot): Improvement[] {
	const starts = partStarts(snapshot);
	const drivers = new Map(snapshot.drivers.map((driver) => [driver.number, driver]));

	const laps = snapshot.laps
		.filter((lap) => lap.completedAt !== undefined)
		.toSorted((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''));

	const bests = new Map<string, number>();
	const fastestSectors: (number | null)[] = [null, null, null];
	const ownSectors = new Map<string, (number | null)[]>();
	const seen = new Set<string>();
	const found: Improvement[] = [];
	let part = 0;

	for (const lap of laps) {
		const lapPart = partOfLap(lap, starts);

		if (lapPart !== part) {
			part = lapPart;
			bests.clear();
		}

		const runKey = `${lap.driverNumber}-${lapPart}`;
		const firstOfRun = !seen.has(runKey) || lap.pitOut;

		seen.add(runKey);

		const own = ownSectors.get(lap.driverNumber) ?? [null, null, null];

		const marks = SECTORS.map((index): SectorMark => {
			const time = lap.sectorTimesMs[index];
			const fastest = fastestSectors[index] ?? null;
			const personal = own[index] ?? null;

			if (time <= 0) {
				return 'none';
			}

			if (fastest === null || time <= fastest) {
				return 'fastest';
			}

			return personal === null || time < personal ? 'personal-best' : 'none';
		});

		for (const index of SECTORS) {
			const time = lap.sectorTimesMs[index];

			if (time > 0 && !lap.pitIn && !lap.pitOut) {
				fastestSectors[index] = Math.min(fastestSectors[index] ?? time, time);
				own[index] = Math.min(own[index] ?? time, time);
			}
		}

		ownSectors.set(lap.driverNumber, own);

		const quickest = Math.min(...bests.values());
		const previous = bests.get(lap.driverNumber) ?? null;
		const driver = drivers.get(lap.driverNumber);

		if (
			!driver ||
			firstOfRun ||
			lap.pitIn ||
			lap.lapTimeMs <= 0 ||
			(previous !== null && lap.lapTimeMs >= previous) ||
			lap.lapTimeMs > quickest * FLYING_LAP_LIMIT
		) {
			continue;
		}

		const placeOf = (time: number) =>
			1 + [...bests].filter(([number, best]) => number !== lap.driverNumber && best < time).length;

		found.push({
			driver,
			lap,
			part: lapPart,
			from: previous === null ? null : placeOf(previous),
			to: placeOf(lap.lapTimeMs),
			marks: [marks[0] ?? 'none', marks[1] ?? 'none', marks[2] ?? 'none'],
			fastest: lap.lapTimeMs < quickest
		});
		bests.set(lap.driverNumber, lap.lapTimeMs);
	}

	return found.toReversed();
}

/** Improvements made in the last `windowMs` before `timeMs`, newest per car. */
export function recentImprovements(
	found: readonly Improvement[],
	timeMs: number,
	windowMs: number
): Map<string, Improvement> {
	const recent = new Map<string, Improvement>();

	for (const entry of found) {
		const done = Date.parse(entry.lap.completedAt ?? '');

		if (timeMs - done <= windowMs && done <= timeMs && !recent.has(entry.driver.number)) {
			recent.set(entry.driver.number, entry);
		}
	}

	return recent;
}
