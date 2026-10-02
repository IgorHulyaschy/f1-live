import type { RaceSnapshot } from '@f1-live/shared';
import * as React from 'react';
import { useSearchParams } from 'react-router';

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
	const requestedLap = Number(searchParams.get('lap'));
	const defaultLap = source.kind === 'mock' ? DEFAULT_REPLAY_LAP : maxLap;

	const lap =
		Number.isInteger(requestedLap) && requestedLap > 0
			? Math.min(requestedLap, maxLap)
			: defaultLap;

	// Playback stops by itself at the last available lap.
	const isPlaying = playing && lap < maxLap;

	React.useEffect(() => {
		if (!isPlaying) {
			return;
		}

		const timer = window.setTimeout(
			() => updateParam('lap', String(lap + 1)),
			PLAYBACK_INTERVAL_MS
		);

		return () => window.clearTimeout(timer);
	}, [isPlaying, lap, updateParam]);

	const snapshot = React.useMemo(() => (race ? snapshotAtLap(race, lap) : null), [race, lap]);
	const plan: Plan = searchParams.get('plan') === 'pro' ? 'pro' : 'free';
	const followedDriver = searchParams.get('driver') ?? DEFAULT_FOLLOWED_DRIVER;

	const value = React.useMemo<RaceContextValue | null>(
		() =>
			race && snapshot
				? {
						sourceKind: source.kind,
						race,
						snapshot,
						lap,
						setLap: (nextLap) => updateParam('lap', String(nextLap)),
						playing: isPlaying,
						setPlaying,
						plan,
						setPlan: (nextPlan) => updateParam('plan', nextPlan),
						followedDriver,
						setFollowedDriver: (driverNumber) => updateParam('driver', driverNumber)
					}
				: null,
		[source.kind, race, snapshot, lap, isPlaying, plan, followedDriver, updateParam]
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
