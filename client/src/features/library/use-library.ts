import type { LibraryEntry } from '@f1-live/shared/library';
import * as React from 'react';

import { useAccount } from '../account/account-store';
import { type LibraryQuery, fetchLibrary, fetchLibraryEntry, fetchMyLibrary } from './library-api';

/** `unavailable`: no accounts server answered, so there is no fan library here. */
export type LibraryStatus = 'loading' | 'ready' | 'unavailable';

type Listing = {
	status: LibraryStatus;
	entries: readonly LibraryEntry[];
	hasMore: boolean;
	tags: readonly string[];
	loadingMore: boolean;
};

const EMPTY: Listing = {
	status: 'loading',
	entries: [],
	hasMore: false,
	tags: [],
	loadingMore: false
};

/** The value after it has stood still for `ms`: a search box asks the server once the typing stops. */
export function useDebounced<Value>(value: Value, ms: number): Value {
	const [settled, setSettled] = React.useState(value);

	React.useEffect(() => {
		const timer = window.setTimeout(() => setSettled(value), ms);

		return () => window.clearTimeout(timer);
	}, [value, ms]);

	return settled;
}

/** The fan library for a search, a tag and an order; `loadMore` appends the next page. */
export function useLibraryListing(query: Omit<LibraryQuery, 'page'>) {
	const { q, tag, sort } = query;
	const key = JSON.stringify([q, tag, sort]);
	const [settled, setSettled] = React.useState<{ key: string; listing: Listing } | null>(null);
	const page = React.useRef(0);

	React.useEffect(() => {
		let current = true;

		page.current = 0;

		void (async () => {
			try {
				const result = await fetchLibrary({ q, tag, sort, page: 0 });

				if (current) {
					setSettled({ key, listing: { status: 'ready', ...result, loadingMore: false } });
				}
			} catch {
				if (current) {
					setSettled({ key, listing: { ...EMPTY, status: 'unavailable' } });
				}
			}
		})();

		return () => {
			current = false;
		};
	}, [key, q, tag, sort]);

	const loadMore = React.useCallback(() => {
		page.current += 1;
		setSettled((previous) =>
			previous ? { ...previous, listing: { ...previous.listing, loadingMore: true } } : previous
		);

		void (async () => {
			try {
				const result = await fetchLibrary({ q, tag, sort, page: page.current });

				setSettled((previous) =>
					previous
						? {
								...previous,
								listing: {
									...previous.listing,
									entries: [
										...previous.listing.entries,
										...result.entries.filter(
											(entry) => !previous.listing.entries.some((seen) => seen.id === entry.id)
										)
									],
									hasMore: result.hasMore,
									loadingMore: false
								}
							}
						: previous
				);
			} catch {
				setSettled((previous) =>
					previous
						? { ...previous, listing: { ...previous.listing, loadingMore: false } }
						: previous
				);
			}
		})();
	}, [q, tag, sort]);

	// What was shown for the last search stays up while the next one loads.
	const listing: Listing = settled
		? { ...settled.listing, status: settled.key === key ? settled.listing.status : 'loading' }
		: EMPTY;

	return { ...listing, loadMore };
}

async function loadMine(signedIn: boolean): Promise<readonly LibraryEntry[]> {
	return signedIn ? await fetchMyLibrary().catch(() => []) : [];
}

/** What the signed-in viewer published; `refresh` after publishing or unpublishing. */
export function useMyLibrary() {
	const account = useAccount();
	const signedIn = account.status === 'signed-in';
	const [mine, setMine] = React.useState<readonly LibraryEntry[]>([]);

	React.useEffect(() => {
		let current = true;

		void (async () => {
			const loaded = await loadMine(signedIn);

			if (current) {
				setMine(loaded);
			}
		})();

		return () => {
			current = false;
		};
	}, [signedIn]);

	const refresh = React.useCallback(async () => setMine(await loadMine(signedIn)), [signedIn]);

	return { mine, refresh };
}

const known = new Map<string, Promise<LibraryEntry | null>>();

/** One library entry by id, fetched once for the preview page and the page title alike. */
export function useLibraryEntry(id: string | null): {
	status: LibraryStatus;
	entry: LibraryEntry | null;
} {
	const [loaded, setLoaded] = React.useState<{
		id: string;
		status: LibraryStatus;
		entry: LibraryEntry | null;
	} | null>(null);

	React.useEffect(() => {
		if (!id) {
			return;
		}

		let current = true;
		const request = known.get(id) ?? fetchLibraryEntry(id);

		if (!known.has(id)) {
			// Short-lived: a dashboard republished or held back should not look the same for long.
			window.setTimeout(() => known.delete(id), 30_000);
		}

		known.set(id, request);

		void (async () => {
			try {
				const entry = await request;

				if (current) {
					setLoaded({ id, status: 'ready', entry });
				}
			} catch {
				known.delete(id);

				if (current) {
					setLoaded({ id, status: 'unavailable', entry: null });
				}
			}
		})();

		return () => {
			current = false;
		};
	}, [id]);

	return !id || loaded?.id !== id ? { status: 'loading', entry: null } : loaded;
}
