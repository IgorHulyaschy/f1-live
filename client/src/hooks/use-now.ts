import * as React from 'react';

const TICK_MS = 30_000;

function subscribe(onTick: () => void): () => void {
	const timer = window.setInterval(onTick, TICK_MS);

	return () => window.clearInterval(timer);
}

function readNow(): number {
	return Math.floor(Date.now() / TICK_MS) * TICK_MS;
}

/** The time to the half minute: enough to tell a session that has started from one to come. */
export function useNow(): number {
	return React.useSyncExternalStore(subscribe, readNow);
}
