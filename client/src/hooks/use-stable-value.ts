import * as React from 'react';

/**
 * `value`, or the one kept from an earlier render while `same` says nothing that matters
 * changed: consumers that compare by identity then skip the update.
 */
export function useStableValue<T>(value: T, same: (kept: T, next: T) => boolean): T {
	const [kept, setKept] = React.useState(value);
	const unchanged = kept === value || same(kept, value);

	if (!unchanged) {
		setKept(value);
	}

	return unchanged ? kept : value;
}

/** Arrays with the same items in the same order. */
export function sameItems<T>(kept: readonly T[], next: readonly T[]): boolean {
	return kept.length === next.length && kept.every((item, index) => item === next[index]);
}
