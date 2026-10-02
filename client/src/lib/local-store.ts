import * as React from 'react';
import type { z } from 'zod';

/**
 * A small value kept in localStorage and shared live between components and open windows.
 * Anything that does not parse reads as the fallback, so a stale or hand-edited entry is harmless.
 */
export function createLocalStore<Value>(key: string, schema: z.ZodType<Value>, fallback: Value) {
	const listeners = new Set<() => void>();
	let cache: { raw: string | null; value: Value } | null = null;
	// Set when storage refused a write: the value then lives in memory until the page closes.
	let memoryOnly = false;

	function readRaw(): string | null {
		try {
			return window.localStorage.getItem(key);
		} catch {
			return null;
		}
	}

	function get(): Value {
		if (memoryOnly && cache) {
			return cache.value;
		}

		const raw = readRaw();

		if (cache && cache.raw === raw) {
			return cache.value;
		}

		let value = fallback;

		if (raw !== null) {
			try {
				const parsed = schema.safeParse(JSON.parse(raw));

				value = parsed.success ? parsed.data : fallback;
			} catch {
				value = fallback;
			}
		}

		cache = { raw, value };

		return value;
	}

	function set(value: Value): void {
		const raw = JSON.stringify(value);

		cache = { raw, value };

		try {
			window.localStorage.setItem(key, raw);
			memoryOnly = false;
		} catch {
			memoryOnly = true;
		}

		for (const listener of listeners) {
			listener();
		}
	}

	function subscribe(onChange: () => void): () => void {
		const onStorage = (event: StorageEvent) => {
			if (event.key === key) {
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

	function useValue(): Value {
		return React.useSyncExternalStore(subscribe, get, () => fallback);
	}

	return { get, set, useValue };
}
