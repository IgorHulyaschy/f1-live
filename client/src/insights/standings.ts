import type { Driver, Lap, RaceSnapshot, Standing, TyreCompound } from '@f1-live/shared';

import { isTimedSession, partOfLap, partStarts, secondPartCars } from './qualifying.ts';

export type SectorMark = 'fastest' | 'personal-best' | 'none';

export type DriverState = 'running' | 'pit' | 'out';

/** Why a car is out of the running order. */
export type OutReason = 'retired' | 'disqualified';

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
 * Out-laps and cool-down laps carry a time made of their sectors, but nobody qualifies on one:
 * a lap this much slower than the fastest of the session is not counted as a part's best.
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
function rowFacts(snapshot: RaceSnapshot): RowFacts[] {
	const timedSession = isTimedSession(snapshot.session.type);
	const lapsByDriver = new Map<string, Lap[]>();

	for (const lap of snapshot.laps) {
		const driverLaps = lapsByDriver.get(lap.driverNumber) ?? [];

		driverLaps.push(lap);
		lapsByDriver.set(lap.driverNumber, driverLaps);
	}

	const timedLaps = snapshot.laps.filter((lap) => isTimed(lap, timedSession));
	const fastestLapMs = minimum(timedLaps.map((lap) => lap.lapTimeMs));

	const fastestSectors = SECTOR_INDEXES.map((index) =>
		minimum(
			timedLaps.flatMap((lap) => (lap.sectorTimesMs[index] > 0 ? [lap.sectorTimesMs[index]] : []))
		)
	);

	const retiredNumbers = new Set(snapshot.retirements.map((retirement) => retirement.driverNumber));

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

	const starts =
		snapshot.session.type === 'qualifying' || snapshot.session.type === 'sprint_qualifying'
			? partStarts(snapshot)
			: [];

	return snapshot.drivers.map((driver): RowFacts => {
		const driverLaps = lapsByDriver.get(driver.number) ?? [];
		const lastLap = driverLaps.at(-1) ?? null;
		const ownTimedLaps = driverLaps.filter((lap) => isTimed(lap, timedSession));

		const flyingLaps = ownTimedLaps.filter(
			(lap) => fastestLapMs === null || lap.lapTimeMs <= fastestLapMs * FLYING_LAP_LIMIT
		);

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
			dsqReason !== undefined
				? 'disqualified'
				: retiredNumbers.has(driver.number)
					? 'retired'
					: null;

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
					? 'retired'
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
function timedOrder(snapshot: RaceSnapshot, rows: RowFacts[]): RowFacts[] {
	const starts = partStarts(snapshot);

	const byTime = (a: RowFacts, b: RowFacts) =>
		(a.bestLapMs ?? Infinity) - (b.bestLapMs ?? Infinity) ||
		Number(a.driver.number) - Number(b.driver.number);

	if (starts.length < 2) {
		return rows.toSorted(byTime);
	}

	const partBest = (row: RowFacts, part: number) => row.partBestsMs[part - 1] ?? Infinity;

	let field = rows;
	const knockedOut: RowFacts[][] = [];
	const goThrough = [secondPartCars(rows.length), 10];

	for (const [index, cars] of goThrough.entries()) {
		const part = index + 1;

		if (starts.length <= part) {
			break;
		}

		const ranked = field.toSorted((a, b) => partBest(a, part) - partBest(b, part));

		knockedOut.unshift(ranked.slice(cars));
		field = ranked.slice(0, cars);
	}

	return [...field.toSorted(byTime), ...knockedOut.flat()];
}

/** The part a row's best lap is from: the last one the driver set a time in. */
function lastTimedPart(row: StandingRow): number {
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
		const ahead = index > 0 && part !== -1 ? (rows[index - 1]?.partBestsMs[part] ?? null) : null;
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
	const rows = rowFacts(snapshot);
	const standings = snapshot.standings ?? [];
	const timedSession = isTimedSession(snapshot.session.type);
	const hasFeedOrder = standings.length > 0 && snapshot.laps.length > 0;

	if (!timedSession) {
		return placed(hasFeedOrder ? feedOrder(snapshot, rows, standings) : raceOrder(snapshot, rows));
	}

	return withTimedGaps(
		placed(hasFeedOrder ? feedOrder(snapshot, rows, standings) : timedOrder(snapshot, rows))
	);
}
