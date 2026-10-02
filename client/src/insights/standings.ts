import type { Driver, Lap, RaceSnapshot, TyreCompound } from '@f1-live/shared';

export type SectorMark = 'fastest' | 'personal-best' | 'none';

export type DriverState = 'running' | 'pit' | 'out';

export interface StandingRow {
	driver: Driver;
	position: number;
	gridPosition: number | null;
	/** Positive when the driver has gained places since the start. */
	positionsGained: number | null;
	gapToLeaderMs: number | null;
	intervalMs: number | null;
	lapsDown: number;
	lapsCompleted: number;
	lastLap: Lap | null;
	bestLapMs: number | null;
	hasFastestLap: boolean;
	sectorMarks: readonly [SectorMark, SectorMark, SectorMark];
	compound: TyreCompound | null;
	tyreAge: number;
	pitStops: number;
	state: DriverState;
}

const SECTOR_INDEXES = [0, 1, 2] as const;

function minimum(values: Iterable<number>): number | null {
	let lowest: number | null = null;

	for (const value of values) {
		if (lowest === null || value < lowest) {
			lowest = value;
		}
	}

	return lowest;
}

/** Classification at the snapshot's current lap, retired drivers last. */
export function standingsAt(snapshot: RaceSnapshot): StandingRow[] {
	const lapsByDriver = new Map<string, Lap[]>();

	for (const lap of snapshot.laps) {
		const driverLaps = lapsByDriver.get(lap.driverNumber) ?? [];

		driverLaps.push(lap);
		lapsByDriver.set(lap.driverNumber, driverLaps);
	}

	const timedLaps = snapshot.laps.filter((lap) => lap.lap > 1);
	const fastestLapMs = minimum(timedLaps.map((lap) => lap.lapTimeMs));

	const fastestSectors = SECTOR_INDEXES.map((index) =>
		minimum(timedLaps.map((lap) => lap.sectorTimesMs[index]))
	);

	const retiredNumbers = new Set(snapshot.retirements.map((retirement) => retirement.driverNumber));

	const gridByDriver = new Map(
		snapshot.startingGrid.map((slot) => [slot.driverNumber, slot.position])
	);

	const rows = snapshot.drivers.map((driver): Omit<StandingRow, 'position' | 'positionsGained'> => {
		const driverLaps = lapsByDriver.get(driver.number) ?? [];
		const lastLap = driverLaps.at(-1) ?? null;
		const ownTimedLaps = driverLaps.filter((lap) => lap.lap > 1);
		const bestLapMs = minimum(ownTimedLaps.map((lap) => lap.lapTimeMs));

		const personalBestSectors = SECTOR_INDEXES.map((index) =>
			minimum(ownTimedLaps.map((lap) => lap.sectorTimesMs[index]))
		);

		const sectorMark = (index: 0 | 1 | 2): SectorMark => {
			const time = lastLap && lastLap.lap > 1 ? lastLap.sectorTimesMs[index] : null;

			if (time === null) {
				return 'none';
			}

			if (time === fastestSectors[index]) {
				return 'fastest';
			}

			return time === personalBestSectors[index] ? 'personal-best' : 'none';
		};

		const lapsDown = lastLap ? snapshot.currentLap - lastLap.lap : snapshot.currentLap;

		return {
			driver,
			gridPosition: gridByDriver.get(driver.number) ?? null,
			gapToLeaderMs: lastLap && lapsDown === 0 ? lastLap.gapToLeaderMs : null,
			intervalMs: lastLap && lapsDown === 0 ? lastLap.intervalMs : null,
			lapsDown,
			lapsCompleted: lastLap?.lap ?? 0,
			lastLap,
			bestLapMs,
			hasFastestLap: bestLapMs !== null && bestLapMs === fastestLapMs,
			sectorMarks: [sectorMark(0), sectorMark(1), sectorMark(2)],
			compound: lastLap?.compound ?? null,
			tyreAge: lastLap?.tyreAge ?? 0,
			pitStops: snapshot.pitStops.filter((stop) => stop.driverNumber === driver.number).length,
			state: retiredNumbers.has(driver.number) ? 'out' : lastLap?.pitIn ? 'pit' : 'running'
		};
	});

	rows.sort((a, b) => {
		if ((a.state === 'out') !== (b.state === 'out')) {
			return a.state === 'out' ? 1 : -1;
		}

		if (a.lapsCompleted !== b.lapsCompleted) {
			return b.lapsCompleted - a.lapsCompleted;
		}

		return (a.lastLap?.position ?? Infinity) - (b.lastLap?.position ?? Infinity);
	});

	return rows.map((row, index) => ({
		...row,
		position: index + 1,
		positionsGained: row.gridPosition === null ? null : row.gridPosition - (index + 1)
	}));
}
