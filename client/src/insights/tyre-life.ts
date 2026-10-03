import {
	TYRE_COMPOUNDS,
	type Lap,
	type RaceSnapshot,
	type Stint,
	type TyreCompound
} from '@f1-live/shared';

import { average, FUEL_EFFECT_SECONDS_PER_LAP, isCleanLap } from './clean-laps.ts';
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
	/** A new set against the quickest compound's new set; 0 for the quickest. */
	newOffsetS: number;
	/** The tyre age the loss steepens at, and how steep it gets; null without a cliff. */
	cliff: { age: number; wearSecondsPerLap: number } | null;
	runs: number;
	laps: number;
}

/** The age of `from` at which a new set of the harder `to` is already the quicker tyre. */
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

function median(values: readonly number[]): number {
	const sorted = values.toSorted((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);

	return sorted.length % 2 === 1
		? (sorted[middle] ?? 0)
		: ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * A lap time with the fuel burnt so far added back, so a run's laps compare as if on one fuel
 * load. Within a race this matches removing the fuel still on board, up to one constant.
 */
export function fuelCorrectedLapSeconds(lap: Pick<Lap, 'lapTimeMs' | 'lap'>): number {
	return lap.lapTimeMs / 1000 + FUEL_EFFECT_SECONDS_PER_LAP * lap.lap;
}

function runsOf(snapshot: RaceSnapshot): Run[] {
	return snapshot.stints.flatMap((stint) => {
		const laps = snapshot.laps.filter(
			(lap) =>
				lap.driverNumber === stint.driverNumber &&
				lap.lap >= stint.startLap &&
				lap.lap <= stint.endLap &&
				isCleanLap(lap)
		);

		const corrected = laps.map((lap) => ({
			age: lap.tyreAge,
			seconds: fuelCorrectedLapSeconds(lap)
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

/**
 * Tyre life per compound from every run of five or more clean laps: the fuel burn added back,
 * each run's own level taken out, and the median loss at each tyre age. In a race the compounds
 * share one fuel baseline, so their pace when new is compared through the drivers who ran both,
 * and so is the crossover: the age at which a new set of a harder compound is already quicker.
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

	// A compound's pace when new, against the first compound, from drivers who ran both.
	const reference = byCompound[0];

	const offsets = new Map(
		byCompound.map((entry) => {
			if (timed || !reference || entry === reference) {
				return [entry.compound, 0];
			}

			const differences = entry.runs.flatMap((run, index) => {
				const theirs = reference.runs.flatMap((other, at) =>
					other.stint.driverNumber === run.stint.driverNumber ? [reference.levels[at] ?? 0] : []
				);

				return theirs.length > 0 ? [(entry.levels[index] ?? 0) - median(theirs)] : [];
			});

			return [entry.compound, differences.length > 0 ? median(differences) : Number.NaN];
		})
	);

	const quickest = Math.min(...[...offsets.values()].filter(Number.isFinite), 0);

	const compounds = byCompound.flatMap((entry): CompoundLife[] => {
		const offset = (offsets.get(entry.compound) ?? Number.NaN) - quickest;

		if (!Number.isFinite(offset)) {
			return [];
		}

		const deltasByAge = new Map<number, number[]>();

		for (const [index, run] of entry.runs.entries()) {
			for (const lap of run.laps) {
				const deltas = deltasByAge.get(lap.age) ?? [];

				deltas.push(lap.seconds - (entry.levels[index] ?? 0) + offset);
				deltasByAge.set(lap.age, deltas);
			}
		}

		const points = [...deltasByAge]
			.flatMap(([age, deltas]) =>
				deltas.length >= MIN_RUNS_PER_AGE
					? [{ age, deltaS: median(deltas), runs: deltas.length }]
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
 * For each pair where the softer compound is quicker when new but wears, the first age at which
 * it has lost more than its head start: from then on, a new set of the harder one is quicker.
 * Only ages the softer compound has actually run are reported.
 */
export function crossoversOf(compounds: readonly CompoundLife[]): Crossover[] {
	return compounds.flatMap((from) =>
		compounds.flatMap((to): Crossover[] => {
			const headStart = to.newOffsetS - from.newOffsetS;
			const lastAge = from.points.at(-1)?.age ?? 0;

			if (to === from || headStart <= 0) {
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
