import { z } from 'zod';

import { createLocalStore } from '@/lib/local-store';

import { type Dashboard, parseDashboardText } from '../dashboard/dashboards';
import type { Account, LibraryEntry } from './community';

const accountSchema = z.object({ name: z.string(), handle: z.string() }).nullable();

/** Signed-in viewer. Mocked: signing in only stores a demo account in this browser. */
export const accountStore = createLocalStore<Account | null>(
	'pitwall-account',
	accountSchema,
	null
);

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
