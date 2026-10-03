import { type LapClock, type LapIndex, timeAtDistance, type TrackOutline } from '@f1-live/shared';

import { isComparableLap } from '../../insights/telemetry-traces.ts';

/** Each mini sector's time on one lap, ms, read off the lap's own clock at the mini-sector ends. */
export function miniSectorTimes(outline: TrackOutline, lap: LapClock): number[] {
	const ends = [...outline.miniSectorStartsM.slice(1), outline.lengthM];
	const lastDistance = lap.distanceM[lap.distanceM.length - 1] ?? 0;
	let from = timeAtDistance(lap, outline.miniSectorStartsM[0] ?? 0);

	return ends.map((end) => {
		// The last mini sector ends at the line, which the lap's final row is.
		const to = timeAtDistance(lap, Math.min(end, lastDistance));
		const time = to - from;

		from = to;

		return time;
	});
}

/** Per mini sector, the quickest of a set of laps; null where none timed it. */
export function bestOf(laps: readonly (readonly (number | null)[])[]): (number | null)[] {
	const length = Math.max(0, ...laps.map((lap) => lap.length));

	return Array.from({ length }, (_, index) => {
		let best: number | null = null;

		for (const lap of laps) {
			const time = lap[index] ?? null;

			if (time !== null && time > 0 && (best === null || time < best)) {
				best = time;
			}
		}

		return best;
	});
}

export type Dominance = {
	/** The quickest driver in each mini sector, null where none of them has a time. */
	winners: (string | null)[];
	/** Mini sectors won by each driver. */
	won: ReadonlyMap<string, number>;
	/** Each driver's time lost to the quickest, summed over the mini sectors, ms. */
	lostMs: ReadonlyMap<string, number>;
};

/**
 * Who is quickest in each mini sector among `drivers`. Where the timing loops name the holder of
 * the session's fastest time (`leaders`) and it is one of them, the loops decide; times measured
 * between published loops are a tenth or so off and settle the rest.
 */
export function dominance(
	drivers: readonly string[],
	times: ReadonlyMap<string, readonly (number | null)[]>,
	leaders: readonly (string | null)[] = []
): Dominance {
	const count = Math.max(0, ...drivers.map((driver) => times.get(driver)?.length ?? 0));
	const won = new Map(drivers.map((driver) => [driver, 0]));
	const lostMs = new Map(drivers.map((driver) => [driver, 0]));

	const winners = Array.from({ length: count }, (_, index) => {
		const timed = drivers.flatMap((driver) => {
			const time = times.get(driver)?.[index] ?? null;

			return time !== null && time > 0 ? [{ driver, time }] : [];
		});

		if (timed.length === 0) {
			return null;
		}

		const quickest = timed.reduce((best, entry) => (entry.time < best.time ? entry : best));
		const leader = leaders[index] ?? null;
		const winner = leader !== null && drivers.includes(leader) ? leader : quickest.driver;

		for (const entry of timed) {
			lostMs.set(entry.driver, (lostMs.get(entry.driver) ?? 0) + entry.time - quickest.time);
		}

		won.set(winner, (won.get(winner) ?? 0) + 1);

		return winner;
	});

	return { winners, won, lostMs };
}

/** Dominance compares each driver's fastest lap, or the best of each mini sector over their fastest few. */
export type DominanceSpan = 'lap' | 'best';

/** In "best minis", the fastest few laps of each driver are read: where the best minis come from. */
const LAPS_READ = 8;

type LapEntry = LapIndex['laps'][number];

/**
 * The laps to read per driver: the fastest lap, or the fastest few for the best of each mini sector.
 * Only laps recorded line to line count; one cut short would win the mini sectors it never ran.
 */
export function lapsToRead(
	index: LapIndex,
	drivers: readonly string[],
	span: DominanceSpan,
	until: number,
	lengthM: number
): LapEntry[] {
	return drivers.flatMap((driverNumber) =>
		index.laps
			.filter(
				(entry) =>
					entry.driverNumber === driverNumber &&
					isComparableLap(entry, lengthM) &&
					Date.parse(entry.startedAt) + entry.lapTimeMs <= until
			)
			.toSorted((a, b) => a.lapTimeMs - b.lapTimeMs)
			.slice(0, span === 'lap' ? 1 : LAPS_READ)
	);
}
