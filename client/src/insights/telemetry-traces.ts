import {
	alignLaps,
	type Lap,
	type LapClock,
	type LapIndexEntry,
	type LapTelemetry,
	type TrackOutline,
	timeAtDistance
} from '@f1-live/shared';

export const CHANNELS = ['speed', 'throttle', 'brake', 'gear', 'rpm'] as const;

export type Channel = (typeof CHANNELS)[number];

/**
 * Positions are 4 Hz with about a metre of noise, which makes the raw delta jitter; it is drawn
 * as the mean over this many rows either side.
 */
const DELTA_SMOOTHING_ROWS = 3;

/** Channels that hold a value until the next sample instead of moving between samples. */
const STEPPED: ReadonlySet<Channel> = new Set(['brake', 'gear']);

/**
 * One row every `stepM` metres from the line, for charts that share a distance axis: `d`, then
 * `<channel><slot>` for each lap (slot 0 is the reference) and `delta<slot>` for the others, in
 * seconds behind the reference. A value is null where that lap has no reading.
 */
export type TraceRow = { d: number } & Record<string, number | null>;

function clock(lap: LapTelemetry): LapClock {
	return { distanceM: lap.d, timeMs: lap.t };
}

/** Reads a column at ascending distances in one pass. */
function sampleColumn(
	distances: readonly number[],
	lap: LapTelemetry,
	values: readonly number[],
	stepped: boolean
): number[] {
	const { d } = lap;
	let index = 0;

	return distances.map((distance) => {
		while (index < d.length - 1 && (d[index + 1] ?? Infinity) <= distance) {
			index += 1;
		}

		const d0 = d[index] ?? 0;
		const d1 = d[index + 1] ?? d0;
		const v0 = values[index] ?? 0;
		const v1 = values[index + 1] ?? v0;

		if (stepped || d1 <= d0 || distance <= d0) {
			return v0;
		}

		return v0 + ((v1 - v0) * (Math.min(distance, d1) - d0)) / (d1 - d0);
	});
}

/** The mean of each value and its neighbours; the ends average what they have. */
function smooth(values: readonly number[]): number[] {
	return values.map((_, index) => {
		const window = values.slice(
			Math.max(0, index - DELTA_SMOOTHING_ROWS),
			index + DELTA_SMOOTHING_ROWS + 1
		);

		return window.reduce((sum, value) => sum + value, 0) / window.length;
	});
}

/** How far every lap reaches, so no line runs past the end of a shorter lap. */
export function sharedDistance(laps: readonly LapTelemetry[]): number {
	return Math.min(...laps.map((lap) => lap.d.at(-1) ?? 0));
}

/**
 * The laps on one distance grid. The first lap is the reference the deltas are taken against;
 * channels a lap has no car data for stay null.
 */
export function traceRows(laps: readonly LapTelemetry[], stepM: number): TraceRow[] {
	const reference = laps[0];

	if (!reference || !(stepM > 0)) {
		return [];
	}

	const end = sharedDistance(laps);

	const distances = Array.from(
		{ length: Math.floor(end / stepM) + 1 },
		(_, index) => index * stepM
	);

	const columns = laps.map((lap) =>
		CHANNELS.map((channel) => {
			const values = lap[channel];

			return values ? sampleColumn(distances, lap, values, STEPPED.has(channel)) : null;
		})
	);

	const deltas = laps.map((lap, slot) =>
		slot === 0 ? null : smooth(alignLaps(clock(reference), clock(lap), stepM).deltaMs)
	);

	return distances.map((distance, row) => {
		const entry: TraceRow = { d: distance };

		for (const [slot, lapColumns] of columns.entries()) {
			for (const [channelIndex, channel] of CHANNELS.entries()) {
				entry[`${channel}${slot}`] = lapColumns[channelIndex]?.[row] ?? null;
			}

			const delta = deltas[slot]?.[row];

			if (slot > 0) {
				entry[`delta${slot}`] = delta === undefined ? null : delta / 1000;
			}
		}

		return entry;
	});
}

export interface MiniSectorSplit {
	index: number;
	/** Sector 0 to 2 the mini sector is in. */
	sector: 0 | 1 | 2;
	startM: number;
	endM: number;
	/** Time in the mini sector, one per lap. */
	timesMs: number[];
	/** Slowest speed in the mini sector, one per lap; null without car data. */
	minSpeedKph: (number | null)[];
}

/** Each lap's time through every mini sector, from where the timing feed puts them. */
export function miniSectorSplits(
	laps: readonly LapTelemetry[],
	outline: TrackOutline
): MiniSectorSplit[] {
	const starts = outline.miniSectorStartsM;
	const end = sharedDistance(laps);
	const [perFirst, perSecond] = outline.miniSectorsPerSector;

	return starts.flatMap((startM, index) => {
		const endM = Math.min(starts[index + 1] ?? end, end);

		if (endM <= startM) {
			return [];
		}

		const sector: 0 | 1 | 2 = index < perFirst ? 0 : index < perFirst + perSecond ? 1 : 2;

		return [
			{
				index,
				sector,
				startM,
				endM,
				timesMs: laps.map(
					(lap) => timeAtDistance(clock(lap), endM) - timeAtDistance(clock(lap), startM)
				),
				minSpeedKph: laps.map((lap) => {
					const speeds = (lap.speed ?? []).filter(
						(_, row) => (lap.d[row] ?? 0) >= startM && (lap.d[row] ?? 0) < endM
					);

					return speeds.length > 0 ? Math.min(...speeds) : null;
				})
			}
		];
	});
}

export interface SpeedMinimum {
	distanceM: number;
	speedKph: number;
}

/** A dip counts as a corner once the car has slowed this much from the fastest point before it. */
const CORNER_DROP_KPH = 25;

/**
 * The slowest point of each braking zone on a lap: where the car turns. The feed numbers no
 * corners, so these carry a distance and a speed, not a name.
 */
export function speedMinima(lap: LapTelemetry): SpeedMinimum[] {
	const speeds = lap.speed ?? [];
	const minima: SpeedMinimum[] = [];
	let peak = -Infinity;
	let lowest: SpeedMinimum | null = null;

	for (const [row, speed] of speeds.entries()) {
		const distanceM = lap.d[row] ?? 0;

		if (lowest === null || speed < lowest.speedKph) {
			if (peak - speed >= CORNER_DROP_KPH) {
				lowest = { distanceM, speedKph: speed };
			}
		} else if (speed - lowest.speedKph >= CORNER_DROP_KPH) {
			minima.push(lowest);
			lowest = null;
			peak = speed;
		}

		if (lowest === null) {
			peak = Math.max(peak, speed);
		}
	}

	if (lowest) {
		minima.push(lowest);
	}

	return minima;
}

/** A lap may differ from the circuit length by this share and still run line to line. */
const COMPARABLE_LENGTH_SHARE = 0.01;

/**
 * A lap that ran line to line on the track, so its distances compare with any other. The index
 * does not flag every trip to the garage, so the distance is checked too.
 */
export function isComparableLap(entry: LapIndexEntry, lengthM: number): boolean {
	return (
		!entry.partial &&
		!entry.pitIn &&
		!entry.pitOut &&
		Math.abs(entry.distanceM - lengthM) <= lengthM * COMPARABLE_LENGTH_SHARE
	);
}

/** The telemetry a driver has for laps that compare, by lap number. */
export function comparableLaps(
	entries: readonly LapIndexEntry[],
	driverNumber: string,
	lengthM: number
): Map<number, LapIndexEntry> {
	return new Map(
		entries.flatMap((entry) =>
			entry.driverNumber === driverNumber && isComparableLap(entry, lengthM)
				? [[entry.lap, entry] as const]
				: []
		)
	);
}

/**
 * A driver's quickest timed lap that has comparable telemetry. The official lap time decides,
 * since the feed's own best-lap number can be a lap off in practice.
 */
export function fastestComparableLap(
	laps: readonly Lap[],
	comparable: ReadonlyMap<number, LapIndexEntry>
): Lap | null {
	return laps.reduce<Lap | null>(
		(best, lap) =>
			lap.lapTimeMs > 0 &&
			comparable.has(lap.lap) &&
			(best === null || lap.lapTimeMs < best.lapTimeMs)
				? lap
				: best,
		null
	);
}
