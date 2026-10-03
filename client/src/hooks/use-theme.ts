import * as React from 'react';

import { THEME_COLOURS } from '@/platform/site';

const STORAGE_KEY = 'pitwall-theme';

function isDark(): boolean {
	return document.documentElement.classList.contains('dark');
}

function subscribe(onChange: () => void): () => void {
	const observer = new MutationObserver(onChange);

	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

	return () => observer.disconnect();
}

/** The class drives the page; the meta tag tints the browser's toolbar and an installed app's bar. */
function applyTheme(dark: boolean): void {
	document.documentElement.classList.toggle('dark', dark);
	document.head
		.querySelector('meta[name="theme-color"]')
		?.setAttribute('content', dark ? THEME_COLOURS.dark : THEME_COLOURS.light);
}

/** Restores the viewer's saved theme before first paint; dark is the default. */
export function restoreTheme(): void {
	try {
		const saved = window.localStorage.getItem(STORAGE_KEY);

		if (saved === 'light' || saved === 'dark') {
			applyTheme(saved === 'dark');
		}
	} catch {
		// Storage can be unavailable (private mode); the default theme stands.
	}
}

export function toggleTheme(): void {
	const next = !isDark();

	applyTheme(next);

	try {
		window.localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
	} catch {
		// Not persisting is fine: the toggle still applies to this visit.
	}
}

/** The theme lives on <html class="dark">, so header, palette and charts stay in sync. */
export function useDarkTheme(): boolean {
	return React.useSyncExternalStore(subscribe, isDark);
}
