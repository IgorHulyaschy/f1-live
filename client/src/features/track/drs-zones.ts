import type { Lap, LapIndex, LapTelemetry } from '@f1-live/shared';

/** A stretch of the lap, in metres from the line; `toM` below `fromM` wraps past the line. */
export type Zone = { fromM: number; toM: number };

/** Laps read to find the zones: enough to see each zone opened a few times. */
const SAMPLE_LAPS = 8;

/** Openings this close belong to the same zone. */
const SAME_ZONE_M = 150;

function middle(values: readonly number[]): number {
	return values.toSorted((a, b) => a - b)[values.length >> 1] ?? 0;
}

/** Where the flap was open on one lap. */
export function openStretches(lap: Pick<LapTelemetry, 'd' | 'drs'>): Zone[] {
	const zones: Zone[] = [];
	let from: number | null = null;

	lap.d.forEach((distance, index) => {
		const open = (lap.drs?.[index] ?? 0) > 0;

		if (open && from === null) {
			from = distance;
		} else if (!open && from !== null) {
			zones.push({ fromM: from, toM: distance });
			from = null;
		}
	});

	if (from !== null) {
		zones.push({ fromM: from, toM: lap.d.at(-1) ?? from });
	}

	return zones;
}

/**
 * The DRS zones of a circuit, from where cars opened the flap: openings from several laps are
 * grouped by where they start, and each zone runs from the median start to the median end.
 */
export function drsZones(laps: readonly Pick<LapTelemetry, 'd' | 'drs'>[]): Zone[] {
	const groups: Zone[][] = [];

	for (const stretch of laps.flatMap(openStretches)) {
		const group = groups.find(
			(entry) => Math.abs((entry[0]?.fromM ?? 0) - stretch.fromM) < SAME_ZONE_M
		);

		if (group) {
			group.push(stretch);
		} else {
			groups.push([stretch]);
		}
	}

	// A zone seen open on one lap only may be a car's own oddity.
	return groups
		.flatMap((group) =>
			group.length < 2
				? []
				: [
						{
							fromM: middle(group.map((zone) => zone.fromM)),
							toM: middle(group.map((zone) => zone.toM))
						}
					]
		)
		.toSorted((a, b) => a.fromM - b.fromM);
}

/** A car this close to the one ahead at the line has DRS on its next lap. */
const DRS_GAP_MS = 900;

/**
 * Laps to read for the zones: the flap opens only within a second of the car ahead, so the laps
 * after a car crossed the line that close behind another, from several drivers.
 */
export function lapsForZones(index: LapIndex, laps: readonly Lap[]): LapIndex['laps'][number][] {
	const following = new Set(
		laps.flatMap((lap) =>
			lap.lap > 2 &&
			lap.trackStatus === 'green' &&
			lap.intervalMs > 0 &&
			lap.intervalMs < DRS_GAP_MS
				? [`${lap.driverNumber}-${lap.lap + 1}`]
				: []
		)
	);

	const byDriver = new Map<string, LapIndex['laps'][number]>();

	for (const entry of index.laps) {
		if (
			!entry.pitIn &&
			!entry.pitOut &&
			!byDriver.has(entry.driverNumber) &&
			following.has(`${entry.driverNumber}-${entry.lap}`)
		) {
			byDriver.set(entry.driverNumber, entry);
		}
	}

	return [...byDriver.values()].slice(0, SAMPLE_LAPS);
}
