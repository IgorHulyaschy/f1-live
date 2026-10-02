import * as React from 'react';

import { type Dashboard, isPreset, parseDashboardListText, PRESETS } from './dashboards.ts';

const STORAGE_KEY = 'pitwall-dashboards';

/** Saved dashboards: edited presets under their preset id, and the viewer's own. */
type Saved = readonly Dashboard[];

const listeners = new Set<() => void>();

let cache: { raw: string | null; saved: Saved } | null = null;

function readRaw(): string | null {
	try {
		return window.localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}

function readSaved(): Saved {
	const raw = readRaw();

	if (cache && cache.raw === raw) {
		return cache.saved;
	}

	const saved: Saved = raw ? parseDashboardListText(raw) : [];

	cache = { raw, saved };

	return saved;
}

function writeSaved(saved: Saved): void {
	const raw = JSON.stringify(saved);

	cache = { raw, saved };

	try {
		window.localStorage.setItem(STORAGE_KEY, raw);
	} catch {
		// Storage can be full or blocked; the change still applies until the page closes.
	}

	for (const listener of listeners) {
		listener();
	}
}

function subscribe(onChange: () => void): () => void {
	// Another window saving a dashboard fires `storage` here, so every open window stays current.
	const onStorage = (event: StorageEvent) => {
		if (event.key === STORAGE_KEY) {
			onChange();
		}
	};

	listeners.add(onChange);
	window.addEventListener('storage', onStorage);

	return () => {
		listeners.delete(onChange);
		window.removeEventListener('storage', onStorage);
	};
}

/** Presets (with any saved edits) first, then the viewer's own dashboards in creation order. */
function merge(saved: Saved): Dashboard[] {
	const byId = new Map(saved.map((dashboard) => [dashboard.id, dashboard]));
	const presets = PRESETS.map((dashboard) => byId.get(dashboard.id) ?? dashboard);

	return [...presets, ...saved.filter((dashboard) => !isPreset(dashboard.id))];
}

const NOTHING_SAVED: Saved = [];

/** All dashboards, plus the ids that have been saved (so a preset knows it was edited). */
export function useDashboards(): { dashboards: Dashboard[]; saved: ReadonlySet<string> } {
	const saved = React.useSyncExternalStore(subscribe, readSaved, () => NOTHING_SAVED);

	return React.useMemo(
		() => ({ dashboards: merge(saved), saved: new Set(saved.map((entry) => entry.id)) }),
		[saved]
	);
}

export function saveDashboard(dashboard: Dashboard): void {
	const saved = readSaved();
	const exists = saved.some((entry) => entry.id === dashboard.id);

	writeSaved(
		exists
			? saved.map((entry) => (entry.id === dashboard.id ? dashboard : entry))
			: [...saved, dashboard]
	);
}

/** Deletes one of the viewer's dashboards, or puts a preset back to how it shipped. */
export function forgetDashboard(id: string): void {
	writeSaved(readSaved().filter((entry) => entry.id !== id));
}

export function newId(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
