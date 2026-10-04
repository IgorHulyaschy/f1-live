import type { LapIndexEntry, LapTelemetry } from '@f1-live/shared';
import * as React from 'react';

import { useStableValue } from '../hooks/use-stable-value.ts';
import { useRaceView } from './race-context.tsx';
import type { SessionTelemetry, TelemetrySource } from './telemetry-source.ts';
import { useArchiveFetch } from './use-archive-fetch.ts';

const TelemetryContext = React.createContext<TelemetrySource | null>(null);

/** Where telemetry comes from; none for a source that has no telemetry files. */
export function TelemetryProvider({
	source,
	children
}: {
	source: TelemetrySource | null;
	children: React.ReactNode;
}) {
	return <TelemetryContext.Provider value={source}>{children}</TelemetryContext.Provider>;
}

export type TelemetryState =
	| { status: 'unavailable' }
	| { status: 'loading' }
	| { status: 'error'; message: string }
	| { status: 'ready'; value: SessionTelemetry };

function settled(value: SessionTelemetry | null): TelemetryState {
	return value ? { status: 'ready', value } : { status: 'unavailable' };
}

/**
 * The telemetry of the session on screen. `unavailable` when the source has none or the
 * session was saved without it. Telemetry loaded before shows at once.
 */
export function useSessionTelemetry(): TelemetryState {
	const source = React.useContext(TelemetryContext);
	const { sessionKey, maps } = useRaceView();

	// Positions fetched from the archive make the source forget the session: drawn again, it loads.
	useArchiveFetch(maps.archive, sessionKey);

	const known = source?.loadedSession(sessionKey);
	const [arrived, setArrived] = React.useState<{ key: string; state: TelemetryState } | null>(null);

	React.useEffect(() => {
		if (!source || known !== undefined) {
			return;
		}

		let cancelled = false;

		async function load(loader: TelemetrySource, key: string) {
			try {
				const value = await loader.loadSession(key);

				if (!cancelled) {
					setArrived({ key, state: settled(value) });
				}
			} catch (error) {
				if (!cancelled) {
					setArrived({
						key,
						state: {
							status: 'error',
							message: error instanceof Error ? error.message : 'Unknown error'
						}
					});
				}
			}
		}

		void load(source, sessionKey);

		return () => {
			cancelled = true;
		};
	}, [source, sessionKey, known]);

	if (!source) {
		return { status: 'unavailable' };
	}

	if (known !== undefined) {
		return settled(known);
	}

	return arrived?.key === sessionKey ? arrived.state : { status: 'loading' };
}

function sameFiles(kept: readonly LapIndexEntry[], next: readonly LapIndexEntry[]): boolean {
	return (
		kept.length === next.length && kept.every((entry, index) => entry.file === next[index]?.file)
	);
}

/** Laps by their file, each once it has loaded; a lap that failed holds its error. */
export type LoadedLaps = ReadonlyMap<string, LapTelemetry | Error>;

/** Loads the laps asked for; those loaded before, here or in another tile, show at once. */
export function useLapTelemetry(entries: readonly LapIndexEntry[]): LoadedLaps {
	const source = React.useContext(TelemetryContext);
	const { sessionKey } = useRaceView();

	// By session and file, as each lap arrives or fails.
	const [arrived, setArrived] = React.useState<ReadonlyMap<string, LapTelemetry | Error>>(
		() => new Map()
	);

	// A new array naming the same files asks for nothing new.
	const wanted = useStableValue(entries, sameFiles);

	React.useEffect(() => {
		if (!source) {
			return;
		}

		let cancelled = false;

		async function load(loader: TelemetrySource, key: string, entry: LapIndexEntry) {
			let result: LapTelemetry | Error;

			try {
				result = await loader.loadLap(key, entry);
			} catch (error) {
				result = error instanceof Error ? error : new Error('Unknown error');
			}

			if (!cancelled) {
				setArrived((current) => new Map(current).set(`${key}/${entry.file}`, result));
			}
		}

		for (const entry of wanted) {
			if (source.loadedLap(sessionKey, entry) === undefined) {
				void load(source, sessionKey, entry);
			}
		}

		return () => {
			cancelled = true;
		};
	}, [source, sessionKey, wanted]);

	return React.useMemo(() => {
		const laps = new Map<string, LapTelemetry | Error>();

		for (const entry of wanted) {
			const lap =
				source?.loadedLap(sessionKey, entry) ?? arrived.get(`${sessionKey}/${entry.file}`);

			if (lap) {
				laps.set(entry.file, lap);
			}
		}

		return laps;
	}, [source, sessionKey, wanted, arrived]);
}
