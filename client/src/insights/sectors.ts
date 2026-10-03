import type { Driver, Lap, RaceSnapshot } from '@f1-live/shared';

const SECTORS = [0, 1, 2] as const;

export type SectorHolder = { driver: Driver; timeMs: number };

export type IdealLap = {
	driver: Driver;
	/** The driver's best time in each sector, from any of their laps. */
	sectorsMs: readonly [number, number, number];
	idealMs: number;
	/** Their best lap; the time between the two is what they left out there. */
	bestMs: number | null;
};

/** A sector time worth comparing: timed, and not run in or out of the pit lane. */
function sectorTime(lap: Lap, index: 0 | 1 | 2): number | null {
	const time = lap.sectorTimesMs[index];

	return time > 0 && !lap.pitIn && !lap.pitOut ? time : null;
}

/**
 * The session's fastest time in each sector and who set it, and each driver's ideal lap: their
 * three best sectors added up, quickest first. Drivers without all three have none.
 */
export type SessionSectors = {
	fastest: readonly (SectorHolder | null)[];
	ideal: IdealLap[];
};

type Sectors = [number | null, number | null, number | null];

export function bestSectors(snapshot: RaceSnapshot): SessionSectors {
	const drivers = new Map(snapshot.drivers.map((driver) => [driver.number, driver]));
	const own = new Map<string, Sectors>();
	const bestLap = new Map<string, number>();

	for (const lap of snapshot.laps) {
		const sectors: Sectors = own.get(lap.driverNumber) ?? [null, null, null];

		for (const index of SECTORS) {
			const time = sectorTime(lap, index);
			const current = sectors[index];

			if (time !== null && (current === null || time < current)) {
				sectors[index] = time;
			}
		}

		own.set(lap.driverNumber, sectors);

		if (lap.lapTimeMs > 0 && !lap.pitIn && !lap.pitOut) {
			bestLap.set(
				lap.driverNumber,
				Math.min(bestLap.get(lap.driverNumber) ?? Infinity, lap.lapTimeMs)
			);
		}
	}

	const fastest = SECTORS.map((index) => {
		let holder: SectorHolder | null = null;

		for (const [number, sectors] of own) {
			const time = sectors[index];
			const driver = drivers.get(number);

			if (driver && time !== null && (!holder || time < holder.timeMs)) {
				holder = { driver, timeMs: time };
			}
		}

		return holder;
	});

	const ideal = [...own].flatMap(([number, sectors]): IdealLap[] => {
		const driver = drivers.get(number);
		const [first, second, third] = sectors;

		if (!driver || first === null || second === null || third === null) {
			return [];
		}

		return [
			{
				driver,
				sectorsMs: [first, second, third],
				idealMs: first + second + third,
				bestMs: bestLap.get(number) ?? null
			}
		];
	});

	return { fastest, ideal: ideal.toSorted((a, b) => a.idealMs - b.idealMs) };
}
