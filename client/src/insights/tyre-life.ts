import { TYRE_COMPOUNDS, type RaceSnapshot, type Stint, type TyreCompound } from '@f1-live/shared';

import { average, fuelCorrectedSeconds, isCleanLap, median } from './clean-laps.ts';
import { isKnockout, isTimedSession } from './qualifying.ts';

/** A run shorter than this says nothing about wear. */
const MIN_RUN_LAPS = 5;

/** Laps this much slower than the run's quickest are traffic, a cool-down lap or a mistake. */
const OUTLIER_SHARE = 1.05;

/** A compound needs this many runs before its wear means anything. */
const MIN_COMPOUND_RUNS = 3;

/** A tyre age is drawn once this many runs reached it. */
const MIN_RUNS_PER_AGE = 2;

/** A cliff is a second slope at least this much steeper, per lap, than the first. */
const CLIFF_STEEPER_BY = 0.08;

/** And it must explain the curve this much better than one straight line. */
const CLIFF_FIT_GAIN = 0.3;

/** Laps a cliff needs on each side to be told from noise. */
const CLIFF_SIDE_LAPS = 4;

export interface TyreLifePoint {
	age: number;
	/** Median lap time at this age against the quickest compound when new, in seconds. */
	deltaS: number;
	runs: number;
}

export interface CompoundLife {
	compound: TyreCompound;
	points: TyreLifePoint[];
	/** Loss per lap of tyre age with the fuel burn taken out, before any cliff. */
	wearSecondsPerLap: number;
	/**
	 * A new set against the quickest compound's new set; 0 for the quickest. Null when no driver
	 * ran it with another compound, so its pace when new cannot be compared.
	 */
	newOffsetS: number | null;
	/** The tyre age the loss steepens at, and how steep it gets; null without a cliff. */
	cliff: { age: number; wearSecondsPerLap: number } | null;
	runs: number;
	laps: number;
}

/** The age of `from` at which a new set of `to`, slower when new, is already the quicker tyre. */
export interface Crossover {
	from: TyreCompound;
	to: TyreCompound;
	age: number;
}

export interface TyreLife {
	compounds: CompoundLife[];
	crossovers: Crossover[];
	/**
	 * False in practice: every run starts with its own fuel load, so compounds compare only by how
	 * fast they wear, not by their pace when new.
	 */
	comparable: boolean;
}

type RunLap = { age: number; seconds: number };

type Run = { stint: Stint; laps: RunLap[] };

function runsOf(snapshot: RaceSnapshot): Run[] {
	return snapshot.stints.flatMap((stint) => {
		const laps = snapshot.laps.filter(
			(lap) =>
				lap.driverNumber === stint.driverNumber &&
				lap.lap >= stint.startLap &&
				lap.lap <= stint.endLap &&
				isCleanLap(lap)
		);

		// The fuel still on board taken out; in practice, where the distance is unknown, the fuel
		// burnt so far added back. Either way each run's laps compare as if on one load.
		const corrected = laps.map((lap) => ({
			age: lap.tyreAge,
			seconds: fuelCorrectedSeconds(lap, snapshot.session.totalLaps)
		}));

		const quickest = Math.min(...corrected.map((lap) => lap.seconds));
		const kept = corrected.filter((lap) => lap.seconds <= quickest * OUTLIER_SHARE);

		return kept.length >= MIN_RUN_LAPS ? [{ stint, laps: kept }] : [];
	});
}

/** The slope shared by every run, each with its own level: the within-run least-squares fit. */
function pooledSlope(runs: readonly Run[]): number {
	let covariance = 0;
	let variance = 0;

	for (const run of runs) {
		const meanAge = average(run.laps.map((lap) => lap.age)) ?? 0;
		const meanSeconds = average(run.laps.map((lap) => lap.seconds)) ?? 0;

		for (const lap of run.laps) {
			covariance += (lap.age - meanAge) * (lap.seconds - meanSeconds);
			variance += (lap.age - meanAge) ** 2;
		}
	}

	return variance === 0 ? 0 : covariance / variance;
}

/** A run's level: its fitted time on a new set. */
function runLevel(run: Run, slope: number): number {
	return average(run.laps.map((lap) => lap.seconds - slope * lap.age)) ?? 0;
}

interface Line {
	slope: number;
	intercept: number;
	error: number;
}

function fitLine(points: readonly TyreLifePoint[]): Line {
	const meanX = average(points.map((point) => point.age)) ?? 0;
	const meanY = average(points.map((point) => point.deltaS)) ?? 0;
	let covariance = 0;
	let variance = 0;

	for (const point of points) {
		covariance += (point.age - meanX) * (point.deltaS - meanY);
		variance += (point.age - meanX) ** 2;
	}

	const slope = variance === 0 ? 0 : covariance / variance;
	const intercept = meanY - slope * meanX;

	const error = points.reduce(
		(sum, point) => sum + (point.deltaS - intercept - slope * point.age) ** 2,
		0
	);

	return { slope, intercept, error };
}

/**
 * Where the loss steepens: the split into two straight lines that fits best, kept only when the
 * second is clearly steeper and the split clearly fits better than one line.
 */
export function findCliff(points: readonly TyreLifePoint[]): CompoundLife['cliff'] {
	const whole = fitLine(points);
	let best: { age: number; first: Line; second: Line } | null = null;

	for (let split = CLIFF_SIDE_LAPS; split <= points.length - CLIFF_SIDE_LAPS; split++) {
		const first = fitLine(points.slice(0, split));
		const second = fitLine(points.slice(split - 1));

		if (!best || first.error + second.error < best.first.error + best.second.error) {
			best = { age: points[split - 1]?.age ?? 0, first, second };
		}
	}

	if (
		!best ||
		best.second.slope - best.first.slope < CLIFF_STEEPER_BY ||
		best.first.error + best.second.error > whole.error * (1 - CLIFF_FIT_GAIN)
	) {
		return null;
	}

	return { age: best.age, wearSecondsPerLap: best.second.slope };
}

type CompoundRuns = { compound: TyreCompound; runs: Run[]; levels: number[] };

/** One compound's pace when new against another's, from the drivers who ran both; null if none did. */
function pairOffset(entry: CompoundRuns, other: CompoundRuns): number | null {
	const differences = entry.runs.flatMap((run, index) => {
		const theirs = other.runs.flatMap((candidate, at) =>
			candidate.stint.driverNumber === run.stint.driverNumber ? [other.levels[at] ?? 0] : []
		);

		const level = median(theirs);

		return level === null ? [] : [(entry.levels[index] ?? 0) - level];
	});

	return median(differences);
}

/** The compounds linked to `start` through any chain of shared drivers, with their offsets. */
function linkedFrom(
	start: CompoundRuns,
	entries: readonly CompoundRuns[]
): Map<TyreCompound, number> {
	const offsets = new Map<TyreCompound, number>([[start.compound, 0]]);
	let added = true;

	while (added) {
		added = false;

		for (const entry of entries) {
			if (offsets.has(entry.compound)) {
				continue;
			}

			for (const other of entries) {
				const base = offsets.get(other.compound);
				const offset = base === undefined ? null : pairOffset(entry, other);

				if (base !== undefined && offset !== null) {
					offsets.set(entry.compound, base + offset);
					added = true;
					break;
				}
			}
		}
	}

	return offsets;
}

/**
 * Each compound's pace when new, within the largest group of compounds that share drivers (by
 * runs). A compound outside that group has no comparable pace when new and is left out.
 */
function linkedOffsets(entries: readonly CompoundRuns[]): Map<TyreCompound, number> {
	const runsIn = (group: ReadonlyMap<TyreCompound, number>) =>
		entries.reduce((sum, entry) => sum + (group.has(entry.compound) ? entry.runs.length : 0), 0);

	return entries
		.map((entry) => linkedFrom(entry, entries))
		.reduce<Map<TyreCompound, number>>(
			(best, group) => (runsIn(group) > runsIn(best) ? group : best),
			new Map()
		);
}

/**
 * Tyre life per compound from every run of five or more clean laps: the fuel effect taken out,
 * each run's own level taken out, and the median loss at each tyre age. In a race the compounds
 * share one fuel baseline, so their pace when new is compared through the drivers who ran both,
 * and so is the crossover: the age at which a new set of a compound slower when new is already
 * the quicker tyre.
 */
export function tyreLife(snapshot: RaceSnapshot): TyreLife {
	const timed = isTimedSession(snapshot.session.type);
	const runs = isKnockout(snapshot.session.type) ? [] : runsOf(snapshot);

	const byCompound = TYRE_COMPOUNDS.flatMap((compound) => {
		const own = runs.filter((run) => run.stint.compound === compound);

		if (own.length < MIN_COMPOUND_RUNS || compound === 'UNKNOWN') {
			return [];
		}

		const slope = pooledSlope(own);

		return [{ compound, runs: own, slope, levels: own.map((run) => runLevel(run, slope)) }];
	});

	const offsets = timed
		? new Map(byCompound.map((entry) => [entry.compound, 0]))
		: linkedOffsets(byCompound);

	const quickest = Math.min(0, ...offsets.values());

	const compounds = byCompound.flatMap((entry): CompoundLife[] => {
		const linked = offsets.get(entry.compound);
		const offset = linked === undefined ? null : linked - quickest;
		const deltasByAge = new Map<number, number[]>();

		for (const [index, run] of entry.runs.entries()) {
			for (const lap of run.laps) {
				const deltas = deltasByAge.get(lap.age) ?? [];

				deltas.push(lap.seconds - (entry.levels[index] ?? 0) + (offset ?? 0));
				deltasByAge.set(lap.age, deltas);
			}
		}

		const points = [...deltasByAge]
			.flatMap(([age, deltas]) =>
				deltas.length >= MIN_RUNS_PER_AGE
					? [{ age, deltaS: median(deltas) ?? 0, runs: deltas.length }]
					: []
			)
			.toSorted((a, b) => a.age - b.age);

		return [
			{
				compound: entry.compound,
				points,
				wearSecondsPerLap: entry.slope,
				newOffsetS: offset,
				cliff: findCliff(points),
				runs: entry.runs.length,
				laps: entry.runs.reduce((sum, run) => sum + run.laps.length, 0)
			}
		];
	});

	return { compounds, crossovers: timed ? [] : crossoversOf(compounds), comparable: !timed };
}

/** Time a compound has lost at `age` against its new pace, on its fitted line and cliff. */
export function lossAt(life: CompoundLife, age: number): number {
	const { cliff, wearSecondsPerLap } = life;

	return cliff && age > cliff.age
		? wearSecondsPerLap * cliff.age + cliff.wearSecondsPerLap * (age - cliff.age)
		: wearSecondsPerLap * age;
}

/**
 * For each pair where one compound is quicker when new but wears, the first age at which it has
 * lost more than its head start: from then on, a new set of the other is quicker. Only ages the
 * quicker compound has actually run are reported.
 */
export function crossoversOf(compounds: readonly CompoundLife[]): Crossover[] {
	return compounds.flatMap((from) =>
		compounds.flatMap((to): Crossover[] => {
			const lastAge = from.points.at(-1)?.age ?? 0;

			if (to === from || to.newOffsetS === null || from.newOffsetS === null) {
				return [];
			}

			const headStart = to.newOffsetS - from.newOffsetS;

			if (headStart <= 0) {
				return [];
			}

			for (let age = 1; age <= lastAge; age++) {
				if (lossAt(from, age) >= headStart) {
					return [{ from: from.compound, to: to.compound, age }];
				}
			}

			return [];
		})
	);
}
