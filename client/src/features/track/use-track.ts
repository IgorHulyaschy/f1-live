import type { RaceSnapshot, TrackOutline } from '@f1-live/shared';
import { useReducedMotion } from 'motion/react';
import * as React from 'react';

import { MAX_DELAY_SECONDS } from '@/data/broadcast-delay';
import { useRace, useRaceView } from '@/data/race-context';
import { stepTime } from '@/data/session-time';
import type { MapSession, MapTelemetry } from '@/data/map-telemetry';
import { useArchiveFetch } from '@/data/use-archive-fetch';

import { type EstimateModel, estimateModel } from './estimate';
import { LIVE_LAG_MS, LivePositionBuffer } from './live-positions';
import { laneGeometry, type LaneGeometry } from './pit-lane';
import { type CarSample, ReplayPositions } from './replay-positions';
import {
	type CarPlace,
	estimatedPlaces,
	lapsAt,
	type PlaceSource,
	placeFromPosition
} from './track-frames';

/** The circuit and the session's replay, once loaded. */
export type TrackReady = {
	status: 'ready';
	sessionKey: string;
	outline: TrackOutline;
	lane: LaneGeometry | null;
	telemetry: MapSession | null;
	replay: ReplayPositions | null;
};

export type TrackData =
	{ status: 'loading' } | { status: 'none' } | { status: 'error'; message: string } | TrackReady;

const loaded = new WeakMap<MapTelemetry, Map<string, Promise<TrackReady | null>>>();

/** Tracks already in, so a map that mounts again (a new layout, a pop-out) draws at once. */
const settled = new WeakMap<MapTelemetry, Map<string, TrackData>>();

function settledTrack(source: MapTelemetry, key: string): TrackData | undefined {
	return settled.get(source)?.get(key);
}

/**
 * Keys a session's track; one whose positions the server fetched since the page loaded is a new
 * track, so the one without them is not reused.
 */
function trackKey(sessionKey: string, circuitKey: string | undefined, fetched: boolean): string {
	return `${sessionKey}/${circuitKey ?? ''}${fetched ? '/fetched' : ''}`;
}

/** A session's circuit and replay, shared by every map on the page and fetched once. */
function loadTrack(
	source: MapTelemetry,
	sessionKey: string,
	circuitKey: string | undefined,
	fetched: boolean
): Promise<TrackReady | null> {
	const sessions = loaded.get(source) ?? new Map<string, Promise<TrackReady | null>>();
	const key = trackKey(sessionKey, circuitKey, fetched);
	let pending = sessions.get(key);

	loaded.set(source, sessions);

	if (!pending) {
		// A map without its replay estimates instead; it is not kept, so the next map asks again.
		let partial = false;

		pending = (async () => {
			const telemetry = await source.loadSession(sessionKey);
			const circuit = telemetry?.circuitKey ?? circuitKey;
			const outline = circuit === undefined ? null : await source.loadOutline(circuit);

			if (!outline) {
				return null;
			}

			const manifest = telemetry?.replay
				? await source.loadReplayManifest(sessionKey, telemetry.replay).catch(() => {
						partial = true;

						return null;
					})
				: null;

			return {
				status: 'ready',
				sessionKey,
				outline,
				lane: laneGeometry(outline),
				telemetry,
				replay: manifest
					? new ReplayPositions(manifest, (ref) => source.loadReplayChunk(sessionKey, ref.file))
					: null
			};
		})();
		const done = settled.get(source) ?? new Map<string, TrackData>();

		settled.set(source, done);

		const forget = () => {
			sessions.delete(key);
			done.delete(key);
		};

		const loading = pending;

		void (async () => {
			try {
				const ready = await loading;

				if (partial) {
					forget();
				} else {
					done.set(key, ready ?? { status: 'none' });
				}
			} catch {
				forget();
			}
		})();

		sessions.set(key, pending);
	}

	return pending;
}

/** The track has no positions to replay: the server may fetch them from the archive. */
function lacksPositions(data: TrackData): boolean {
	return data.status === 'none' || (data.status === 'ready' && data.telemetry === null);
}

/** The archive fetch of the session on screen, and a way to try it again after a failure. */
export function useTrackFetch() {
	const { maps, sessionKey } = useRaceView();
	const status = useArchiveFetch(maps.archive, sessionKey);
	const retry = React.useCallback(() => maps.archive?.start(sessionKey, true), [maps, sessionKey]);

	return { status, retry };
}

type KeyedTrack = { key: string; data: TrackData };

/** The circuit and replay of the session on screen. */
export function useTrackData(): TrackData {
	const { maps, sessionKey, race, live } = useRace();
	const circuitKey = race.session.circuitKey;
	const fetched = useArchiveFetch(maps.archive, sessionKey)?.state === 'ready';
	const key = trackKey(sessionKey, circuitKey, fetched);
	const [state, setState] = React.useState<KeyedTrack | null>(null);

	React.useEffect(() => {
		let cancelled = false;

		async function load() {
			let data: TrackData;

			try {
				data = (await loadTrack(maps, sessionKey, circuitKey, fetched)) ?? { status: 'none' };
			} catch (error) {
				data = {
					status: 'error',
					message: error instanceof Error ? error.message : 'Unknown error'
				};
			}

			if (!cancelled) {
				setState({ key, data });
			}
		}

		void load();

		return () => {
			cancelled = true;
		};
	}, [maps, sessionKey, circuitKey, key, fetched]);

	const data = state?.key === key ? state.data : (settledTrack(maps, key) ?? { status: 'loading' });

	const wantsPositions = !live.isLive && lacksPositions(data);

	React.useEffect(() => {
		if (wantsPositions) {
			maps.archive?.start(sessionKey);
		}
	}, [maps, sessionKey, wantsPositions]);

	return data;
}

const models = new WeakMap<RaceSnapshot, Map<string, EstimateModel>>();

/** One estimate model per snapshot, circuit and mode, shared by every map on the page. */
function sharedModel(race: RaceSnapshot, outline: TrackOutline, live: boolean): EstimateModel {
	const byKey = models.get(race) ?? new Map<string, EstimateModel>();
	const key = `${outline.circuitKey}/${live}`;
	let model = byKey.get(key);

	if (!model) {
		model = estimateModel(race, outline, live);
		byKey.set(key, model);
		models.set(race, byKey);
	}

	return model;
}

/** How long the live feed's positions are kept: the longest broadcast delay and some. */
const LIVE_KEEP_MS = (MAX_DELAY_SECONDS + 30) * 1000;

/** The places on screen, read each frame. */
export type Places = {
	time: number;
	/** Cars on the circuit, the furthest round first. */
	cars: readonly CarPlace[];
	source: PlaceSource;
	/** Positions are on their way: the replay chunk for this moment is loading. */
	waiting: boolean;
};

export type PlacesSampler = {
	sample: (perf: number) => Places;
	/** Where places come from now, for the tile to say. */
	source: PlaceSource;
	live: boolean;
	/** Live only: whether the feed sends positions; null until the server says. */
	positionsLive: boolean | null;
	/** The clock runs, so the map must redraw every frame. */
	moving: boolean;
	/** Subscribes to anything that changes a still picture: a chunk arriving, a live frame. */
	subscribe: (listener: () => void) => () => void;
	/** One car at any moment: for gaps on the road and where a stop would put it. */
	placeAt: (driverNumber: string, time: number) => CarPlace | null;
};

type LiveBuffer = {
	buffer: LivePositionBuffer | null;
	positionsLive: boolean | null;
	subscribe: (listener: () => void) => () => void;
};

/** Live car positions from the feed while the screen follows a live session. */
function useLiveBuffer(active: boolean): LiveBuffer {
	const { live } = useRace();
	const feed = live.positions;
	const [buffer] = React.useState(() => new LivePositionBuffer(LIVE_KEEP_MS));
	const listeners = React.useRef(new Set<() => void>());

	React.useEffect(() => {
		if (!active || !feed) {
			return;
		}

		let told = false;

		return feed.watchPositions((frame) => {
			buffer.push(frame);

			// A new watcher is handed minutes of frames at once: tell the map once, not per frame.
			if (!told) {
				told = true;
				queueMicrotask(() => {
					told = false;

					for (const listener of listeners.current) {
						listener();
					}
				});
			}
		});
	}, [active, feed, buffer]);

	const positionsLive = React.useSyncExternalStore(
		feed?.subscribePositionsLive ?? noSubscription,
		feed?.getPositionsLive ?? unknown
	);

	const subscribe = React.useCallback((listener: () => void) => {
		listeners.current.add(listener);

		return () => listeners.current.delete(listener);
	}, []);

	return { buffer: active ? buffer : null, positionsLive, subscribe };
}

function noSubscription(): () => void {
	return () => undefined;
}

function unknown(): null {
	return null;
}

/** Reduced motion updates the picture once a second instead of gliding. */
const STILL_STEP_MS = 1000;

/** While a chunk loads, the last places are held this long before estimates stand in. */
const HOLD_MS = 2000;

/**
 * Where every car is at the moment the screen shows: from the replay's positions, the live
 * feed's, or timing alone when there are none. Read with `sample` from a drawing loop.
 */
export function usePlaces(track: TrackReady): PlacesSampler {
	const { race, live, replayClock, timeline, lap, playing } = useRace();
	const reducedMotion = useReducedMotion() ?? false;
	const followingLive = live.isLive && live.following;
	const liveBuffer = useLiveBuffer(followingLive);
	const useLivePositions = followingLive && liveBuffer.positionsLive === true;
	const replay = followingLive ? null : track.replay;

	const model = React.useMemo(
		() => sharedModel(race, track.outline, followingLive),
		[race, track.outline, followingLive]
	);

	const driverNumbers = React.useMemo(
		() => race.drivers.map((driver) => driver.number),
		[race.drivers]
	);

	const hints = React.useRef(new Map<string, number>());
	const delayMs = live.delaySeconds * 1000;
	const feedTime = live.feedTime;
	const span = replay?.span;
	const replayTime = timeline ? stepTime(timeline, lap) : 0;
	const replayCovers = span !== undefined && replayTime >= span.from && replayTime <= span.to;

	const source: PlaceSource =
		useLivePositions || (replay && replayCovers) ? 'positions' : 'estimated';

	const held = React.useRef<Places | null>(null);

	/** A car from its sampled position, unless it had retired by then. */
	const fromPosition = React.useCallback(
		(driverNumber: string, point: CarSample, time: number, hint: number | undefined) => {
			const retiredAt = model.retiredAt.get(driverNumber);

			if (retiredAt !== undefined && retiredAt <= time) {
				return null;
			}

			const { done, agoMs } = lapsAt(model.crossings, driverNumber, time);

			return placeFromPosition(track.outline, track.lane, driverNumber, point, done, agoMs, hint);
		},
		[model, track.outline, track.lane]
	);

	const sample = React.useCallback(
		(perf: number): Places => {
			// Reduced motion: the picture changes once a second rather than every frame.
			const still = reducedMotion && (followingLive || replayClock.running);
			let time: number;

			if (followingLive) {
				time =
					useLivePositions && liveBuffer.buffer && !liveBuffer.buffer.empty
						? liveBuffer.buffer.feedTime(perf) - delayMs - LIVE_LAG_MS
						: feedTime();
			} else {
				time = still ? replayClock.stepped(perf, STILL_STEP_MS) : replayClock.now(perf);
			}

			// Live runs at real time, so a second of the feed is a second on screen.
			if (still && followingLive) {
				time = Math.floor(time / STILL_STEP_MS) * STILL_STEP_MS;
			}

			const samples = new Map<string, CarSample>();
			let positions = false;

			if (useLivePositions && liveBuffer.buffer) {
				positions = liveBuffer.buffer.sample(time, samples);
			} else if (replay && source === 'positions') {
				replay.want(time, playing ? 3 : 1);
				positions = replay.sample(time, samples);
			}

			if (!positions) {
				const last = held.current;

				// While the next chunk loads, the cars hold where they were rather than jump to estimates.
				if (source === 'positions' && last && Math.abs(last.time - time) < HOLD_MS) {
					return { ...last, waiting: replay !== null && !replay.missing(time) };
				}

				return {
					time,
					cars: estimatedPlaces(model, driverNumbers, time).toSorted(
						(a, b) => b.progress - a.progress
					),
					source: 'estimated',
					waiting: source === 'positions' && replay !== null && !replay.missing(time)
				};
			}

			const cars = driverNumbers.flatMap((driverNumber) => {
				const point = samples.get(driverNumber);

				const place = point
					? fromPosition(driverNumber, point, time, hints.current.get(driverNumber))
					: null;

				if (place?.distanceM !== null && place?.distanceM !== undefined) {
					hints.current.set(driverNumber, place.distanceM);
				}

				return place ?? [];
			});

			const places: Places = {
				time,
				cars: cars.toSorted((a, b) => b.progress - a.progress),
				source: 'positions',
				waiting: false
			};

			held.current = places;

			return places;
		},
		[
			followingLive,
			useLivePositions,
			liveBuffer.buffer,
			delayMs,
			feedTime,
			replayClock,
			reducedMotion,
			replay,
			source,
			playing,
			model,
			driverNumbers,
			fromPosition
		]
	);

	const placeAt = React.useCallback(
		(driverNumber: string, time: number): CarPlace | null => {
			if (source === 'estimated') {
				return estimatedPlaces(model, [driverNumber], time)[0] ?? null;
			}

			if (useLivePositions && liveBuffer.buffer) {
				const samples = new Map<string, CarSample>();

				liveBuffer.buffer.sample(time, samples);

				const point = samples.get(driverNumber);

				return point ? fromPosition(driverNumber, point, time, undefined) : null;
			}

			// A moment in the past may need its chunk: ask for it, and the next reading has it.
			replay?.want(time, 0);

			const point = replay?.sampleCar(driverNumber, time);

			return point ? fromPosition(driverNumber, point, time, undefined) : null;
		},
		[source, model, useLivePositions, liveBuffer.buffer, replay, fromPosition]
	);

	const liveSubscribe = liveBuffer.subscribe;

	const subscribe = React.useCallback(
		(listener: () => void) => {
			const stops = [replayClock.subscribe(listener), liveSubscribe(listener)];

			if (replay) {
				stops.push(replay.subscribe(listener));
			}

			return () => {
				for (const stop of stops) {
					stop();
				}
			};
		},
		[replayClock, liveSubscribe, replay]
	);

	return {
		sample,
		source,
		live: followingLive,
		positionsLive: liveBuffer.positionsLive,
		moving: followingLive || playing,
		subscribe,
		placeAt
	};
}

/** For a map that draws no cars: nothing moves, nothing loads. */
export const NO_PLACES: PlacesSampler = {
	sample: () => ({ time: 0, cars: [], source: 'positions', waiting: false }),
	source: 'positions',
	live: false,
	positionsLive: null,
	moving: false,
	subscribe: () => () => undefined,
	placeAt: () => null
};
