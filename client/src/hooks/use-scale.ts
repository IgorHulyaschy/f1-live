import * as React from 'react';

import { screenFactor } from '@/lib/screen-factor';

const STORAGE_KEY = 'pitwall-larger-text';

/** The S to TV size switch this replaces; its larger sizes carry over as Larger text. */
const OLD_SCALE_KEY = 'pitwall-scale';

/**
 * Larger text on top of the screen's own size. A TV across the room reports the same window as
 * a monitor at arm's length, so only the viewer can say they sit far away.
 */
const LARGER_TEXT = 1.25;

const listeners = new Set<() => void>();

let larger = false;

let factor = 1;

/** Everything is sized in rem, so the root font size scales the whole console. */
function apply(): void {
	const next = screenFactor(window.innerWidth, window.innerHeight) * (larger ? LARGER_TEXT : 1);

	if (next !== factor) {
		factor = next;
		document.documentElement.style.fontSize = factor === 1 ? '' : `${factor * 100}%`;
		notify();
	}
}

function notify(): void {
	for (const listener of listeners) {
		listener();
	}
}

function readLarger(): boolean {
	const saved = window.localStorage.getItem(STORAGE_KEY);

	if (saved !== null) {
		return saved === 'true';
	}

	const old = window.localStorage.getItem(OLD_SCALE_KEY);

	if (old === null) {
		return false;
	}

	const migrated = old === 'l' || old === 'xl' || old === 'tv';

	window.localStorage.setItem(STORAGE_KEY, String(migrated));
	window.localStorage.removeItem(OLD_SCALE_KEY);

	return migrated;
}

/** Sizes the console for this screen before first paint, and again whenever the window changes. */
export function restoreScale(): void {
	try {
		larger = readLarger();
	} catch {
		// Storage can be unavailable; the screen's own size stands.
	}

	apply();
	window.addEventListener('resize', apply);
}

export function setLargerText(next: boolean): void {
	larger = next;
	apply();
	notify();

	try {
		window.localStorage.setItem(STORAGE_KEY, String(next));
	} catch {
		// Not persisting is fine: the size still applies to this visit.
	}
}

function subscribe(onChange: () => void): () => void {
	listeners.add(onChange);

	return () => listeners.delete(onChange);
}

export function useLargerText(): boolean {
	return React.useSyncExternalStore(
		subscribe,
		() => larger,
		() => false
	);
}

/** Pixels in one rem at the current size. */
export function useRemPixels(): number {
	return (
		16 *
		React.useSyncExternalStore(
			subscribe,
			() => factor,
			() => 1
		)
	);
}
