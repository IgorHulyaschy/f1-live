import type { LapIndex, LapTelemetry } from '@f1-live/shared';

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

/** Laps to read for the zones: clean racing laps of several drivers from mid-session. */
export function lapsForZones(index: LapIndex): LapIndex['laps'][number][] {
	const candidates = index.laps.filter(
		(lap) => !lap.partial && !lap.pitIn && !lap.pitOut && lap.lap > 3
	);

	const byDriver = new Map<string, LapIndex['laps'][number]>();

	for (const lap of candidates) {
		const kept = byDriver.get(lap.driverNumber);

		if (!kept || Math.abs(lap.lap - 20) < Math.abs(kept.lap - 20)) {
			byDriver.set(lap.driverNumber, lap);
		}
	}

	return [...byDriver.values()].slice(0, SAMPLE_LAPS);
}
