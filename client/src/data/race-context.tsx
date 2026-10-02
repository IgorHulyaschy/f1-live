import type { RaceSnapshot } from '@f1-live/shared';
import * as React from 'react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';

import { createLocalStore } from '../lib/local-store.ts';
import type { RaceSource } from './race-source.ts';
import { type StandingRow, standingsAt } from '../insights/standings.ts';
import { snapshotAtLap } from './snapshot-at-lap.ts';

export type Plan = 'free' | 'pro';

type RaceState =
	| { status: 'loading' }
	| { status: 'error'; message: string }
	| { status: 'ready'; race: RaceSnapshot };

type RaceContextValue = {
	sourceKind: RaceSource['kind'];
	race: RaceSnapshot;
	/** The race as it stood at `lap`. */
	snapshot: RaceSnapshot;
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
	playing: z.boolean().optional()
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

function useRaceData(source: RaceSource): RaceState {
	const [state, setState] = React.useState<RaceState>({ status: 'loading' });

	React.useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				const race = await source.load();

				if (!cancelled) {
					setState({ status: 'ready', race });
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

/**
 * Race data plus the viewer's choices. Lap, plan and followed driver live in the URL so every
 * view is linkable, and tests and screenshots can open an exact state.
 */
/** The lap the URL asks for, clamped to the laps available, or the default. */
function resolveLap(raw: string | null, maxLap: number, defaultLap: number): number {
	const requested = Number(raw);

	return Number.isInteger(requested) && requested > 0 ? Math.min(requested, maxLap) : defaultLap;
}

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
	const state = useRaceData(source);
	const [searchParams, setSearchParams] = useSearchParams();
	// This window drives playback; `mirroring` means another window is playing and we follow it.
	const [playing, setLocalPlaying] = React.useState(false);
	const [mirroring, setMirroring] = React.useState(false);

	const updateParam = React.useCallback(
		(key: string, value: string) => {
			setSearchParams(
				(params) => {
					params.set(key, value);

					return params;
				},
				{ replace: true }
			);
		},
		[setSearchParams]
	);

	// Changes from another window are applied here without being sent on again.
	const broadcast = useSyncChannel((message) => {
		const { playing: remotePlaying, ...params } = message;

		if (remotePlaying !== undefined) {
			setLocalPlaying(false);
			setMirroring(remotePlaying);
		}

		setSearchParams(
			(current) => {
				for (const [key, entry] of Object.entries(params)) {
					current.set(key, String(entry));
				}

				return current;
			},
			{ replace: true }
		);
	});

	const race = state.status === 'ready' ? state.race : null;
	const maxLap = race?.currentLap ?? 1;
	const defaultLap = source.kind === 'mock' ? DEFAULT_REPLAY_LAP : maxLap;
	const lap = resolveLap(searchParams.get('lap'), maxLap, defaultLap);

	// The router hands functional updates the params of the last render, so two quick clicks would
	// both step from the same lap. The address bar is updated as soon as a navigation commits.
	const stepLap = React.useCallback(
		(delta: number) => {
			const current = resolveLap(
				new URLSearchParams(window.location.search).get('lap'),
				maxLap,
				defaultLap
			);

			const next = Math.min(Math.max(current + delta, 1), maxLap);

			updateParam('lap', String(next));
			broadcast({ lap: next });
		},
		[updateParam, maxLap, defaultLap, broadcast]
	);

	// Playback stops by itself at the last available lap.
	const drivesPlayback = playing && lap < maxLap;
	const isPlaying = (playing || mirroring) && lap < maxLap;

	React.useEffect(() => {
		if (!drivesPlayback) {
			return;
		}

		const timer = window.setInterval(() => stepLap(1), PLAYBACK_INTERVAL_MS);

		return () => window.clearInterval(timer);
	}, [drivesPlayback, stepLap]);

	const setPlaying = React.useCallback(
		(next: boolean) => {
			setLocalPlaying(next);
			setMirroring(false);
			broadcast({ playing: next });
		},
		[broadcast]
	);

	const snapshot = React.useMemo(() => (race ? snapshotAtLap(race, lap) : null), [race, lap]);
	const plan: Plan = searchParams.get('plan') === 'pro' ? 'pro' : 'free';
	const storedDriver = followedDriverStore.useValue();
	const followedDriver = searchParams.get('driver') ?? storedDriver ?? DEFAULT_FOLLOWED_DRIVER;

	const standings = React.useMemo(() => (snapshot ? standingsAt(snapshot) : []), [snapshot]);

	const value = React.useMemo<RaceContextValue | null>(
		() =>
			race && snapshot
				? {
						sourceKind: source.kind,
						race,
						snapshot,
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
			race,
			snapshot,
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

	if (state.status === 'error') {
		return <ErrorFallback message={state.message} />;
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
