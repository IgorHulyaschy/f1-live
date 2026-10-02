import type { RaceSnapshot } from '@f1-live/shared';
import * as React from 'react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';

import type { RaceSource } from './race-source.ts';
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
};

const RaceContext = React.createContext<RaceContextValue | null>(null);

const DEFAULT_REPLAY_LAP = 30;

const DEFAULT_FOLLOWED_DRIVER = '16';

const PLAYBACK_INTERVAL_MS = 1500;

/** Race state shared by every open Pitwall window, so tiles on other monitors stay in step. */
const SYNC_CHANNEL = 'pitwall-race';

const SYNCED_PARAMS = ['lap', 'driver', 'plan', 'compare'] as const;

const syncedSchema = z.object({
	lap: z.string().optional(),
	driver: z.string().optional(),
	plan: z.string().optional(),
	compare: z.string().optional()
});

type SyncedState = z.infer<typeof syncedSchema>;

/**
 * Keeps lap, followed driver, plan and compared drivers the same in every window of this
 * browser. A window that applies a change from elsewhere does not send it back.
 */
function useWindowSync(state: SyncedState, apply: (state: SyncedState) => void): void {
	const channel = React.useRef<BroadcastChannel | null>(null);
	const received = React.useRef<string | null>(null);
	const applyRef = React.useRef(apply);
	const key = JSON.stringify(state);

	React.useEffect(() => {
		applyRef.current = apply;
	});

	React.useEffect(() => {
		if (!('BroadcastChannel' in window)) {
			return;
		}

		const opened = new BroadcastChannel(SYNC_CHANNEL);

		opened.addEventListener('message', (event: MessageEvent<unknown>) => {
			const synced = syncedSchema.safeParse(event.data);

			if (synced.success) {
				received.current = JSON.stringify(synced.data);
				applyRef.current(synced.data);
			}
		});
		channel.current = opened;

		return () => {
			opened.close();
			channel.current = null;
		};
	}, []);

	// Opening or reloading a window must not pull the others to its state; only later changes go out.
	const sent = React.useRef(key);

	React.useEffect(() => {
		if (key !== sent.current && key !== received.current) {
			channel.current?.postMessage(JSON.parse(key));
		}

		sent.current = key;
	}, [key]);
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
	const [playing, setPlaying] = React.useState(false);

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

			updateParam('lap', String(Math.min(Math.max(current + delta, 1), maxLap)));
		},
		[updateParam, maxLap, defaultLap]
	);

	// Playback stops by itself at the last available lap.
	const isPlaying = playing && lap < maxLap;

	React.useEffect(() => {
		if (!isPlaying) {
			return;
		}

		const timer = window.setInterval(() => stepLap(1), PLAYBACK_INTERVAL_MS);

		return () => window.clearInterval(timer);
	}, [isPlaying, stepLap]);

	const snapshot = React.useMemo(() => (race ? snapshotAtLap(race, lap) : null), [race, lap]);
	const plan: Plan = searchParams.get('plan') === 'pro' ? 'pro' : 'free';
	const followedDriver = searchParams.get('driver') ?? DEFAULT_FOLLOWED_DRIVER;

	useWindowSync(
		{
			lap: String(lap),
			driver: followedDriver,
			plan,
			compare: searchParams.get('compare') ?? undefined
		},
		(synced) =>
			setSearchParams(
				(params) => {
					for (const param of SYNCED_PARAMS) {
						const value = synced[param];

						if (value === undefined) {
							params.delete(param);
						} else {
							params.set(param, value);
						}
					}

					return params;
				},
				{ replace: true }
			)
	);

	const value = React.useMemo<RaceContextValue | null>(
		() =>
			race && snapshot
				? {
						sourceKind: source.kind,
						race,
						snapshot,
						lap,
						setLap: (nextLap) => updateParam('lap', String(nextLap)),
						stepLap,
						playing: isPlaying,
						setPlaying,
						plan,
						setPlan: (nextPlan) => updateParam('plan', nextPlan),
						followedDriver,
						setFollowedDriver: (driverNumber) => updateParam('driver', driverNumber)
					}
				: null,
		[source.kind, race, snapshot, lap, isPlaying, plan, followedDriver, updateParam, stepLap]
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
