import type { RaceSnapshot } from '@f1-live/shared';
import * as React from 'react';

type LoadSession = (key: string) => Promise<RaceSnapshot>;

const SnapshotsContext = React.createContext<LoadSession>(() =>
	Promise.reject(new Error('No session source'))
);

/** Whole saved sessions for answers about any of them, each fetched once per page load. */
export function SnapshotsProvider({
	load,
	children
}: {
	load: LoadSession;
	children: React.ReactNode;
}) {
	const [cache] = React.useState(() => new Map<string, Promise<RaceSnapshot>>());

	const cached = React.useCallback<LoadSession>(
		(key) => {
			const known = cache.get(key);

			if (known) {
				return known;
			}

			const loading = load(key);

			cache.set(key, loading);
			// A failed load is asked for again next time.
			loading.catch(() => cache.delete(key));

			return loading;
		},
		[cache, load]
	);

	return <SnapshotsContext value={cached}>{children}</SnapshotsContext>;
}

export type SnapshotState =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'error'; message: string }
	| { status: 'ready'; snapshot: RaceSnapshot };

/** The saved session `key`, loaded on demand; idle while `key` is null. */
export function useSessionSnapshot(key: string | null): SnapshotState {
	const load = React.use(SnapshotsContext);

	const [state, setState] = React.useState<{ key: string | null; value: SnapshotState }>({
		key: null,
		value: { status: 'idle' }
	});

	React.useEffect(() => {
		if (key === null) {
			return;
		}

		let cancelled = false;

		async function run(wanted: string) {
			try {
				const snapshot = await load(wanted);

				if (!cancelled) {
					setState({ key: wanted, value: { status: 'ready', snapshot } });
				}
			} catch (error) {
				if (!cancelled) {
					setState({
						key: wanted,
						value: {
							status: 'error',
							message: error instanceof Error ? error.message : 'Unknown error'
						}
					});
				}
			}
		}

		void run(key);

		return () => {
			cancelled = true;
		};
	}, [key, load]);

	if (key === null) {
		return { status: 'idle' };
	}

	return state.key === key ? state.value : { status: 'loading' };
}
