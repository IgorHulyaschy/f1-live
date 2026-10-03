import { EMPTY_SNAPSHOT, type RaceSnapshot } from '@f1-live/shared';
import * as React from 'react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';

import { useStableValue } from '../hooks/use-stable-value.ts';
import { createLocalStore } from '../lib/local-store.ts';
import { type Catalog, defaultSessionKey, findSession, type SessionEntry } from './catalog.ts';
import { delayedSnapshot } from './broadcast-delay.ts';
import { LiveFeed, type LiveConnection, liveSessionKey, type LiveState } from './live-feed.ts';
import type { RaceSource } from './race-source.ts';
import { type StandingRow, standingsAt } from '../insights/standings.ts';
import { isSessionOver, isTimedSession } from '../insights/qualifying.ts';
import { snapshotAtLap } from './snapshot-at-lap.ts';
import { minuteTime, sessionClock, snapshotAtTime } from './snapshot-at-time.ts';
import { delayStore, revealedStore, spoilerFreeStore } from './viewer-settings.ts';

export type Plan = 'free' | 'pro';

type LiveView = {
	/** The session on screen is running now and comes from the live feed. */
	isLive: boolean;
	/** Live and showing the latest state; stepping back pauses it. */
	following: boolean;
	connection: LiveConnection;
	/** The session the live feed is on while it runs, whichever one is on screen. */
	liveKey: string | null;
	backToLive: () => void;
	/** Seconds the live screen runs behind the feed. */
	delaySeconds: number;
	setDelaySeconds: (seconds: number) => void;
};

type Spoilers = {
	/** The viewer's setting: open sessions at the start and hide results. */
	free: boolean;
	setFree: (free: boolean) => void;
	/** Results of the session on screen are hidden now. */
	hidden: boolean;
	/** Shows this session's results: its end, or live. */
	reveal: () => void;
};

type RaceContextValue = {
	sourceKind: RaceSource['kind'];
	catalog: Catalog | null;
	/** The archive key of the session on screen. */
	sessionKey: string;
	/** Another session is loading; the one on screen stays until it arrives. */
	switchingTo: string | null;
	/** Why the session asked for last could not be shown, while another stays on screen. */
	sessionError: string | null;
	setSession: (key: string) => void;
	live: LiveView;
	spoilers: Spoilers;
	race: RaceSnapshot;
	/** The race as it stood at `lap`. */
	snapshot: RaceSnapshot;
	/**
	 * Races step lap by lap. Practice and qualifying run on the clock, so there `lap` counts
	 * minutes from the start instead.
	 */
	stepUnit: 'lap' | 'minute';
	/** The last step there is: the laps run so far, or the minutes. */
	steps: number;
	lap: number;
	setLap: (lap: number) => void;
	/** Moves the replay by `delta` laps, clamped to the laps available. */
	stepLap: (delta: number) => void;
	playing: boolean;
	setPlaying: (playing: boolean) => void;
	plan: Plan;
	setPlan: (plan: Plan) => void;
	followedDriver: string;
	setFollowedDriver: (driverNumber: string) => void;
	/** Standings at `lap`, computed once for every panel. */
	standings: readonly StandingRow[];
	/** Tells other windows about a change made here. */
	broadcast: (message: SyncMessage) => void;
};

/** A driver in the running order, for panels that only need the order. */
export type RunningSlot = { number: string; out: boolean };

/**
 * The race without the running order, which moves many times a lap. `race` and `snapshot` are
 * kept while only the order and personal bests change, so their `standings` and
 * `personalBests` may be behind: read those through `useRace`.
 */
export type RaceView = Omit<RaceContextValue, 'standings'> & {
	order: readonly RunningSlot[];
};

const RaceContext = React.createContext<RaceContextValue | null>(null);

const RaceViewContext = React.createContext<RaceView | null>(null);

/** Snapshots that differ at most in the running order and personal bests. */
function sameExceptOrder(kept: RaceSnapshot, next: RaceSnapshot): boolean {
	return (
		kept.laps === next.laps &&
		kept.stints === next.stints &&
		kept.pitStops === next.pitStops &&
		kept.raceControl === next.raceControl &&
		kept.weather === next.weather &&
		kept.retirements === next.retirements &&
		kept.drivers === next.drivers &&
		kept.startingGrid === next.startingGrid &&
		kept.session === next.session &&
		kept.currentLap === next.currentLap &&
		kept.trackStatus === next.trackStatus &&
		kept.trackStatusLog === next.trackStatusLog &&
		kept.status === next.status &&
		kept.statusLog === next.statusLog &&
		kept.startedAt === next.startedAt &&
		kept.penalties === next.penalties &&
		kept.corrections === next.corrections &&
		kept.overtakes === next.overtakes &&
		kept.teamRadio === next.teamRadio &&
		kept.championship === next.championship
	);
}

function sameOrder(kept: readonly RunningSlot[], next: readonly RunningSlot[]): boolean {
	return (
		kept.length === next.length &&
		kept.every(
			(slot, index) => slot.number === next[index]?.number && slot.out === next[index]?.out
		)
	);
}

const DEFAULT_REPLAY_LAP = 30;

const DEFAULT_FOLLOWED_DRIVER = '16';

/** How long a first visit waits to hear whether a session is live before opening another. */
const LIVE_PROBE_MS = 1500;

/** The driver last followed here, so a new visit opens on them; a `driver` in the URL wins. */
const followedDriverStore = createLocalStore<string | null>(
	'pitwall-driver',
	z.string().nullable(),
	null
);

const PLAYBACK_INTERVAL_MS = 1500;

/** Race state shared by every open Pitwall window, so tiles on other monitors stay in step. */
const SYNC_CHANNEL = 'pitwall-race';

/**
 * What one window tells the others. Only deliberate actions are sent (a lap step, a new driver,
 * play or pause), never state a window loaded or clamped, so opening a tab moves nobody.
 */
const syncMessageSchema = z.object({
	lap: z.int().positive().optional(),
	driver: z.string().optional(),
	plan: z.enum(['free', 'pro']).optional(),
	compare: z.string().optional(),
	playing: z.boolean().optional(),
	session: z.string().optional(),
	live: z.literal(true).optional()
});

export type SyncMessage = z.infer<typeof syncMessageSchema>;

function useSyncChannel(receive: (message: SyncMessage) => void): (message: SyncMessage) => void {
	const channel = React.useRef<BroadcastChannel | null>(null);
	const receiveRef = React.useRef(receive);

	React.useEffect(() => {
		receiveRef.current = receive;
	});

	React.useEffect(() => {
		if (!('BroadcastChannel' in window)) {
			return;
		}

		const opened = new BroadcastChannel(SYNC_CHANNEL);

		opened.addEventListener('message', (event: MessageEvent<unknown>) => {
			const message = syncMessageSchema.safeParse(event.data);

			if (message.success) {
				receiveRef.current(message.data);
			}
		});
		channel.current = opened;

		return () => {
			opened.close();
			channel.current = null;
		};
	}, []);

	return React.useCallback((message: SyncMessage) => channel.current?.postMessage(message), []);
}

type Loadable<T> =
	{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; value: T };

function useCatalog(source: RaceSource): Loadable<Catalog> {
	const [state, setState] = React.useState<Loadable<Catalog>>({ status: 'loading' });

	React.useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				const value = await source.loadCatalog();

				if (!cancelled) {
					setState({ status: 'ready', value });
				}
			} catch (error) {
				if (!cancelled) {
					setState({
						status: 'error',
						message: error instanceof Error ? error.message : 'Unknown error'
					});
				}
			}
		}

		void load();

		return () => {
			cancelled = true;
		};
	}, [source]);

	return state;
}

const IDLE_LIVE: LiveState = { connection: 'connecting', replica: null, arrivals: [] };

/** One feed per page for the source's `WS /live`; none for a source without one. */
function useLiveFeed(url: string | null): LiveState {
	const feed = React.useMemo(() => (url ? new LiveFeed(url) : null), [url]);

	React.useEffect(() => {
		feed?.start();

		return () => feed?.stop();
	}, [feed]);

	return React.useSyncExternalStore(feed?.subscribe ?? noSubscription, feed?.getState ?? idleLive);
}

function noSubscription(): () => void {
	return () => undefined;
}

function idleLive(): LiveState {
	return IDLE_LIVE;
}

const DELAY_TICK_MS = 250;

function readDelayTick(): number {
	return Math.floor(Date.now() / DELAY_TICK_MS) * DELAY_TICK_MS;
}

function readNoTick(): number {
	return 0;
}

/**
 * The time to the quarter second, refreshed while `active`, for a screen that runs behind the
 * feed. It is read fresh, so turning a delay on never starts from a stale time.
 */
function useDelayClock(active: boolean): number {
	const subscribe = React.useCallback(
		(onTick: () => void) => {
			if (!active) {
				return () => undefined;
			}

			const timer = window.setInterval(onTick, DELAY_TICK_MS);

			return () => window.clearInterval(timer);
		},
		[active]
	);

	return React.useSyncExternalStore(subscribe, active ? readDelayTick : readNoTick);
}

/** Saved sessions loaded so far, so going back to one costs nothing. */
function useSavedSession(source: RaceSource, key: string | null): Loadable<RaceSnapshot> | null {
	const [loaded, setLoaded] = React.useState<ReadonlyMap<string, Loadable<RaceSnapshot>>>(
		() => new Map()
	);

	const known = key === null ? undefined : loaded.get(key);

	React.useEffect(() => {
		if (key === null || known) {
			return;
		}

		const store = (state: Loadable<RaceSnapshot>) =>
			setLoaded((current) => new Map(current).set(key, state));

		async function load(sessionKey: string) {
			try {
				store({ status: 'ready', value: await source.loadSession(sessionKey) });
			} catch (error) {
				store({
					status: 'error',
					message: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		void load(key);
	}, [source, key, known]);

	return key === null ? null : (known ?? { status: 'loading' });
}

/** A session with no data yet, such as one that starts later: its name, place and time. */
function placeholderSnapshot(entry: SessionEntry): RaceSnapshot {
	return {
		...EMPTY_SNAPSHOT,
		session: {
			id: entry.key,
			name: entry.session.name,
			meetingName: entry.meeting.name,
			circuit: entry.session.circuit,
			countryCode: entry.session.country.code,
			type: entry.session.type,
			totalLaps: 0,
			startsAt: entry.session.startsAt
		}
	};
}

type SessionChoice = { key: string | null; settled: boolean };

/**
 * Which session to show: the one in the address, else the live one, else the latest saved. A
 * first visit waits briefly for the live feed so it can open on a running session, and with
 * nothing in the address the screen moves to a session when it goes live, as a TV would.
 * `settled` turns true once the choice is made, even when there is nothing to choose.
 */
function useSessionKey(
	catalog: Loadable<Catalog>,
	live: LiveState,
	hasLiveFeed: boolean,
	requested: string | null
): SessionChoice {
	const [probeOver, setProbeOver] = React.useState(!hasLiveFeed);
	const [chosen, setChosen] = React.useState<string | null>(null);
	const liveKey = liveSessionKey(live);
	const decided = probeOver || live.replica !== null || live.connection !== 'connecting';
	const settled = requested !== null || (decided && catalog.status === 'ready');

	React.useEffect(() => {
		if (probeOver) {
			return;
		}

		const timer = window.setTimeout(() => setProbeOver(true), LIVE_PROBE_MS);

		return () => window.clearTimeout(timer);
	}, [probeOver]);

	const fallback =
		requested === null &&
		decided &&
		catalog.status === 'ready' &&
		(chosen === null || (liveKey !== null && liveKey !== chosen))
			? defaultSessionKey(catalog.value, liveKey)
			: null;

	if (fallback !== null && fallback !== chosen) {
		setChosen(fallback);
	}

	return { key: requested ?? chosen, settled };
}

type ShownRace = { key: string; race: RaceSnapshot; fromFeed: boolean };

/** The lap the URL asks for, clamped to the laps available, or the default. */
function resolveLap(raw: string | null, maxLap: number, defaultLap: number): number {
	const requested = Number(raw);

	return Number.isInteger(requested) && requested > 0 ? Math.min(requested, maxLap) : defaultLap;
}

/**
 * Race data plus the viewer's choices. Session, lap, plan and followed driver live in the URL so
 * every view is linkable, and tests and screenshots can open an exact state.
 */
export function RaceProvider({
	source,
	loadingFallback,
	ErrorFallback,
	children
}: {
	source: RaceSource;
	loadingFallback: React.ReactNode;
	ErrorFallback: React.ComponentType<{ message: string }>;
	children: React.ReactNode;
}) {
	const [searchParams, setSearchParams] = useSearchParams();
	const catalog = useCatalog(source);
	const liveState = useLiveFeed(source.liveUrl);
	const liveKey = liveSessionKey(liveState);

	const { key, settled } = useSessionKey(
		catalog,
		liveState,
		source.liveUrl !== null,
		searchParams.get('session')
	);

	// A session chosen for the viewer (none in the address) can change when one goes live; the
	// lap the viewer stepped to belongs to the old one.
	const autoKey = React.useRef<string | null>(null);

	React.useEffect(() => {
		if (searchParams.has('session') || key === null) {
			return;
		}

		if (autoKey.current !== null && autoKey.current !== key) {
			setSearchParams(
				(params) => {
					params.delete('lap');

					return params;
				},
				{ replace: true }
			);
		}

		autoKey.current = key;
	}, [searchParams, key, setSearchParams]);

	const entry = React.useMemo(
		() => (catalog.status === 'ready' && key !== null ? findSession(catalog.value, key) : null),
		[catalog, key]
	);

	// One placeholder per session, so the screen does not take each render for a new session.
	const placeholder = React.useMemo(() => (entry ? placeholderSnapshot(entry) : null), [entry]);
	const feedReplica = liveState.replica;
	const onFeed = key !== null && feedReplica?.sessionId === key;
	const delaySeconds = delayStore.useValue();
	// The delay holds on after the session ends, until the screen has caught up with the flag.
	const delayed = onFeed && delaySeconds > 0;
	const delayClock = useDelayClock(delayed);

	const feedRace = React.useMemo(
		() =>
			delayed
				? (delayedSnapshot(liveState.arrivals, delayClock, delaySeconds * 1000) ??
					feedReplica?.snapshot)
				: feedReplica?.snapshot,
		[delayed, liveState.arrivals, delayClock, delaySeconds, feedReplica]
	);

	const saved = useSavedSession(source, !onFeed && entry?.session.outputs.snapshot ? key : null);

	// Resolve what to show for `key`; until it is ready the previous session stays on screen.
	let wanted: ShownRace | Loadable<never> = { status: 'loading' };

	if (catalog.status === 'error') {
		wanted = catalog;
	} else if (onFeed && feedRace) {
		wanted = { key, race: feedRace, fromFeed: true };
	} else if (saved?.status === 'ready' && key !== null) {
		wanted = { key, race: saved.value, fromFeed: false };
	} else if (saved?.status === 'error') {
		wanted = saved;
	} else if (entry && placeholder && !saved) {
		wanted = { key: entry.key, race: placeholder, fromFeed: false };
	} else if (catalog.status === 'ready' && key !== null && !entry) {
		wanted = { status: 'error', message: `Session ${key} is not in the catalogue.` };
	} else if (settled && key === null) {
		wanted = { status: 'error', message: 'No session has been saved yet, and none is live.' };
	}

	const [lastShown, setLastShown] = React.useState<ShownRace | null>(null);
	const ready = 'race' in wanted ? wanted : null;

	if (ready && (ready.key !== lastShown?.key || ready.race !== lastShown.race)) {
		setLastShown(ready);
	}

	const shown = ready ?? lastShown;
	const race = shown?.race ?? null;
	// Live follows the state on screen, so a delayed screen stays live until it reaches the end.
	const isLive = Boolean(shown?.fromFeed && !isSessionOver(shown.race.status ?? 'inactive'));
	// This window drives playback; `mirroring` means another window is playing and we follow it.
	const [playing, setLocalPlaying] = React.useState(false);
	const [mirroring, setMirroring] = React.useState(false);

	const updateParams = React.useCallback(
		(change: (params: URLSearchParams) => void) => {
			setSearchParams(
				(params) => {
					change(params);

					return params;
				},
				{ replace: true }
			);
		},
		[setSearchParams]
	);

	const updateParam = React.useCallback(
		(name: string, value: string) => updateParams((params) => params.set(name, value)),
		[updateParams]
	);

	// Changes from another window are applied here without being sent on again.
	const broadcast = useSyncChannel((message) => {
		const { playing: remotePlaying, live: remoteLive, ...params } = message;

		if (remotePlaying !== undefined) {
			setLocalPlaying(false);
			setMirroring(remotePlaying);
		}

		updateParams((current) => {
			if (params.session !== undefined || remoteLive) {
				current.delete('lap');
			}

			for (const [name, value] of Object.entries(params)) {
				current.set(name, String(value));
			}
		});
	});

	const timed = race !== null && isTimedSession(race.session.type);
	const clock = React.useMemo(() => (race && timed ? sessionClock(race) : null), [race, timed]);
	const maxLap = clock ? clock.minutes : (race?.currentLap ?? 1);
	const spoilerFree = spoilerFreeStore.useValue();
	const revealed = revealedStore.useValue();
	const resultsHidden = spoilerFree && shown !== null && !revealed.includes(shown.key);
	const following = isLive && !searchParams.has('lap') && !resultsHidden;
	const defaultLap = resultsHidden ? 1 : source.kind === 'mock' ? DEFAULT_REPLAY_LAP : maxLap;
	const lap = following ? maxLap : resolveLap(searchParams.get('lap'), maxLap, defaultLap);

	const shownKey = shown?.key ?? null;

	// Seeing the latest state shows results, so in spoiler-free mode it reveals the session.
	const reveal = React.useCallback(() => {
		if (shownKey !== null) {
			revealedStore.set(
				[...revealedStore.get().filter((revealedKey) => revealedKey !== shownKey), shownKey].slice(
					-50
				)
			);
		}

		setLocalPlaying(false);
		updateParams((params) => params.delete('lap'));
	}, [shownKey, updateParams]);

	const backToLive = React.useCallback(() => {
		reveal();
		broadcast({ live: true });
	}, [reveal, broadcast]);

	// The router hands functional updates the params of the last render, so two quick clicks would
	// both step from the same lap. The address bar is updated as soon as a navigation commits.
	const stepLap = React.useCallback(
		(delta: number) => {
			const raw = new URLSearchParams(window.location.search).get('lap');

			// Following live already shows the newest lap; only stepping back leaves it.
			if (isLive && raw === null && !resultsHidden && delta > 0) {
				return;
			}

			const current = resolveLap(raw, maxLap, defaultLap);
			const next = Math.min(Math.max(current + delta, 1), maxLap);

			updateParam('lap', String(next));
			broadcast({ lap: next });
		},
		[updateParam, maxLap, defaultLap, broadcast, isLive, resultsHidden]
	);

	// Playback stops by itself at the last available lap; on a live session it rejoins live there.
	const drivesPlayback = playing && lap < maxLap;
	const isPlaying = (playing || mirroring) && lap < maxLap;

	React.useEffect(() => {
		if (!drivesPlayback) {
			return;
		}

		const timer = window.setInterval(() => {
			const current = resolveLap(
				new URLSearchParams(window.location.search).get('lap'),
				maxLap,
				defaultLap
			);

			if (isLive && current + 1 >= maxLap) {
				backToLive();
			} else {
				stepLap(1);
			}
		}, PLAYBACK_INTERVAL_MS);

		return () => window.clearInterval(timer);
	}, [drivesPlayback, stepLap, isLive, maxLap, defaultLap, backToLive]);

	const setPlaying = React.useCallback(
		(next: boolean) => {
			setLocalPlaying(next);
			setMirroring(false);
			broadcast({ playing: next });
		},
		[broadcast]
	);

	const setSession = React.useCallback(
		(nextKey: string) => {
			setLocalPlaying(false);
			updateParams((params) => {
				params.set('session', nextKey);
				params.delete('lap');
			});
			broadcast({ session: nextKey });
		},
		[updateParams, broadcast]
	);

	const snapshot = React.useMemo(() => {
		if (!race || following || (clock && lap >= maxLap)) {
			return race;
		}

		return clock ? snapshotAtTime(race, minuteTime(clock, lap)) : snapshotAtLap(race, lap);
	}, [race, lap, following, clock, maxLap]);

	const plan: Plan = searchParams.get('plan') === 'pro' ? 'pro' : 'free';
	const storedDriver = followedDriverStore.useValue();
	const followedDriver = searchParams.get('driver') ?? storedDriver ?? DEFAULT_FOLLOWED_DRIVER;

	const standings = React.useMemo(() => (snapshot ? standingsAt(snapshot) : []), [snapshot]);
	const viewRace = useStableValue(race ?? EMPTY_SNAPSHOT, sameExceptOrder);
	const viewSnapshot = useStableValue(snapshot ?? EMPTY_SNAPSHOT, sameExceptOrder);

	const order = useStableValue(
		standings.map((row) => ({ number: row.driver.number, out: row.state === 'out' })),
		sameOrder
	);

	const live = React.useMemo<LiveView>(
		() => ({
			isLive,
			following,
			connection: liveState.connection,
			liveKey,
			backToLive,
			delaySeconds,
			setDelaySeconds: delayStore.set
		}),
		[isLive, following, liveState.connection, liveKey, backToLive, delaySeconds]
	);

	const spoilers = React.useMemo<Spoilers>(
		() => ({ free: spoilerFree, setFree: spoilerFreeStore.set, hidden: resultsHidden, reveal }),
		[spoilerFree, resultsHidden, reveal]
	);

	const catalogValue = catalog.status === 'ready' ? catalog.value : null;
	const sessionError = 'message' in wanted ? wanted.message : null;
	const switchingTo = key !== null && shown && shown.key !== key && !sessionError ? key : null;

	type RaceBase = Omit<RaceContextValue, 'race' | 'snapshot' | 'standings'>;

	// Everything but the data, so the view below can skip updates that only move the order.
	const base = React.useMemo<RaceBase | null>(
		() =>
			shownKey === null
				? null
				: {
						sourceKind: source.kind,
						catalog: catalogValue,
						sessionKey: shownKey,
						switchingTo,
						sessionError,
						setSession,
						live,
						spoilers,
						stepUnit: timed ? 'minute' : 'lap',
						steps: maxLap,
						lap,
						setLap: (nextLap) => {
							updateParam('lap', String(nextLap));
							broadcast({ lap: nextLap });
						},
						stepLap,
						playing: isPlaying,
						setPlaying,
						plan,
						setPlan: (nextPlan) => {
							updateParam('plan', nextPlan);
							broadcast({ plan: nextPlan });
						},
						followedDriver,
						setFollowedDriver: (driverNumber) => {
							followedDriverStore.set(driverNumber);
							updateParam('driver', driverNumber);
							broadcast({ driver: driverNumber });
						},
						broadcast
					},
		[
			source.kind,
			catalogValue,
			shownKey,
			switchingTo,
			sessionError,
			setSession,
			live,
			spoilers,
			timed,
			maxLap,
			lap,
			isPlaying,
			setPlaying,
			plan,
			followedDriver,
			updateParam,
			stepLap,
			broadcast
		]
	);

	const value = React.useMemo<RaceContextValue | null>(
		() => (base && race && snapshot ? { ...base, race, snapshot, standings } : null),
		[base, race, snapshot, standings]
	);

	const hasValue = value !== null;

	const view = React.useMemo<RaceView | null>(
		() => (base && hasValue ? { ...base, race: viewRace, snapshot: viewSnapshot, order } : null),
		[base, hasValue, viewRace, viewSnapshot, order]
	);

	if (!value && sessionError !== null) {
		return <ErrorFallback message={sessionError} />;
	}

	if (!value) {
		return loadingFallback;
	}

	return (
		<RaceContext.Provider value={value}>
			<RaceViewContext.Provider value={view}>{children}</RaceViewContext.Provider>
		</RaceContext.Provider>
	);
}

/**
 * The race for panels that do not show the running order: they skip the many updates between
 * lap crossings that only move it.
 */
export function useRaceView(): RaceView {
	const context = React.useContext(RaceViewContext);

	if (!context) {
		throw new Error('useRaceView must be used within <RaceProvider>');
	}

	return context;
}

export function useRace(): RaceContextValue {
	const context = React.useContext(RaceContext);

	if (!context) {
		throw new Error('useRace must be used within <RaceProvider>');
	}

	return context;
}
