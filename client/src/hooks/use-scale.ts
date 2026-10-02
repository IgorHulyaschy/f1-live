import * as React from 'react';

const STORAGE_KEY = 'pitwall-scale';

/** Text and spacing size. Everything is sized in rem, so this scales the whole console. */
export const SCALES = [
	{ value: 's', label: 'S', factor: 0.875 },
	{ value: 'm', label: 'M', factor: 1 },
	{ value: 'l', label: 'L', factor: 1.125 },
	{ value: 'xl', label: 'XL', factor: 1.25 },
	{ value: 'tv', label: 'TV', factor: 1.5 }
] as const;

export type Scale = (typeof SCALES)[number]['value'];

const listeners = new Set<() => void>();

let current: Scale = 'm';

function apply(scale: Scale): void {
	const factor = SCALES.find((entry) => entry.value === scale)?.factor ?? 1;

	current = scale;
	document.documentElement.style.fontSize = factor === 1 ? '' : `${factor * 100}%`;

	for (const listener of listeners) {
		listener();
	}
}

/** Restores the viewer's saved size before first paint. */
export function restoreScale(): void {
	try {
		const saved = SCALES.find((entry) => entry.value === window.localStorage.getItem(STORAGE_KEY));

		if (saved) {
			apply(saved.value);
		}
	} catch {
		// Storage can be unavailable; the default size stands.
	}
}

export function setScale(scale: Scale): void {
	apply(scale);

	try {
		window.localStorage.setItem(STORAGE_KEY, scale);
	} catch {
		// Not persisting is fine: the size still applies to this visit.
	}
}

function subscribe(onChange: () => void): () => void {
	listeners.add(onChange);

	return () => listeners.delete(onChange);
}

export function useScale(): Scale {
	return React.useSyncExternalStore(
		subscribe,
		() => current,
		() => 'm'
	);
}

/** Pixels in one rem at the current size. */
export function useRemPixels(): number {
	const scale = useScale();

	return 16 * (SCALES.find((entry) => entry.value === scale)?.factor ?? 1);
}
