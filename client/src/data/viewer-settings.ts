import * as React from 'react';
import { z } from 'zod';

import { EVENT_FILTERS } from '../insights/timeline.ts';
import { createLocalStore } from '../lib/local-store.ts';
import { MAX_DELAY_SECONDS } from './broadcast-delay.ts';
import { mergeRevealed, type ViewerSettings, viewerSettingsSchema } from '@f1-live/shared/viewer';

import { isRevealed, type SpoilerSettings, withRevealed } from './spoilers.ts';

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

/** When the viewer last turned protection on or off, so the newer change wins across devices. */
const protectionChangedStore = createLocalStore(
	'pitwall-spoiler-changed',
	z.iso.datetime().nullable(),
	null
);

export function setSpoilerProtection(protect: boolean): void {
	spoilerProtectionStore.set(protect);
	protectionChangedStore.set(new Date().toISOString());
}

/** Sessions whose results the viewer has seen, newest last. */
export const revealedStore = createLocalStore(
	'pitwall-revealed',
	viewerSettingsSchema.shape.revealed,
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

/** The spoiler settings on this device, as the account keeps them. */
export function readViewerSettings(): ViewerSettings {
	const protect = spoilerProtectionStore.get();

	// Turned off before changes were dated: date it now, or the account's default would win.
	if (!protect && protectionChangedStore.get() === null) {
		protectionChangedStore.set(new Date().toISOString());
	}

	return {
		protect,
		protectUpdatedAt: protectionChangedStore.get(),
		revealed: revealedStore.get()
	};
}

/**
 * Takes in the account's settings: every session revealed anywhere, and protection as last
 * changed. Reveals made here while the account answered are kept.
 */
export function adoptViewerSettings(account: ViewerSettings): void {
	const revealed = revealedStore.get();
	const merged = mergeRevealed(revealed, account.revealed);

	if (merged.join() !== revealed.join()) {
		revealedStore.set(merged);
	}

	if ((account.protectUpdatedAt ?? '') > (protectionChangedStore.get() ?? '')) {
		spoilerProtectionStore.set(account.protect);
		protectionChangedStore.set(account.protectUpdatedAt);
	}
}
