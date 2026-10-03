import * as React from 'react';

import { useRace } from '@/data/race-context';
import { latestTime } from '@/data/snapshot-at-time';

function readSecond(): number {
	return Math.floor(Date.now() / 1000);
}

function readNothing(): number {
	return 0;
}

function subscribeSeconds(onTick: () => void): () => void {
	const timer = window.setInterval(onTick, 1000);

	return () => window.clearInterval(timer);
}

function subscribeNever(): () => void {
	return () => undefined;
}

/**
 * The moment the screen shows: now on the feed while following live (kept current every second
 * when `tick` asks for it), the minute stepped to in a replay, else the end of what the session
 * holds.
 */
export function useScreenTime({ tick = false }: { tick?: boolean } = {}): number {
	const { live, cutTime, snapshot, feedOffsetMs } = useRace();
	const following = live.isLive && live.following;

	const second = React.useSyncExternalStore(
		following && tick ? subscribeSeconds : subscribeNever,
		following ? readSecond : readNothing
	);

	if (following) {
		return second * 1000 + feedOffsetMs;
	}

	return cutTime ?? latestTime(snapshot);
}
