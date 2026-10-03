/** How far round the lap a car was at a moment: laps done plus the share of the lap. */
export type ProgressAt = (driverNumber: string, time: number) => number | null;

/** Road gaps are looked for this far back; a car further behind is a lap down or out of reach. */
const LOOK_BACK_MS = 60_000;

const SEARCH_STEPS = 14;

/**
 * How long ago `ahead` was where `behind` is now: the gap on the road, in ms, the way timing
 * screens measure an interval. Null when `ahead` is not ahead, or further away than the search.
 */
export function roadGapMs(
	progressAt: ProgressAt,
	ahead: string,
	behind: string,
	time: number
): number | null {
	const target = progressAt(behind, time);
	const now = progressAt(ahead, time);

	if (target === null || now === null || now < target) {
		return null;
	}

	let early = time - LOOK_BACK_MS;
	let late = time;
	const earliest = progressAt(ahead, early);

	if (earliest === null || earliest > target) {
		return null;
	}

	// Progress only grows, so halving the window finds the moment `ahead` passed `target`. A
	// moment with no place (a gap in the data) gives no gap rather than a wrong one.
	for (let step = 0; step < SEARCH_STEPS; step++) {
		const middle = (early + late) / 2;
		const progress = progressAt(ahead, middle);

		if (progress === null) {
			return null;
		}

		if (progress < target) {
			early = middle;
		} else {
			late = middle;
		}
	}

	return time - (early + late) / 2;
}

/** Below this pace advantage a projection is noise. */
const MIN_CLOSING_S = 0.05;

/**
 * Laps until a chaser `intervalS` behind, gaining `closingS` a lap, is within `rangeS` (one
 * second for DRS or overtake mode): 0 when already there, null when not closing.
 */
export function lapsUntilInRange(
	intervalS: number,
	closingS: number | null,
	rangeS: number
): number | null {
	if (intervalS <= rangeS) {
		return 0;
	}

	if (closingS === null || closingS < MIN_CLOSING_S) {
		return null;
	}

	return Math.ceil((intervalS - rangeS) / closingS);
}

type Nearest = { driverNumber: string; byM: number };

/** The racing numbers of the nearest cars ahead and behind; null where there is none. */
export type Neighbours = { ahead: string | null; behind: string | null };

/** A car somewhere round the lap, or in the pit lane (null). */
export type LapPlace = { driverNumber: string; distanceM: number | null };

/**
 * The nearest cars ahead and behind on the road, measured round the circuit from `driverNumber`
 * whatever lap each is on: in practice and qualifying these are the traffic, not rivals.
 */
export function roadNeighbours(
	cars: readonly LapPlace[],
	driverNumber: string,
	lengthM: number
): Neighbours {
	const subject = cars.find((car) => car.driverNumber === driverNumber)?.distanceM;
	let ahead: Nearest | null = null;
	let behind: Nearest | null = null;

	if (subject === null || subject === undefined) {
		return { ahead: null, behind: null };
	}

	for (const car of cars) {
		if (car.driverNumber === driverNumber || car.distanceM === null) {
			continue;
		}

		const forward = (((car.distanceM - subject) % lengthM) + lengthM) % lengthM;

		if (forward <= lengthM / 2) {
			if (!ahead || forward < ahead.byM) {
				ahead = { driverNumber: car.driverNumber, byM: forward };
			}
		} else if (!behind || lengthM - forward < behind.byM) {
			behind = { driverNumber: car.driverNumber, byM: lengthM - forward };
		}
	}

	return { ahead: ahead?.driverNumber ?? null, behind: behind?.driverNumber ?? null };
}
