import { z } from 'zod';

import { type Dashboard, dashboardSchema } from './dashboard.ts';

/** A handle is how a fan signs what they publish: lower case, starts with a letter, 3 to 20 long. */
export const HANDLE_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;

export const DESCRIPTION_MAX = 200;

export const TAGS_MAX = 4;

export const TAG_MAX = 16;

/** Why a fan reports a library dashboard; the server counts reporters, not reasons. */
export const REPORT_REASONS = ['spam', 'offensive', 'copyright', 'other'] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/** A handle as typed: surrounding space and case do not matter. */
export function normalizeHandle(raw: string): string {
	return raw.trim().replace(/^@/, '').toLowerCase();
}

export const handleSchema = z
	.string()
	.transform(normalizeHandle)
	.pipe(z.string().regex(HANDLE_PATTERN));

const tagSchema = z
	.string()
	.trim()
	.min(1)
	.max(TAG_MAX)
	.regex(/^[\p{L}\p{N} -]+$/u, 'letters, numbers, spaces and hyphens only');

/** What publishing sends: the dashboard as it is now, and how to describe it. */
export const publishBodySchema = z.object({
	dashboard: dashboardSchema,
	description: z.string().trim().max(DESCRIPTION_MAX),
	tags: z.array(tagSchema).max(TAGS_MAX)
});

export type PublishBody = z.infer<typeof publishBodySchema>;

/** One library dashboard as the API lists it. */
export type LibraryEntry = {
	id: string;
	/** Who published it; null for an example the library ships with. */
	author: string | null;
	description: string;
	tags: readonly string[];
	/** How many signed-in viewers added a copy. */
	adds: number;
	publishedAt: string;
	/** Published by the viewer asking. */
	mine: boolean;
	/** Reported by enough viewers and held back until someone looks; only its author sees it. */
	hidden: boolean;
	dashboard: Dashboard;
};

export const LIBRARY_SORTS = ['popular', 'new'] as const;

export type LibrarySort = (typeof LIBRARY_SORTS)[number];

/** Entries per page of the listing. */
export const LIBRARY_PAGE_SIZE = 24;
