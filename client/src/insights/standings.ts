import type { Driver, Lap, RaceSnapshot, Standing, TyreCompound } from '@f1-live/shared';

import { isKnockout, isTimedSession, partOfLap, partStarts, secondPartCars } from './qualifying.ts';

export type SectorMark = 'fastest' | 'personal-best' | 'none';

export type DriverState = 'running' | 'pit' | 'out';

/** Why a car is out of the running order. */
export type OutReason = 'retired' | 'not_started' | 'disqualified';

/** How timing screens print a car that is out. */
export const OUT_LABEL: Record<OutReason, string> = {
	retired: 'DNF',
	not_started: 'DNS',
	disqualified: 'DSQ'
};

export interface StandingRow {
	driver: Driver;
	position: number;
	gridPosition: number | null;
	/** Positive when the driver has gained places since the start. */
	positionsGained: number | null;
	/**
	 * In a race, the gap to the leader. In practice and qualifying, the gap of the best lap to the
	 * fastest one (of the same part, in qualifying).
	 */
	gapToLeaderMs: number | null;
	intervalMs: number | null;
	lapsDown: number;
	lapsCompleted: number;
	lastLap: Lap | null;
	/** The best lap; in qualifying, of the last part the driver set a time in. */
	bestLap: Lap | null;
	/** Qualifying: the best time in each part so far; one entry outside qualifying. */
	partBestsMs: readonly (number | null)[];
	bestLapMs: number | null;
	hasFastestLap: boolean;
	sectorMarks: readonly [SectorMark, SectorMark, SectorMark];
	compound: TyreCompound | null;
	tyreAge: number;
	pitStops: number;
	state: DriverState;
	out: OutReason | null;
	/** The stewards' reason, for a disqualification. */
	outReason: string | null;
	/** Best speed through the speed trap, km/h. */
	speedTrapKph: number | null;
}

const SECTOR_INDEXES = [0, 1, 2] as const;

/**
 * Out-laps and cool-down laps carry a time made of their sectors, but nobody qualifies on one.
 * In qualifying a car's first lap of a part is its out-lap, and of the rest, a lap this much
 * slower than the fastest of its part is a cool-down. A part at a time keeps a wet part next
 * to a dry one.
 */
const FLYING_LAP_LIMIT = 1.12;

function minimum(values: Iterable<number>): number | null {
	let lowest: number | null = null;

	for (const value of values) {
		if (lowest === null || value < lowest) {
			lowest = value;
		}
	}

	return lowest;
}

/** Laps with a time: a race's first lap and untimed laps outside races are left out. */
function isTimed(lap: Lap, timedSession: boolean): boolean {
	return timedSession ? lap.lapTimeMs > 0 : lap.lap > 1;
}

/** Laps whose time the stewards deleted and have not given back, as far as the messages go. */
function deletedLaps(snapshot: RaceSnapshot): Set<Lap> {
	const deleted = new Set<Lap>();

	for (const { driverNumber, lapTimeRuling } of snapshot.raceControl) {
		if (!lapTimeRuling) {
			continue;
		}

		for (const lap of snapshot.laps) {
			const named =
				lapTimeRuling.lapTimeMs === undefined
					? lap.lap === lapTimeRuling.lap
					: lap.lapTimeMs === lapTimeRuling.lapTimeMs;

			if (lap.driverNumber === driverNumber && named) {
				if (lapTimeRuling.reinstated) {
					deleted.delete(lap);
				} else {
					deleted.add(lap);
				}
			}
		}
	}

	return deleted;
}

function bestOf(laps: readonly Lap[]): Lap | null {
	let best: Lap | null = null;

	for (const lap of laps) {
		if (!best || lap.lapTimeMs < best.lapTimeMs) {
			best = lap;
		}
	}

	return best;
}

type RowFacts = Omit<StandingRow, 'position' | 'positionsGained'>;

/** Everything about each driver that does not depend on where they are placed. */
function rowFacts(snapshot: RaceSnapshot, starts: readonly string[]): RowFacts[] {
	const timedSession = isTimedSession(snapshot.session.type);
	const lapsByDriver = new Map<string, Lap[]>();

	for (const lap of snapshot.laps) {
		const driverLaps = lapsByDriver.get(lap.driverNumber) ?? [];

		driverLaps.push(lap);
		lapsByDriver.set(lap.driverNumber, driverLaps);
	}

	const deleted = deletedLaps(snapshot);
	const isCounted = (lap: Lap) => isTimed(lap, timedSession) && !deleted.has(lap);
	const timedLaps = snapshot.laps.filter(isCounted);
	const fastestLapMs = minimum(timedLaps.map((lap) => lap.lapTimeMs));

	const fastestSectors = SECTOR_INDEXES.map((index) =>
		minimum(
			timedLaps.flatMap((lap) => (lap.sectorTimesMs[index] > 0 ? [lap.sectorTimesMs[index]] : []))
		)
	);

	const startedAt = snapshot.startedAt;

	// A car reported out before the start signal did not start.
	const retiredAs = new Map(
		snapshot.retirements.map((retirement) => [
			retirement.driverNumber,
			!timedSession && startedAt && retirement.at && retirement.at < startedAt
				? ('not_started' as const)
				: ('retired' as const)
		])
	);

	const disqualified = new Map(
		(snapshot.corrections ?? []).flatMap((correction) =>
			correction.kind === 'disqualified'
				? [[correction.driverNumber, correction.reason] as const]
				: []
		)
	);

	const gridByDriver = new Map(
		snapshot.startingGrid.map((slot) => [slot.driverNumber, slot.position])
	);

	const speedTraps = new Map(
		(snapshot.personalBests ?? []).map((best) => [best.driverNumber, best.topSpeedsKph.speedTrap])
	);

	// A car's first lap in a part leaves the garage, timed or not, as does a lap out of the pits.
	const seen = new Set<string>();
	const outLaps = new Set<Lap>();

	for (const lap of snapshot.laps) {
		const runKey = `${lap.driverNumber}-${partOfLap(lap, starts)}`;

		if (!seen.has(runKey) || lap.pitOut) {
			outLaps.add(lap);
		}

		seen.add(runKey);
	}

	const candidates = new Set(timedLaps.filter((lap) => !outLaps.has(lap)));

	const fastestOfPart = Array.from({ length: Math.max(1, starts.length) }, (_, index) =>
		minimum(
			[...candidates].flatMap((lap) =>
				partOfLap(lap, starts) === index + 1 ? [lap.lapTimeMs] : []
			)
		)
	);

	const isFlying = (lap: Lap) => {
		const reference = fastestOfPart[partOfLap(lap, starts) - 1] ?? null;

		return (
			candidates.has(lap) && reference !== null && lap.lapTimeMs <= reference * FLYING_LAP_LIMIT
		);
	};

	return snapshot.drivers.map((driver): RowFacts => {
		const driverLaps = lapsByDriver.get(driver.number) ?? [];
		const lastLap = driverLaps.at(-1) ?? null;
		const ownTimedLaps = driverLaps.filter(isCounted);

		const flyingLaps = starts.length > 0 ? ownTimedLaps.filter(isFlying) : ownTimedLaps;

		const lastPart = Math.max(1, ...flyingLaps.map((lap) => partOfLap(lap, starts)));
		const bestLap = bestOf(flyingLaps.filter((lap) => partOfLap(lap, starts) === lastPart));

		const partBestsMs = Array.from({ length: Math.max(1, starts.length) }, (_, index) =>
			minimum(
				flyingLaps.flatMap((lap) => (partOfLap(lap, starts) === index + 1 ? [lap.lapTimeMs] : []))
			)
		);

		const overallBestMs = minimum(ownTimedLaps.map((lap) => lap.lapTimeMs));

		const personalBestSectors = SECTOR_INDEXES.map((index) =>
			minimum(
				ownTimedLaps.flatMap((lap) =>
					lap.sectorTimesMs[index] > 0 ? [lap.sectorTimesMs[index]] : []
				)
			)
		);

		const sectorMark = (index: 0 | 1 | 2): SectorMark => {
			const time = lastLap && isTimed(lastLap, timedSession) ? lastLap.sectorTimesMs[index] : null;

			if (time === null || time === 0) {
				return 'none';
			}

			if (time === fastestSectors[index]) {
				return 'fastest';
			}

			return time === personalBestSectors[index] ? 'personal-best' : 'none';
		};

		const lapsDown = lastLap ? snapshot.currentLap - lastLap.lap : snapshot.currentLap;
		const dsqReason = disqualified.get(driver.number);

		const out: OutReason | null =
			dsqReason !== undefined ? 'disqualified' : (retiredAs.get(driver.number) ?? null);

		return {
			driver,
			gridPosition: gridByDriver.get(driver.number) ?? null,
			gapToLeaderMs: lastLap && lapsDown === 0 ? lastLap.gapToLeaderMs : null,
			intervalMs: lastLap && lapsDown === 0 ? lastLap.intervalMs : null,
			lapsDown: timedSession ? 0 : lapsDown,
			lapsCompleted: lastLap?.lap ?? 0,
			lastLap,
			bestLap,
			partBestsMs,
			bestLapMs: timedSession ? (bestLap?.lapTimeMs ?? null) : overallBestMs,
			hasFastestLap: overallBestMs !== null && overallBestMs === fastestLapMs,
			sectorMarks: [sectorMark(0), sectorMark(1), sectorMark(2)],
			compound: lastLap?.compound ?? null,
			tyreAge: lastLap?.tyreAge ?? 0,
			pitStops: snapshot.pitStops.filter((stop) => stop.driverNumber === driver.number).length,
			state: out ? 'out' : lastLap?.pitIn ? 'pit' : 'running',
			out,
			outReason: dsqReason ?? null,
			speedTrapKph: speedTraps.get(driver.number) ?? null
		};
	});
}

function placed(rows: readonly RowFacts[]): StandingRow[] {
	return rows.map((row, index) => ({
		...row,
		position: index + 1,
		positionsGained: row.gridPosition === null || row.out ? null : row.gridPosition - (index + 1)
	}));
}

/** A race slice: by laps completed, then by the order at the line; cars that are out go last. */
function raceOrder(snapshot: RaceSnapshot, rows: RowFacts[]): RowFacts[] {
	if (snapshot.laps.length === 0) {
		const grid = new Map(snapshot.startingGrid.map((slot) => [slot.driverNumber, slot.position]));

		return rows.toSorted(
			(a, b) => (grid.get(a.driver.number) ?? Infinity) - (grid.get(b.driver.number) ?? Infinity)
		);
	}

	return rows.toSorted((a, b) => {
		if ((a.state === 'out') !== (b.state === 'out')) {
			return a.state === 'out' ? 1 : -1;
		}

		if (a.lapsCompleted !== b.lapsCompleted) {
			return b.lapsCompleted - a.lapsCompleted;
		}

		return (a.lastLap?.position ?? Infinity) - (b.lastLap?.position ?? Infinity);
	});
}

/**
 * Gaps of the cars still running on the leader's lap, measured from the first of them to the car
 * ahead: a lap's own gaps count a car that was disqualified since as the leader or as the car in
 * front.
 */
function relinkedGaps(rows: RowFacts[]): RowFacts[] {
	let leaderGapMs: number | null = null;
	let aheadGapMs: number | null = null;

	return rows.map((row) => {
		if (row.state === 'out' || row.gapToLeaderMs === null) {
			return row;
		}

		leaderGapMs ??= row.gapToLeaderMs;

		const gapToLeaderMs = row.gapToLeaderMs - leaderGapMs;
		const intervalMs = aheadGapMs === null ? 0 : gapToLeaderMs - aheadGapMs;

		aheadGapMs = gapToLeaderMs;

		return { ...row, gapToLeaderMs, intervalMs };
	});
}

/**
 * The feed's own running order, refreshed between lap crossings and corrected after the race. In
 * a race its gaps are newer than those of the last crossing.
 */
function feedOrder(
	snapshot: RaceSnapshot,
	rows: RowFacts[],
	standings: readonly Standing[]
): RowFacts[] {
	const byDriver = new Map(standings.map((standing) => [standing.driverNumber, standing]));
	const leaderLaps = Math.max(0, ...standings.map((standing) => standing.lapsCompleted));
	const timedSession = isTimedSession(snapshot.session.type);

	return rows
		.map((row) => {
			const standing = byDriver.get(row.driver.number);

			if (!standing || timedSession) {
				return row;
			}

			const out: OutReason | null = standing.disqualified
				? 'disqualified'
				: standing.retired
					? (row.out ?? 'retired')
					: row.out;

			return {
				...row,
				gapToLeaderMs: standing.gapToLeaderMs,
				intervalMs: standing.intervalMs,
				lapsDown: leaderLaps - standing.lapsCompleted,
				state: out ? 'out' : standing.inPit ? 'pit' : 'running',
				out
			} satisfies RowFacts;
		})
		.toSorted(
			(a, b) =>
				(byDriver.get(a.driver.number)?.position ?? Infinity) -
				(byDriver.get(b.driver.number)?.position ?? Infinity)
		);
}

/**
 * Practice and qualifying: fastest first. In qualifying the cars knocked out in a part keep
 * their place under those that went through, ranked by their time in that part.
 */
function timedOrder(rows: RowFacts[], starts: readonly string[]): RowFacts[] {
	const byTime = (a: RowFacts, b: RowFacts) =>
		(a.bestLapMs ?? Infinity) - (b.bestLapMs ?? Infinity) ||
		Number(a.driver.number) - Number(b.driver.number);

	if (starts.length < 2) {
		return rows.toSorted(byTime);
	}

	const partBest = (row: RowFacts, part: number) => row.partBestsMs[part - 1] ?? Infinity;

	// By the time in a part; cars without one there follow, by their time in the part before.
	const rankIn = (part: number) => (a: RowFacts, b: RowFacts) => {
		for (let earlier = part; earlier >= 1; earlier--) {
			const difference = partBest(a, earlier) - partBest(b, earlier);

			if (difference !== 0 && Number.isFinite(difference)) {
				return difference;
			}

			if (partBest(a, earlier) !== partBest(b, earlier)) {
				return partBest(a, earlier) === Infinity ? 1 : -1;
			}
		}

		return Number(a.driver.number) - Number(b.driver.number);
	};

	let field = rows;
	const knockedOut: RowFacts[][] = [];
	const goThrough = [secondPartCars(rows.length), 10];

	for (const [index, cars] of goThrough.entries()) {
		const part = index + 1;

		if (starts.length <= part) {
			break;
		}

		const ranked = field.toSorted(rankIn(part));

		knockedOut.unshift(ranked.slice(cars));
		field = ranked.slice(0, cars);
	}

	return [...field.toSorted(rankIn(Math.min(starts.length, 3))), ...knockedOut.flat()];
}

/** The part a row's best lap is from, counted from 0: the last one the driver set a time in. */
export function lastTimedPart(row: Pick<StandingRow, 'partBestsMs'>): number {
	return row.partBestsMs.findLastIndex((time) => time !== null);
}

/**
 * Gaps of a timed session, part by part as the official timing gives them: a car out in the
 * first part of qualifying is measured against the fastest time of that part.
 */
function withTimedGaps(rows: StandingRow[]): StandingRow[] {
	const fastestByPart = (part: number) =>
		minimum(rows.flatMap((row) => row.partBestsMs[part] ?? []));

	return rows.map((row, index) => {
		const part = lastTimedPart(row);
		const own = part === -1 ? null : (row.partBestsMs[part] ?? null);
		const fastest = part === -1 ? null : fastestByPart(part);
		const above = rows[index - 1];

		// Intervals stay within a part: the first car out in a part is measured to its fastest.
		const ahead =
			above && part !== -1 && lastTimedPart(above) === part
				? (above.partBestsMs[part] ?? null)
				: null;

		const interval = own === null || ahead === null ? null : own - ahead;

		return {
			...row,
			gapToLeaderMs: own === null || fastest === null ? null : own - fastest,
			// A car ranked behind a quicker time in this part (by another part's time) has no
			// interval to show.
			intervalMs: interval !== null && interval >= 0 ? interval : null
		};
	});
}

/**
 * The running order of the snapshot. A snapshot that carries the feed's own order (the latest
 * state of a session) is shown in that order; a replay slice is ranked from its laps.
 */
export function standingsAt(snapshot: RaceSnapshot): StandingRow[] {
	const starts = isKnockout(snapshot.session.type) ? partStarts(snapshot) : [];
	const rows = rowFacts(snapshot, starts);
	const standings = snapshot.standings ?? [];
	const timedSession = isTimedSession(snapshot.session.type);
	const hasFeedOrder = standings.length > 0 && snapshot.laps.length > 0;

	if (!timedSession) {
		return placed(
			hasFeedOrder ? feedOrder(snapshot, rows, standings) : relinkedGaps(raceOrder(snapshot, rows))
		);
	}

	return withTimedGaps(
		placed(hasFeedOrder ? feedOrder(snapshot, rows, standings) : timedOrder(rows, starts))
	);
}
