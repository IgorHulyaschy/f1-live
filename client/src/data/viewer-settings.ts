import * as React from 'react';
import { z } from 'zod';

import { EVENT_FILTERS } from '../insights/timeline.ts';
import { createLocalStore } from '../lib/local-store.ts';
import { MAX_DELAY_SECONDS } from './broadcast-delay.ts';
import { isRevealed, MAX_REVEALED, type SpoilerSettings, withRevealed } from './spoilers.ts';

/** Seconds the live screen runs behind the feed, to match the viewer's TV. */
export const delayStore = createLocalStore(
	'pitwall-delay',
	z.number().min(0).max(MAX_DELAY_SECONDS),
	0
);

/**
 * Spoiler protection, on unless the viewer turns it off: finished sessions open at the start and
 * their results stay hidden until revealed. The key predates the default, so a viewer who turned
 * it off before stays off.
 */
export const spoilerProtectionStore = createLocalStore('pitwall-spoiler-free', z.boolean(), true);

/** Sessions whose results the viewer has seen, newest last. */
export const revealedStore = createLocalStore(
	'pitwall-revealed',
	z.array(z.string()).max(MAX_REVEALED),
	[]
);

export function useSpoilerSettings(): SpoilerSettings {
	const protect = spoilerProtectionStore.useValue();
	const revealed = revealedStore.useValue();

	return React.useMemo(() => ({ protect, revealed }), [protect, revealed]);
}

/** Whether the viewer may see a session's result, for lists of sessions (picker, calendar). */
export function useIsRevealed(): (sessionKey: string) => boolean {
	const settings = useSpoilerSettings();

	return React.useCallback((sessionKey) => isRevealed(settings, sessionKey), [settings]);
}

/** Remembers that the viewer has seen this session's result. */
export function revealSession(sessionKey: string): void {
	const revealed = revealedStore.get();

	if (revealed.at(-1) !== sessionKey) {
		revealedStore.set(withRevealed(revealed, sessionKey));
	}
}

/** Which events the replay's event keys step through. */
export const eventFilterStore = createLocalStore(
	'pitwall-event-filter',
	z.enum(EVENT_FILTERS),
	'all'
);

/** Delay steps of a tenth, without the float drift of adding 0.1 repeatedly. */
export function stepDelay(seconds: number, step: number): number {
	return Math.min(Math.max(Math.round((seconds + step) * 10) / 10, 0), MAX_DELAY_SECONDS);
}
