import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { EMPTY_SNAPSHOT, TELEMETRY_VERSION, applyEvent } from '@f1-live/shared';
import type { Lap, LapIndexEntry, RaceSnapshot, TrackOutline } from '@f1-live/shared';
import { z } from 'zod';

import { readArchive } from '../sources/f1/archive.js';
import { F1Decoder, F1_TOPICS } from '../sources/f1/decode.js';
import type { TopicFrame } from '../sources/f1/decode.js';
import type { EventLog } from '../sources/f1/live.js';
import { TELEMETRY_TOPICS, decodeTelemetryFrames } from '../sources/f1/telemetry.js';
import {
	gzipJson,
	manifestJson,
	readOutline,
	replaceFolder,
	sessionTelemetryDir,
	writeOutline
} from './files.js';
import type { SessionManifest } from './files.js';
import { LAP_STEP_MS, buildLapTelemetry } from './laps.js';
import type { LapWindow } from './laps.js';
import { isRacingLoop, loopFromLap, provisionalOutline, rotateStart } from './outline.js';
import type { Loop } from './outline.js';
import { buildPitLane } from './pitlane.js';
import type { PitPass } from './pitlane.js';
import { buildReplay, replayManifest } from './replay.js';
import { placeSectors } from './sectors.js';
import type { TimedLap } from './sectors.js';
import { carDataTracks, distanceAlong, positionTracks } from './series.js';
import type { CarDataTrack, CarDistance, PositionTrack } from './series.js';
import { crossingTime, locateStartFinish } from './startfinish.js';
import type { Crossing } from './startfinish.js';
import { readSegments } from './timing.js';

export interface BuildOptions {
	/** The session's raw directory: the `<Topic>.jsonStream` files of one session. */
	rawDir: string;
	/** The session's archive key, e.g. 9858 for the 2025 Las Vegas race. */
	key: number;
	/** Where `out/telemetry` goes. */
	dataDir: string;
	/** Draw the circuit again even when one is saved. */
	rebuildOutline?: boolean;
	log?: EventLog;
}

export interface BuiltReport {
	status: 'built';
	key: number;
	circuitKey: string;
	outline: {
		reused: boolean;
		lengthM: number;
		points: number;
		miniSectors: number;
		miniSectorSource: 'timing' | 'even';
		pitLane: boolean;
		/** How late the timing feed publishes a lap crossing. */
		latencyMs: number;
	};
	laps: {
		files: number;
		partial: number;
		/** Laps run line to line, not into or out of the pits, more than 2% off the circuit's length. */
		offLength: number;
		/** The largest difference from the circuit's length, as a share of it: laps run line to line, and laps into or out of the pits. */
		maxDeviation: { flying: number; pit: number };
		totalBytes: number;
		meanBytes: number;
		maxBytes: number;
	};
	replay: { chunks: number; totalBytes: number };
	hasCarData: boolean;
	/** Frames that did not match the feed's format, and were left out. */
	skippedFrames: number;
	elapsedMs: number;
}

export interface SkippedReport {
	status: 'skipped';
	key: number;
	reason: string;
}

export type TelemetryReport = BuiltReport | SkippedReport;

/** A lap whose distance is farther than this from the circuit's length did not run line to line. */
export const LENGTH_TOLERANCE = 0.02;

/** A session in which no lap moved this share of the circuit has no usable positions: the feed froze. */
const MIN_MOVED_SHARE = 0.01;

/** A lap time that the previous crossing and the official time disagree on by more than this is trusted less. */
const LAP_TIME_TOLERANCE_MS = 1000;

/** Typical delay of the timing feed, until the crossings say otherwise. */
const DEFAULT_LATENCY_MS = 300;

const sessionInfoSchema = z.object({
	Meeting: z.object({ Circuit: z.object({ Key: z.number() }) })
});

/** The circuit is not saved and the session's positions cannot draw it. */
class NothingToDraw extends Error {}

interface SessionFacts {
	snapshot: RaceSnapshot;
	passes: PitPass[];
	circuitKey: string | null;
	segmentFrames: TopicFrame[];
}

/** Reads the session the way the live decoder does, keeping what the telemetry needs. */
function foldSession(frames: readonly TopicFrame[]): SessionFacts {
	const decoder = new F1Decoder();
	const open = new Map<string, number>();

	const facts: SessionFacts = {
		snapshot: EMPTY_SNAPSHOT,
		passes: [],
		circuitKey: null,
		segmentFrames: []
	};

	for (const frame of frames) {
		if (frame.topic === 'TimingData') {
			facts.segmentFrames.push(frame);
		}

		if (frame.topic === 'SessionInfo' && facts.circuitKey === null) {
			const info = sessionInfoSchema.safeParse(frame.data);

			facts.circuitKey = info.success ? String(info.data.Meeting.Circuit.Key) : null;
		}

		try {
			for (const event of decoder.decode(frame)) {
				facts.snapshot = applyEvent(facts.snapshot, event);

				if (event.kind === 'pit_entry') {
					open.set(event.driverNumber, Date.parse(event.at));
				} else if (event.kind === 'pit_exit') {
					const entryAt = open.get(event.driverNumber);

					if (entryAt !== undefined) {
						facts.passes.push({
							driverNumber: event.driverNumber,
							entryAt,
							exitAt: Date.parse(event.at)
						});
					}
				}
			}
		} catch {
			// The importer reports a frame the decoder cannot read; the telemetry goes on without it.
		}
	}

	return facts;
}

function isRace(snapshot: RaceSnapshot): boolean {
	return snapshot.session.type === 'race' || snapshot.session.type === 'sprint';
}

/** The laps that ran line to line at racing speed, quickest first, for the outline to be drawn from. */
function cleanLaps(snapshot: RaceSnapshot): Lap[] {
	const candidates = snapshot.laps.filter(
		(lap) =>
			lap.completedAt !== undefined &&
			lap.lapTimeMs > 0 &&
			!lap.pitIn &&
			!lap.pitOut &&
			lap.trackStatus === 'green' &&
			!(isRace(snapshot) && lap.lap === 1)
	);

	return candidates.toSorted((a, b) => a.lapTimeMs - b.lapTimeMs);
}

/**
 * The first clean lap whose positions draw a circuit: a car's position can freeze for a stretch,
 * and the lap it freezes in draws a point, not a circuit.
 */
export function drawableLap(
	snapshot: RaceSnapshot,
	tracks: ReadonlyMap<string, PositionTrack>
): { lap: Lap; loop: Loop } | null {
	for (const lap of cleanLaps(snapshot)) {
		const track = tracks.get(lap.driverNumber);

		if (lap.completedAt === undefined || track === undefined) {
			continue;
		}

		const endAt = Date.parse(lap.completedAt) - DEFAULT_LATENCY_MS;

		try {
			const loop = loopFromLap(track, endAt - lap.lapTimeMs, endAt);

			if (isRacingLoop(loop, lap.lapTimeMs)) {
				return { lap, loop };
			}
		} catch {
			// The only error is too few samples in this lap's window; the next lap may have them.
		}
	}

	return null;
}

function crossingsOf(snapshot: RaceSnapshot): Crossing[] {
	return snapshot.laps.flatMap((lap) =>
		lap.completedAt === undefined || lap.pitIn
			? []
			: [{ driverNumber: lap.driverNumber, lap: lap.lap, at: Date.parse(lap.completedAt) }]
	);
}

function carDistances(
	outline: TrackOutline,
	tracks: ReadonlyMap<string, PositionTrack>
): Map<string, CarDistance> {
	return new Map(
		[...tracks].map(([driver, track]) => [
			driver,
			{ track, distanceM: distanceAlong(outline, track) }
		])
	);
}

function shifted(cars: ReadonlyMap<string, CarDistance>, byM: number): Map<string, CarDistance> {
	return new Map(
		[...cars].map(([driver, car]) => [
			driver,
			{ track: car.track, distanceM: car.distanceM.map((distance) => distance - byM) }
		])
	);
}

interface Circuit {
	outline: TrackOutline;
	cars: Map<string, CarDistance>;
	/** Where every lap began and ended, by `driverNumber/lap`. */
	windows: Map<string, LapWindow>;
	reused: boolean;
	latencyMs: number;
}

interface WrittenLap {
	entry: LapIndexEntry;
	bytes: Buffer;
}

function lapFiles(
	snapshot: RaceSnapshot,
	circuit: Circuit,
	carData: ReadonlyMap<string, CarDataTrack>
): WrittenLap[] {
	return snapshot.laps.flatMap((lap): WrittenLap[] => {
		const window = circuit.windows.get(`${lap.driverNumber}/${lap.lap}`);
		const car = circuit.cars.get(lap.driverNumber);

		if (window === undefined || car === undefined) {
			return [];
		}

		const telemetry = buildLapTelemetry(car, carData.get(lap.driverNumber), window);

		const bytes = gzipJson(telemetry);

		return [
			{
				bytes,
				entry: {
					driverNumber: lap.driverNumber,
					lap: lap.lap,
					file: `laps/${lap.driverNumber}-${lap.lap}.json.gz`,
					startedAt: telemetry.startedAt,
					lapTimeMs: telemetry.lapTimeMs,
					rows: telemetry.t.length,
					distanceM: telemetry.d.at(-1) ?? 0,
					bytes: bytes.length,
					partial: isRace(snapshot) && lap.lap === 1,
					pitIn: lap.pitIn,
					pitOut: lap.pitOut
				}
			}
		];
	});
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

export async function buildTelemetry(options: BuildOptions): Promise<TelemetryReport> {
	const started = performance.now();
	const { rawDir, key, dataDir, log } = options;
	const frames = await readArchive(rawDir, [...F1_TOPICS, ...TELEMETRY_TOPICS]);
	const telemetryTopics = new Set<string>(TELEMETRY_TOPICS);
	const streams = decodeTelemetryFrames(frames.filter((frame) => telemetryTopics.has(frame.topic)));

	if (streams.positions.length === 0) {
		return {
			status: 'skipped',
			key,
			reason: 'the session has no Position.z; the live feed withholds it without an F1 TV token'
		};
	}

	const facts = foldSession(frames.filter((frame) => !telemetryTopics.has(frame.topic)));
	const { snapshot } = facts;
	const circuitKey = facts.circuitKey;

	if (circuitKey === null) {
		return { status: 'skipped', key, reason: 'SessionInfo has no circuit key' };
	}

	if (snapshot.laps.length === 0) {
		return { status: 'skipped', key, reason: 'the session has no completed laps' };
	}

	const tracks = positionTracks(streams.positions);
	const carData = carDataTracks(streams.carData);
	let circuit: Circuit;

	try {
		circuit = await findCircuit(options, facts, tracks, circuitKey);
	} catch (error) {
		if (error instanceof NothingToDraw) {
			return { status: 'skipped', key, reason: error.message };
		}

		throw error;
	}

	const { outline } = circuit;

	log?.('telemetry-circuit', {
		reused: circuit.reused,
		lengthM: Math.round(outline.lengthM),
		latencyMs: circuit.latencyMs
	});

	const laps = lapFiles(snapshot, circuit, carData);

	const moved = laps.some(
		({ entry }) => entry.distanceM >= MIN_MOVED_SHARE * circuit.outline.lengthM
	);

	if (!moved) {
		return { status: 'skipped', key, reason: 'no lap of the session has positions that move' };
	}

	const replay = buildReplay(tracks);
	const replayFiles = replay.chunks.map(({ file, chunk }) => ({ file, bytes: gzipJson(chunk) }));
	const hasCarData = carData.size > 0;

	await replaceFolder(sessionTelemetryDir(dataDir, key), async (folder) => {
		const manifest: SessionManifest = {
			v: TELEMETRY_VERSION,
			sessionKey: key,
			circuitKey,
			hasCarData,
			laps: 'laps.json.gz',
			replay: 'replay/index.json'
		};

		await mkdir(path.join(folder, 'laps'), { recursive: true });
		await mkdir(path.join(folder, 'replay'), { recursive: true });
		await Promise.all([
			...laps.map(({ entry, bytes }) => writeFile(path.join(folder, entry.file), bytes)),
			...replayFiles.map(({ file, bytes }) => writeFile(path.join(folder, 'replay', file), bytes)),
			writeFile(
				path.join(folder, 'laps.json.gz'),
				gzipJson({
					v: TELEMETRY_VERSION,
					sessionKey: key,
					circuitKey,
					stepMs: LAP_STEP_MS,
					hasCarData,
					laps: laps.map(({ entry }) => entry)
				})
			),
			writeFile(
				path.join(folder, 'replay', 'index.json'),
				manifestJson(
					replayManifest(
						replay,
						replayFiles.map(({ bytes }) => bytes.length)
					)
				)
			),
			writeFile(path.join(folder, 'index.json'), manifestJson(manifest))
		]);
	});

	const lapBytes = laps.map(({ bytes }) => bytes.length);

	return {
		status: 'built',
		key,
		circuitKey,
		outline: {
			reused: circuit.reused,
			lengthM: Math.round(outline.lengthM),
			points: outline.points.length,
			miniSectors: outline.miniSectorStartsM.length,
			miniSectorSource: outline.source.miniSectors,
			pitLane: outline.pitLane !== null,
			latencyMs: circuit.latencyMs
		},
		laps: {
			files: laps.length,
			partial: laps.filter(({ entry }) => entry.partial).length,
			offLength: laps.filter(({ entry }) => isOffLength(entry, outline.lengthM)).length,
			maxDeviation: {
				flying: maxDeviation(laps, outline.lengthM, false),
				pit: maxDeviation(laps, outline.lengthM, true)
			},
			totalBytes: sum(lapBytes),
			meanBytes: laps.length === 0 ? 0 : Math.round(sum(lapBytes) / laps.length),
			maxBytes: Math.max(0, ...lapBytes)
		},
		replay: {
			chunks: replayFiles.length,
			totalBytes: sum(replayFiles.map(({ bytes }) => bytes.length))
		},
		hasCarData,
		skippedFrames: streams.skipped,
		elapsedMs: Math.round(performance.now() - started)
	};
}

function maxDeviation(laps: readonly WrittenLap[], lengthM: number, pit: boolean): number {
	return Math.max(
		0,
		...laps.flatMap(({ entry }) =>
			!entry.partial && (entry.pitIn || entry.pitOut) === pit
				? [Math.abs(entry.distanceM - lengthM) / lengthM]
				: []
		)
	);
}

/** A lap that was not run from the line to the line: the first of a standing start, or into the pits. */
function isOffLength(entry: LapIndexEntry, lengthM: number): boolean {
	return (
		!entry.partial &&
		!entry.pitIn &&
		!entry.pitOut &&
		Math.abs(entry.distanceM - lengthM) > LENGTH_TOLERANCE * lengthM
	);
}

/**
 * The circuit's outline and every car's distance along it. A saved outline is used as it is;
 * otherwise it is drawn, saved, and read back, so a build that drew the outline and one that
 * reused it measure the laps against the same points and give the same bytes.
 */
async function findCircuit(
	options: BuildOptions,
	facts: SessionFacts,
	tracks: ReadonlyMap<string, PositionTrack>,
	circuitKey: string
): Promise<Circuit> {
	const { dataDir } = options;
	let outline = options.rebuildOutline ? null : await readOutline(dataDir, circuitKey);
	const reused = outline !== null;

	if (outline === null) {
		await drawOutline(options, facts, tracks, circuitKey);
		outline = await readOutline(dataDir, circuitKey);
	}

	if (outline === null) {
		throw new Error(`The outline of circuit ${circuitKey} cannot be read back`);
	}

	const cars = carDistances(outline, tracks);
	const { latencyMs } = locateStartFinish(outline.lengthM, cars, crossingsOf(facts.snapshot), 0);
	const windows = lapWindows(facts.snapshot, cars, outline.lengthM, latencyMs);

	return { outline, cars, windows, reused, latencyMs };
}

/**
 * Draws the circuit from the session's cleanest lap, started at the line the lap crossings show,
 * gives it its sectors and pit lane, and saves it.
 */
async function drawOutline(
	options: BuildOptions,
	facts: SessionFacts,
	tracks: ReadonlyMap<string, PositionTrack>,
	circuitKey: string
): Promise<void> {
	const { dataDir, key } = options;
	const { snapshot } = facts;
	const crossings = crossingsOf(snapshot);

	const drawable = drawableLap(snapshot, tracks);

	if (drawable === null) {
		throw new NothingToDraw(
			'the session has no clean lap with moving positions to draw the circuit from, and the circuit is not saved'
		);
	}

	const { lap, loop } = drawable;

	const provisional = provisionalOutline(loop, {
		circuitKey,
		name: snapshot.session.circuit,
		source: {
			sessionKey: key,
			driverNumber: lap.driverNumber,
			lap: lap.lap,
			lapTimeMs: lap.lapTimeMs,
			miniSectors: 'even'
		}
	});

	const measured = carDistances(provisional, tracks);
	const line = locateStartFinish(provisional.lengthM, measured, crossings);
	const { outline: aligned, shiftedM } = rotateStart(provisional, line.distanceM);
	const cars = shifted(measured, shiftedM);
	const windows = lapWindows(snapshot, cars, aligned.lengthM, line.latencyMs);

	const timedLaps = snapshot.laps.flatMap((entry): TimedLap[] => {
		const window = windows.get(`${entry.driverNumber}/${entry.lap}`);
		const [first, second, third] = entry.sectorTimesMs;

		return window === undefined ||
			entry.pitIn ||
			entry.pitOut ||
			(isRace(snapshot) && entry.lap === 1) ||
			!(first > 0 && second > 0 && third > 0)
			? []
			: [
					{
						driverNumber: entry.driverNumber,
						startAt: window.startAt,
						endAt: window.endAt,
						sectorTimesMs: [first, second, third]
					}
				];
	});

	const sectors = placeSectors(aligned.lengthM, cars, timedLaps, readSegments(facts.segmentFrames));

	const outline: TrackOutline = {
		...aligned,
		sectorBoundariesM: sectors.sectorBoundariesM,
		miniSectorsPerSector: sectors.miniSectorsPerSector,
		miniSectorStartsM: sectors.miniSectorStartsM,
		pitLane: buildPitLane(aligned, tracks, facts.passes, line.latencyMs),
		source: { ...aligned.source, miniSectors: sectors.miniSectors }
	};

	await writeOutline(dataDir, outline);
}

/**
 * Where every lap began and ended, by `driverNumber/lap`. A lap ends when the car crossed the
 * line, found between two position samples near where the timing feed said it did, and starts
 * where the lap before ended; one with no lap before starts a lap time earlier.
 */
function lapWindows(
	snapshot: RaceSnapshot,
	cars: ReadonlyMap<string, CarDistance>,
	lengthM: number,
	latencyMs: number
): Map<string, LapWindow> {
	const ends = new Map<string, number>();

	for (const lap of snapshot.laps) {
		const car = cars.get(lap.driverNumber);

		if (lap.completedAt !== undefined && car !== undefined) {
			ends.set(
				`${lap.driverNumber}/${lap.lap}`,
				crossingTime(car, lengthM, 0, Date.parse(lap.completedAt) - latencyMs)
			);
		}
	}

	const windows = new Map<string, LapWindow>();

	for (const lap of snapshot.laps) {
		const endAt = ends.get(`${lap.driverNumber}/${lap.lap}`);
		const previous = ends.get(`${lap.driverNumber}/${lap.lap - 1}`);

		if (endAt === undefined) {
			continue;
		}

		const timed = lap.lapTimeMs > 0 ? endAt - lap.lapTimeMs : undefined;

		const startAt =
			previous !== undefined &&
			(timed === undefined || Math.abs(previous - timed) <= LAP_TIME_TOLERANCE_MS)
				? previous
				: timed;

		if (startAt !== undefined && startAt < endAt) {
			windows.set(`${lap.driverNumber}/${lap.lap}`, {
				driverNumber: lap.driverNumber,
				lap: lap.lap,
				startAt,
				endAt
			});
		}
	}

	return windows;
}
