import { distanceAt, lowerBound } from './series.js';
import type { CarDistance } from './series.js';
import { median } from './startfinish.js';
import type { TimingSegments } from './timing.js';

/** A lap that ran line to line with sector times: what the boundaries are measured on. */
export interface TimedLap {
	driverNumber: string;
	/** The line crossings that begin and end the lap, ms since the Unix epoch. */
	startAt: number;
	endAt: number;
	sectorTimesMs: readonly [number, number, number];
}

export interface PlacedSectors {
	sectorBoundariesM: [number, number];
	miniSectorsPerSector: [number, number, number];
	miniSectorStartsM: number[];
	miniSectors: 'timing' | 'even';
}

/** How late the feed published a segment, by lap-crossing time at most; tried in steps. */
const MAX_LATENCY_MS = 2000;

const LATENCY_STEP_MS = 50;

/** Used to tell which lap a segment belongs to before the delay is known. */
const NOMINAL_LATENCY_MS = 300;

/** Fewer laps than this cannot place a boundary. */
const MIN_LAPS = 3;

/** A mini sector shorter than this is a mistake in the estimate. */
const MIN_MINI_SECTOR_M = 20;

function even(from: number, to: number, count: number): number[] {
	return Array.from({ length: count }, (_, index) => from + ((to - from) * index) / count);
}

/** Metres the car drove from the lap's start to `at`. */
function drivenAt(car: CarDistance, lap: TimedLap, at: number): number {
	return distanceAt(car, at) - distanceAt(car, lap.startAt);
}

/**
 * Where sectors and mini sectors begin along the lap. Sector ends are where cars were when the
 * official sector times had run, which needs no delay. A mini sector's end is where the car was
 * when the feed said it left it; the feed's delay is the one that puts the sector ends where the
 * sector times do. Without enough laps or segments the mini sectors are cut evenly.
 */
export function placeSectors(
	lengthM: number,
	cars: ReadonlyMap<string, CarDistance>,
	laps: readonly TimedLap[],
	segments: TimingSegments
): PlacedSectors {
	const driven = laps.flatMap((lap) => {
		const car = cars.get(lap.driverNumber);

		return car === undefined ? [] : [{ lap, car }];
	});

	const [first, second] = [0, 1].map((boundary) =>
		median(
			driven.map(({ lap, car }) => {
				const after = lap.sectorTimesMs.slice(0, boundary + 1).reduce((sum, time) => sum + time, 0);

				return drivenAt(car, lap, lap.startAt + after);
			})
		)
	);

	const perSector = segments.perSector;

	const counts: [number, number, number] = perSector.every((count) => count > 0)
		? perSector
		: [1, 1, 1];

	if (
		driven.length < MIN_LAPS ||
		first === undefined ||
		second === undefined ||
		!(
			first > MIN_MINI_SECTOR_M &&
			second - first > MIN_MINI_SECTOR_M &&
			lengthM - second > MIN_MINI_SECTOR_M
		)
	) {
		const third = lengthM / 3;

		return {
			sectorBoundariesM: [third, 2 * third],
			miniSectorsPerSector: counts,
			miniSectorStartsM: [
				...even(0, third, counts[0]),
				...even(third, 2 * third, counts[1]),
				...even(2 * third, lengthM, counts[2])
			],
			miniSectors: 'even'
		};
	}

	const edges = [0, first, second, lengthM];

	const evenStarts = [0, 1, 2].flatMap((sector) =>
		even(edges[sector] ?? 0, edges[sector + 1] ?? lengthM, counts[sector] ?? 1)
	);

	const timed = timedStarts(driven, segments, counts, [first, second], lengthM);

	return {
		sectorBoundariesM: [first, second],
		miniSectorsPerSector: counts,
		miniSectorStartsM: timed ?? evenStarts,
		miniSectors: timed === null ? 'even' : 'timing'
	};
}

interface DrivenLap {
	lap: TimedLap;
	car: CarDistance;
}

/** When a lap's car left a mini sector, as the feed published it. */
interface Departure extends DrivenLap {
	at: number;
}

/**
 * For each boundary from 1 to the count less one, when each lap's car left the mini sector
 * before it. The first update of a segment after the lap began is the car leaving it, the delay
 * of the feed being much shorter than the first segment.
 */
function departuresByBoundary(
	driven: readonly DrivenLap[],
	segments: TimingSegments,
	before: readonly number[],
	total: number
): Departure[][] {
	const byDriver = new Map<string, { at: number; boundary: number }[]>();

	for (const completion of segments.completions) {
		const boundary = (before[completion.sector] ?? 0) + completion.segment + 1;

		if (boundary < total) {
			const list = byDriver.get(completion.driverNumber) ?? [];

			list.push({ at: completion.at, boundary });
			byDriver.set(completion.driverNumber, list);
		}
	}

	const sorted = new Map(
		[...byDriver].map(([driver, list]) => {
			const ordered = list.toSorted((a, b) => a.at - b.at);

			return [driver, { ordered, times: ordered.map((entry) => entry.at) }] as const;
		})
	);

	const departures: Departure[][] = Array.from({ length: total }, () => []);

	for (const { lap, car } of driven) {
		const found = sorted.get(lap.driverNumber);
		const seen = new Set<number>();

		if (found === undefined) {
			continue;
		}

		for (
			let index = lowerBound(found.times, lap.startAt + NOMINAL_LATENCY_MS);
			index < found.ordered.length;
			index += 1
		) {
			const entry = found.ordered[index];

			if (entry === undefined || entry.at - NOMINAL_LATENCY_MS >= lap.endAt) {
				break;
			}

			if (!seen.has(entry.boundary)) {
				seen.add(entry.boundary);
				departures[entry.boundary]?.push({ lap, car, at: entry.at });
			}
		}
	}

	return departures;
}

/**
 * Where each mini sector starts, from when cars left them; null when too few laps have all of
 * them. The delay of the feed is the one that puts the sector ends where the sector times do.
 */
function timedStarts(
	driven: readonly DrivenLap[],
	segments: TimingSegments,
	counts: readonly [number, number, number],
	sectorEnds: readonly [number, number],
	lengthM: number
): number[] | null {
	const total = counts[0] + counts[1] + counts[2];
	const before = [0, counts[0], counts[0] + counts[1]];
	const times = departuresByBoundary(driven, segments, before, total);

	const sectorBoundaries = [before[1] ?? 0, before[2] ?? 0];

	const measure = (boundary: number, latencyMs: number): number | null => {
		const entries = times[boundary] ?? [];

		return entries.length < MIN_LAPS
			? null
			: median(entries.map(({ lap, car, at }) => drivenAt(car, lap, at - latencyMs)));
	};

	let best: { error: number; latencyMs: number } | null = null;

	for (let latencyMs = 0; latencyMs <= MAX_LATENCY_MS; latencyMs += LATENCY_STEP_MS) {
		const found = sectorBoundaries.map((boundary, index) => {
			const measured = measure(boundary, latencyMs);

			return measured === null ? null : (measured - (sectorEnds[index] ?? 0)) ** 2;
		});

		if (found.some((error) => error === null)) {
			return null;
		}

		const error = found.reduce<number>((sum, value) => sum + (value ?? 0), 0);

		if (best === null || error < best.error) {
			best = { error, latencyMs };
		}
	}

	if (best === null) {
		return null;
	}

	const starts: number[] = [0];

	for (let boundary = 1; boundary < total; boundary += 1) {
		const sectorEnd = sectorBoundaries.indexOf(boundary);
		const measured = sectorEnd === -1 ? measure(boundary, best.latencyMs) : sectorEnds[sectorEnd];

		if (measured === null || measured === undefined) {
			return null;
		}

		starts.push(measured);
	}

	const increasing = starts.every(
		(start, index) =>
			index === 0 ||
			(start - (starts[index - 1] ?? 0) >= MIN_MINI_SECTOR_M && start < lengthM - MIN_MINI_SECTOR_M)
	);

	return increasing ? starts : null;
}
