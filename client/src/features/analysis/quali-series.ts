import type { Driver, RaceSnapshot } from '@f1-live/shared';

import { bestLaps, timedParts } from '../../insights/gap-distance.ts';
import { partOfLap, partStarts } from '../../insights/qualifying.ts';
import { countedLaps } from '../../insights/standings.ts';

/** One row of a qualifying chart: `t` (minutes into the session) or `part`, then values by key. */
export type QualiPoint = Record<string, number>;

/** A part of qualifying on the session clock, in minutes from the start of Q1. */
export type PartSpan = { part: number; from: number; to: number };

/** The key of a driver's best-so-far line within a part. */
export function bestKey(code: string, part: number): string {
	return `${code}~Q${part}`;
}

function minutesFrom(start: number, at: string): number {
	return (Date.parse(at) - start) / 60_000;
}

/**
 * Push laps by session time: each driver's flying laps as points, and for each part a line of
 * their best so far that steps down at every improvement. Out, in and cool-down laps are left
 * out, as are laps the stewards deleted.
 */
export function qualiLapPoints(snapshot: RaceSnapshot, drivers: readonly Driver[]): QualiPoint[] {
	const starts = partStarts(snapshot);
	const origin = starts[0] ? Date.parse(starts[0]) : null;
	const codes = new Map(drivers.map((driver) => [driver.number, driver.code]));
	const best = new Map<string, number>();

	if (origin === null) {
		return [];
	}

	return countedLaps(snapshot)
		.filter((lap) => codes.has(lap.driverNumber) && lap.completedAt)
		.toSorted((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''))
		.map((lap) => {
			const code = codes.get(lap.driverNumber) ?? '';
			const part = partOfLap(lap, starts);
			const key = bestKey(code, part);
			const seconds = lap.lapTimeMs / 1000;
			const sofar = Math.min(best.get(key) ?? Infinity, seconds);

			best.set(key, sofar);

			return { t: minutesFrom(origin, lap.completedAt ?? ''), [code]: seconds, [key]: sofar };
		});
}

/** Each part's span on the session clock, the last one running to the latest lap. */
export function partSpans(snapshot: RaceSnapshot): PartSpan[] {
	const starts = partStarts(snapshot);
	const origin = starts[0] ? Date.parse(starts[0]) : null;

	if (origin === null) {
		return [];
	}

	const last = snapshot.laps.reduce(
		(latest, lap) => (lap.completedAt && lap.completedAt > latest ? lap.completedAt : latest),
		starts.at(-1) ?? ''
	);

	return starts.map((start, index) => ({
		part: index + 1,
		from: minutesFrom(origin, start),
		to: minutesFrom(origin, starts[index + 1] ?? last)
	}));
}

/**
 * One row per part: each compared driver's best lap behind that part's fastest, in seconds, or
 * their place in that part's order.
 */
export function qualiPartPoints(
	snapshot: RaceSnapshot,
	drivers: readonly Driver[],
	metric: 'gap' | 'position' | 'lapTime'
): QualiPoint[] {
	const codes = new Map(drivers.map((driver) => [driver.number, driver.code]));

	return timedParts(snapshot).map((part) => {
		const order = bestLaps(snapshot, part);
		const fastest = order[0]?.lapTimeMs ?? 0;

		const values = order.flatMap((lap, index) => {
			const code = codes.get(lap.driverNumber);

			const value =
				metric === 'gap'
					? (lap.lapTimeMs - fastest) / 1000
					: metric === 'position'
						? index + 1
						: lap.lapTimeMs / 1000;

			return code ? [[code, value] as const] : [];
		});

		return { part, ...Object.fromEntries(values) };
	});
}
