import { dashboardSchema } from '@f1-live/shared/dashboard';
import { type LibraryEntry, type LibrarySort, type ReportReason } from '@f1-live/shared/library';
import { z } from 'zod';

import { AccountsError, json, send } from '../account/api';

const entrySchema = z.object({
	id: z.string(),
	author: z.string().nullable(),
	description: z.string(),
	tags: z.array(z.string()),
	adds: z.int().min(0),
	publishedAt: z.iso.datetime(),
	mine: z.boolean(),
	hidden: z.boolean(),
	dashboard: dashboardSchema
}) satisfies z.ZodType<LibraryEntry>;

const listingSchema = z.object({
	entries: z.array(entrySchema),
	hasMore: z.boolean(),
	tags: z.array(z.string())
});

export type LibraryListing = z.infer<typeof listingSchema>;

export type LibraryQuery = { q: string; tag: string; sort: LibrarySort; page: number };

/** The page of the library that matches a search, a tag and an order; page 0 also lists the tags. */
export async function fetchLibrary(query: LibraryQuery): Promise<LibraryListing> {
	const params = new URLSearchParams({ sort: query.sort, page: String(query.page) });

	// A handle is written with its @; the server matches the name.
	const term = query.q.trim().replace(/^@/, '');

	if (term) {
		params.set('q', term);
	}

	if (query.tag) {
		params.set('tag', query.tag);
	}

	return json(await send('GET', `/api/library?${params}`), listingSchema);
}

/** One entry, or null when there is none (or it was held back). */
export async function fetchLibraryEntry(id: string): Promise<LibraryEntry | null> {
	try {
		return (
			await json(
				await send('GET', `/api/library/${encodeURIComponent(id)}`),
				z.object({ entry: entrySchema })
			)
		).entry;
	} catch (cause) {
		if (cause instanceof AccountsError && cause.code === 'not_found') {
			return null;
		}

		throw cause;
	}
}

/** What the signed-in viewer published, held-back entries included. */
export async function fetchMyLibrary(): Promise<LibraryEntry[]> {
	return (
		await json(await send('GET', '/api/me/library'), z.object({ entries: z.array(entrySchema) }))
	).entries;
}

export async function publishToLibrary(body: {
	dashboard: LibraryEntry['dashboard'];
	description: string;
	tags: readonly string[];
}): Promise<LibraryEntry> {
	return (
		await json(
			await send('POST', '/api/library', JSON.stringify(body)),
			z.object({ entry: entrySchema })
		)
	).entry;
}

export async function unpublishFromLibrary(id: string): Promise<void> {
	await json(
		await send('DELETE', `/api/library/${encodeURIComponent(id)}`),
		z.object({ removed: z.boolean() })
	);
}

/** Tells the library a signed-in viewer added a copy, so the count goes up. */
export async function countLibraryAdd(id: string): Promise<number> {
	return (
		await json(
			await send('POST', `/api/library/${encodeURIComponent(id)}/add`),
			z.object({ adds: z.int() })
		)
	).adds;
}

export async function reportLibraryEntry(id: string, reason: ReportReason): Promise<void> {
	await json(
		await send('POST', `/api/library/${encodeURIComponent(id)}/report`, JSON.stringify({ reason })),
		z.object({ reported: z.boolean() })
	);
}

export type HandleCheck = 'available' | 'taken' | 'format' | 'reserved' | 'profanity';

export async function checkHandle(handle: string): Promise<HandleCheck> {
	return (
		await json(
			await send('GET', `/api/me/handle/check?handle=${encodeURIComponent(handle)}`),
			z.object({ result: z.enum(['available', 'taken', 'format', 'reserved', 'profanity']) })
		)
	).result;
}

export async function claimHandle(handle: string): Promise<string> {
	return (
		await json(
			await send('PUT', '/api/me/handle', JSON.stringify({ handle })),
			z.object({ handle: z.string() })
		)
	).handle;
}
