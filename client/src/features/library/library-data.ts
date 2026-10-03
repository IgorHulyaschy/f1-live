import { z } from 'zod';

import { createLocalStore } from '@/lib/local-store';

import { type Dashboard, parseDashboardText } from '../dashboard/dashboards';
import type { Account, LibraryEntry } from './community';

/**
 * How a published dashboard is signed. The library is still mocked in this browser; the account
 * gives no public handle yet, so the author is the account's name or an anonymous fan tag, never
 * its email.
 */
export function libraryAuthor(user: { id: string; name: string }): Account {
	const handle =
		user.name
			.toLowerCase()
			.replaceAll(/[^a-z0-9]+/g, '-')
			.replaceAll(/^-|-$/g, '') || `fan-${user.id.slice(0, 6).toLowerCase()}`;

	return { name: user.name || handle, handle };
}

const publishedSchema = z.array(
	z.object({
		id: z.string(),
		author: z.string(),
		description: z.string(),
		tags: z.array(z.string()),
		adds: z.number(),
		// Stored dashboards go back through the same lenient parser as imported files.
		dashboard: z.json().transform((value, context) => {
			const dashboard = parseDashboardText(JSON.stringify(value));

			if (!dashboard) {
				context.addIssue({ code: 'custom', message: 'Not a dashboard' });

				return z.NEVER;
			}

			return dashboard;
		})
	})
);

const NOTHING_PUBLISHED: readonly LibraryEntry[] = [];

/** Dashboards this viewer published, kept in the browser as the server would keep them. */
const publishedStore = createLocalStore<readonly LibraryEntry[]>(
	'pitwall-published',
	publishedSchema,
	NOTHING_PUBLISHED
);

export const usePublished = publishedStore.useValue;

export function publishDashboard(dashboard: Dashboard, account: Account): LibraryEntry {
	const entry: LibraryEntry = {
		id: `${account.handle}-${dashboard.id}`,
		author: account.handle,
		description: `${dashboard.tiles.length} tiles.`,
		tags: ['Yours'],
		adds: 0,
		dashboard
	};

	publishedStore.set([
		entry,
		...publishedStore.get().filter((published) => published.id !== entry.id)
	]);

	return entry;
}

export function unpublishDashboard(entryId: string): void {
	publishedStore.set(publishedStore.get().filter((entry) => entry.id !== entryId));
}
