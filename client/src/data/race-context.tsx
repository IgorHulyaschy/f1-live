import { EMPTY_SNAPSHOT, type RaceSnapshot } from '@f1-live/shared';
import * as React from 'react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';

import { createLocalStore } from '../lib/local-store.ts';
import { type Catalog, defaultSessionKey, findSession, type SessionEntry } from './catalog.ts';
import { delayedSnapshot } from './broadcast-delay.ts';
import { LiveFeed, type LiveConnection, liveSessionKey, type LiveState } from './live-feed.ts';
import type { RaceSource } from './race-source.ts';
import { type StandingRow, standingsAt } from '../insights/standings.ts';
import { isTimedSession } from '../insights/qualifying.ts';
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

const RaceContext = React.createContext<RaceContextValue | null>(null);

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

/** The time, refreshed while `active`, for a screen that runs behind the feed. */
function useDelayClock(active: boolean): number {
	const [now, setNow] = React.useState(() => Date.now());

	React.useEffect(() => {
		if (!active) {
			return;
		}

		const timer = window.setInterval(() => setNow(Date.now()), DELAY_TICK_MS);

		return () => window.clearInterval(timer);
	}, [active]);

	return now;
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

/**
 * Which session to show: the one in the address, else the live one, else the latest saved. A
 * first visit waits briefly for the live feed so it can open on a running session; the choice is
 * then kept, so a session going live later does not pull the screen away. `settled` turns true
 * once the choice is made, even when there is nothing to choose.
 */
type SessionChoice = { key: string | null; settled: boolean };

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
		requested === null && chosen === null && decided && catalog.status === 'ready'
			? defaultSessionKey(catalog.value, liveKey)
			: null;

	if (fallback !== null) {
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

	const entry = catalog.status === 'ready' && key !== null ? findSession(catalog.value, key) : null;
	const feedReplica = liveState.replica;
	const onFeed = key !== null && feedReplica?.sessionId === key;
	const delaySeconds = delayStore.useValue();
	const delayed = onFeed && key === liveKey && delaySeconds > 0;
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
	} else if (entry && !saved) {
		wanted = { key: entry.key, race: placeholderSnapshot(entry), fromFeed: false };
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
	const isLive = Boolean(shown?.fromFeed && shown.key === liveKey);
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

			// Live already shows the newest lap; only stepping back leaves it.
			if (isLive && raw === null && delta > 0) {
				return;
			}

			const current = resolveLap(raw, maxLap, defaultLap);
			const next = Math.min(Math.max(current + delta, 1), maxLap);

			updateParam('lap', String(next));
			broadcast({ lap: next });
		},
		[updateParam, maxLap, defaultLap, broadcast, isLive]
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

	const value = React.useMemo<RaceContextValue | null>(
		() =>
			shown && race && snapshot
				? {
						sourceKind: source.kind,
						catalog: catalogValue,
						sessionKey: shown.key,
						switchingTo,
						sessionError,
						setSession,
						live,
						spoilers,
						race,
						snapshot,
						stepUnit: clock ? 'minute' : 'lap',
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
						standings,
						broadcast
					}
				: null,
		[
			source.kind,
			catalogValue,
			shown,
			switchingTo,
			sessionError,
			setSession,
			live,
			spoilers,
			race,
			snapshot,
			clock,
			maxLap,
			lap,
			isPlaying,
			setPlaying,
			plan,
			followedDriver,
			updateParam,
			stepLap,
			standings,
			broadcast
		]
	);

	if (!value && sessionError !== null) {
		return <ErrorFallback message={sessionError} />;
	}

	if (!value) {
		return loadingFallback;
	}

	return <RaceContext.Provider value={value}>{children}</RaceContext.Provider>;
}

export function useRace(): RaceContextValue {
	const context = React.useContext(RaceContext);

	if (!context) {
		throw new Error('useRace must be used within <RaceProvider>');
	}

	return context;
}
