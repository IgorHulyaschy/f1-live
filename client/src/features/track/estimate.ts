import type { Lap, MiniSectorRecord, RaceSnapshot, TrackOutline } from '@f1-live/shared';

import { crossingTimes, sessionStartMs } from '../../data/session-time.ts';
import { isCleanLap } from '../../insights/clean-laps.ts';
import { isTimedSession } from '../../insights/qualifying.ts';

import { laneGeometry, type LaneGeometry, PIT_SPEED_MPS } from './pit-lane.ts';

/**
 * Where a car is: along the racing line, or a share of the way down the pit lane. A car in the
 * garage or out of the session is not on the circuit at all.
 */
export type TrackPlace =
	| { kind: 'track'; distanceM: number }
	| { kind: 'pit'; laneShare: number }
	| { kind: 'garage' }
	| { kind: 'out' };

export type CarEstimate = {
	place: TrackPlace;
	/** Laps done plus the share of the lap in progress: orders cars on the road. */
	progress: number;
};

/** Everything estimation reads from a session, worked out once per snapshot. */
export type EstimateModel = {
	outline: TrackOutline;
	lane: LaneGeometry | null;
	timed: boolean;
	startMs: number;
	crossings: ReadonlyMap<string, readonly number[]>;
	laps: ReadonlyMap<string, ReadonlyMap<number, Lap>>;
	/** Lane time of each stop by driver and in-lap. */
	stops: ReadonlyMap<string, ReadonlyMap<number, number>>;
	retiredAt: ReadonlyMap<string, number>;
	grid: ReadonlyMap<string, number>;
	typicalLapMs: number;
	/** Live only: the mini sectors of the lap each car is on, and who is in the pits. */
	miniSectors: ReadonlyMap<string, MiniSectorRecord>;
	inPit: ReadonlySet<string>;
	laneMs: number;
};

/** Average speed of a lap when a session has no clean lap yet, m/s. */
const TYPICAL_SPEED_MPS = 60;

/** A start slot is this long, and pole sits this far behind the line. */
const GRID_SLOT_M = 8;

const POLE_BEHIND_LINE_M = 10;

/** Time stationary in the box during a race stop. */
const STOP_STATIONARY_MS = 2500;

/** A lap in progress is never placed past this share until the car is seen crossing the line. */
const MAX_UNSEEN_SHARE = 0.985;

/** A mini sector in progress is never placed past this share until its loop reports. */
const MAX_MINI_SHARE = 0.97;

/** An out-lap from the garage that has no time of its own takes this much longer than usual. */
const OUT_LAP_FACTOR = 1.3;

/** With nothing heard for this many laps, a car is taken to be in the garage. */
const SILENT_LAPS = 3;

/** Lane times above this are garage visits in practice and qualifying, not stops. */
const MAX_STOP_LANE_MS = 45_000;

function median(values: readonly number[]): number | null {
	const sorted = values.toSorted((a, b) => a - b);
	const middle = sorted.length >> 1;

	if (sorted.length === 0) {
		return null;
	}

	return sorted.length % 2
		? (sorted[middle] ?? null)
		: ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** A lap at the session's usual pace: the median clean lap, or a guess before there is one. */
export function typicalLap(race: RaceSnapshot, outline: TrackOutline): number {
	return (
		median(race.laps.flatMap((lap) => (lap.lap > 1 && isCleanLap(lap) ? [lap.lapTimeMs] : []))) ??
		(outline.lengthM / TYPICAL_SPEED_MPS) * 1000
	);
}

/**
 * `live` reads what the feed says about now (the mini sectors and who is in the pits); a replay
 * of a moment in the past must not, since the snapshot holds those only as they ended.
 */
export function estimateModel(
	race: RaceSnapshot,
	outline: TrackOutline,
	live: boolean
): EstimateModel {
	const laps = new Map<string, Map<number, Lap>>();

	for (const lap of race.laps) {
		const own = laps.get(lap.driverNumber) ?? new Map<number, Lap>();

		own.set(lap.lap, lap);
		laps.set(lap.driverNumber, own);
	}

	const stops = new Map<string, Map<number, number>>();

	for (const stop of race.pitStops) {
		const own = stops.get(stop.driverNumber) ?? new Map<number, number>();

		own.set(stop.lap, stop.laneTimeMs);
		stops.set(stop.driverNumber, own);
	}

	const crossings = crossingTimes(race);
	const startMs = sessionStartMs(race);

	const typicalLapMs = typicalLap(race, outline);

	const retiredAt = new Map(
		race.retirements.map((retirement) => {
			const own = crossings.get(retirement.driverNumber);
			const lapStart = own?.[retirement.lap - 1] ?? startMs;

			return [
				retirement.driverNumber,
				retirement.at === undefined ? lapStart + typicalLapMs / 2 : Date.parse(retirement.at)
			] as const;
		})
	);

	const lane = laneGeometry(outline);

	return {
		outline,
		lane,
		timed: isTimedSession(race.session.type),
		startMs,
		crossings,
		laps,
		stops,
		retiredAt,
		grid: new Map(race.startingGrid.map((slot) => [slot.driverNumber, slot.position])),
		typicalLapMs,
		miniSectors: new Map(
			live ? (race.miniSectors ?? []).map((record) => [record.driverNumber, record]) : []
		),
		inPit: new Set(
			live
				? (race.standings ?? [])
						.filter((standing) => standing.inPit)
						.map((standing) => standing.driverNumber)
				: []
		),
		laneMs: lane ? (lane.lengthM / PIT_SPEED_MPS) * 1000 : 20_000
	};
}

/** Milliseconds per metre in each sector, from a lap's sector times or the lap's average. */
function sectorPaces(model: EstimateModel, lap: Lap | undefined): [number, number, number] {
	const {
		lengthM,
		sectorBoundariesM: [first, second]
	} = model.outline;

	const lengths = [first, second - first, lengthM - second] as const;
	const lapMs = lap && lap.lapTimeMs > 0 ? lap.lapTimeMs : model.typicalLapMs;
	const average = lapMs / lengthM;

	const pace = (index: 0 | 1 | 2) => {
		const sectorMs = lap?.sectorTimesMs[index] ?? 0;
		const length = lengths[index];

		return sectorMs > 0 && length > 0 ? sectorMs / length : average;
	};

	return [pace(0), pace(1), pace(2)];
}

/** Which sector a distance is in; before the line counts as the end of the lap. */
function sectorIndex(model: EstimateModel, distanceM: number): 0 | 1 | 2 {
	const [first, second] = model.outline.sectorBoundariesM;

	if (distanceM < 0 || distanceM >= second) {
		return 2;
	}

	return distanceM < first ? 0 : 1;
}

/** The next distance after `distanceM` where the pace changes. */
function nextBoundary(model: EstimateModel, distanceM: number): number {
	const [first, second] = model.outline.sectorBoundariesM;

	if (distanceM < 0) {
		return 0;
	}

	if (distanceM < first) {
		return first;
	}

	return distanceM < second ? second : model.outline.lengthM;
}

/**
 * The distance reached `share` of the way, in time, from `fromM` to `toM`, when each sector is
 * driven at its pace: a car crosses a slow sector more slowly than a fast one.
 */
function distanceAtShare(
	model: EstimateModel,
	paces: readonly [number, number, number],
	fromM: number,
	toM: number,
	share: number
): number {
	let total = 0;

	for (let at = fromM; at < toM;) {
		const end = Math.min(nextBoundary(model, at), toM);

		total += (end - at) * paces[sectorIndex(model, at)];
		at = end;
	}

	let left = total * Math.min(1, Math.max(0, share));

	for (let at = fromM; at < toM;) {
		const end = Math.min(nextBoundary(model, at), toM);
		const pace = paces[sectorIndex(model, at)];
		const span = (end - at) * pace;

		if (left <= span) {
			return at + left / pace;
		}

		left -= span;
		at = end;
	}

	return toM;
}

function laneTimeOf(model: EstimateModel, driverNumber: string, inLap: number): number {
	const published = model.stops.get(driverNumber)?.get(inLap);

	if (published !== undefined && published > 0 && published < MAX_STOP_LANE_MS) {
		return published;
	}

	return model.laneMs + (model.timed ? 0 : STOP_STATIONARY_MS);
}

/**
 * Where a car is during a lap whose start and end are known: the lap is driven at the pace of
 * its sectors, with the pit lane at the end of an in-lap and the start of an out-lap.
 */
function placeOnLap(
	model: EstimateModel,
	driverNumber: string,
	lapNumber: number,
	fromMs: number,
	toMs: number,
	time: number
): TrackPlace {
	const lap = model.laps.get(driverNumber)?.get(lapNumber);
	const { lane } = model;
	const { lengthM } = model.outline;
	let elapsed = time - fromMs;
	let span = toMs - fromMs;

	if (lane && lap?.pitOut) {
		const exitMs = laneTimeOf(model, driverNumber, lapNumber - 1) * (1 - lane.lineShare);

		if (elapsed < exitMs) {
			return { kind: 'pit', laneShare: lane.lineShare + (1 - lane.lineShare) * (elapsed / exitMs) };
		}

		elapsed -= exitMs;
		span -= exitMs;
	}

	if (lane && lap?.pitIn) {
		const entryMs = laneTimeOf(model, driverNumber, lapNumber) * lane.lineShare;

		if (elapsed > span - entryMs) {
			return { kind: 'pit', laneShare: lane.lineShare * ((elapsed - (span - entryMs)) / entryMs) };
		}

		span -= entryMs;
	}

	const fromM =
		lane && lap?.pitOut
			? lane.lane.exitM
			: lapNumber === 1 && !model.timed
				? -gridOffset(model, driverNumber)
				: 0;

	const toM = lane && lap?.pitIn ? lane.lane.entryM : lengthM;

	const distanceM = distanceAtShare(
		model,
		sectorPaces(model, lap),
		fromM,
		toM,
		span > 0 ? elapsed / span : 1
	);

	return { kind: 'track', distanceM };
}

function gridOffset(model: EstimateModel, driverNumber: string): number {
	return POLE_BEHIND_LINE_M + GRID_SLOT_M * ((model.grid.get(driverNumber) ?? 1) - 1);
}

/**
 * The lap in progress, which has no end yet: from the last mini sector the timing loops
 * reported, run on at the pace the car did it last time, and held short of the next loop; or,
 * without loops, at the pace of the lap before, held short of the line.
 */
function placeInProgress(
	model: EstimateModel,
	driverNumber: string,
	lapNumber: number,
	fromMs: number,
	time: number
): TrackPlace {
	const { outline } = model;
	const record = model.miniSectors.get(driverNumber);

	if (model.inPit.has(driverNumber)) {
		return model.timed && time - fromMs > model.typicalLapMs
			? { kind: 'garage' }
			: { kind: 'pit', laneShare: 0.5 };
	}

	if (record && record.lap === lapNumber && Date.parse(record.at) <= time) {
		const starts = outline.miniSectorStartsM;
		const next = record.index + 1;
		const fromM = starts[next] ?? outline.lengthM;
		const toM = starts[next + 1] ?? outline.lengthM;

		const expected =
			record.lastMs[next] ??
			record.bestMs[next] ??
			(toM - fromM) * (model.typicalLapMs / outline.lengthM);

		const share = Math.min(MAX_MINI_SHARE, (time - Date.parse(record.at)) / Math.max(expected, 1));

		return record.marks[record.index] === 'pit' && model.lane
			? { kind: 'pit', laneShare: 0.5 }
			: { kind: 'track', distanceM: fromM + (toM - fromM) * share };
	}

	const before = model.laps.get(driverNumber)?.get(lapNumber - 1);

	const lapMs =
		before && before.lapTimeMs > 0 && !before.pitIn ? before.lapTimeMs : model.typicalLapMs;

	const share = Math.min(MAX_UNSEEN_SHARE, (time - fromMs) / lapMs);
	const fromM = lapNumber === 1 && !model.timed ? -gridOffset(model, driverNumber) : 0;

	return {
		kind: 'track',
		distanceM: distanceAtShare(model, sectorPaces(model, before), fromM, outline.lengthM, share)
	};
}

function progressOf(model: EstimateModel, lapsDone: number, place: TrackPlace): number {
	const { lengthM } = model.outline;

	switch (place.kind) {
		case 'track':
			return lapsDone + place.distanceM / lengthM;
		case 'pit': {
			if (!model.lane) {
				return lapsDone;
			}

			// The lane runs from its entry, before the line, to its exit, after it.
			const { lineShare, lane } = model.lane;

			return place.laneShare < lineShare
				? lapsDone +
						(lane.entryM + (lengthM - lane.entryM) * (place.laneShare / lineShare)) / lengthM
				: lapsDone + (lane.exitM * (place.laneShare - lineShare)) / (1 - lineShare) / lengthM;
		}

		case 'garage':
		case 'out':
			return Number.NEGATIVE_INFINITY;
	}
}

/**
 * Where a car is at `time` from timing alone, for sessions without car positions: lap crossings,
 * sector times and, live, the mini sectors. Before the start of a race the cars are on the grid.
 */
export function estimateCar(model: EstimateModel, driverNumber: string, time: number): CarEstimate {
	const retiredAt = model.retiredAt.get(driverNumber);

	if (retiredAt !== undefined && retiredAt <= time) {
		return { place: { kind: 'out' }, progress: Number.NEGATIVE_INFINITY };
	}

	const own = model.crossings.get(driverNumber) ?? [model.startMs];
	let done = 0;

	for (let lap = 1; lap < own.length; lap++) {
		const crossed = own[lap];

		if (crossed !== undefined && crossed <= time) {
			done = lap;
		}
	}

	const lapNumber = done + 1;
	const lapStart = own[done] ?? model.startMs;
	const lapEnd = own[lapNumber];

	if (!model.timed && time < model.startMs) {
		const place: TrackPlace = { kind: 'track', distanceM: -gridOffset(model, driverNumber) };

		return { place, progress: progressOf(model, 0, place) };
	}

	let place: TrackPlace;

	if (lapEnd === undefined) {
		const silent = time - lapStart > SILENT_LAPS * model.typicalLapMs;
		const running = model.miniSectors.get(driverNumber)?.lap === lapNumber;

		// In practice and qualifying a car that came in stays in the garage until it is seen again.
		const parked =
			model.timed && !running && (done === 0 || model.laps.get(driverNumber)?.get(done)?.pitIn);

		place =
			silent || parked
				? { kind: 'garage' }
				: placeInProgress(model, driverNumber, lapNumber, lapStart, time);
	} else {
		const lap = model.laps.get(driverNumber)?.get(lapNumber);
		// In practice and qualifying a run starts from the garage: its out-lap is timed back from its end.
		const fromGarage = model.timed && (done === 0 || lap?.pitOut);
		const runMs = lap && lap.lapTimeMs > 0 ? lap.lapTimeMs : model.typicalLapMs * OUT_LAP_FACTOR;
		const fromMs = fromGarage ? Math.max(lapStart, lapEnd - runMs) : lapStart;

		place =
			time < fromMs
				? { kind: 'garage' }
				: placeOnLap(model, driverNumber, lapNumber, fromMs, lapEnd, time);
	}

	return { place, progress: progressOf(model, done, place) };
}
