import { dashboardSchema } from '@f1-live/shared/dashboard';
import {
	LIBRARY_PAGE_SIZE,
	type LibraryEntry,
	type LibrarySort,
	type PublishBody,
	type ReportReason
} from '@f1-live/shared/library';
import { SEED_EXAMPLES } from '@f1-live/shared/library-examples';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';

import type { AccountsDatabase } from '../db/database.js';
import { libraryAdd, libraryEntry, libraryHandle, libraryReport } from '../db/schema.js';
import { checkHandle, hasBlockedWord, type Policy } from './moderation.js';

export type LibraryPolicy = Policy & { reportsToHide: number; maxPublished: number };

type Row = typeof libraryEntry.$inferSelect;

function toEntry(row: Row, handle: string | null, viewerId: string | null): LibraryEntry {
	return {
		id: row.id,
		author: handle,
		description: row.description,
		tags: row.tags,
		adds: row.adds,
		publishedAt: row.publishedAt.toISOString(),
		mine: viewerId !== null && row.userId === viewerId,
		hidden: row.hidden,
		dashboard: row.document
	};
}

const withHandle = (db: AccountsDatabase) =>
	db
		.select({ entry: libraryEntry, handle: libraryHandle.handle })
		.from(libraryEntry)
		.leftJoin(libraryHandle, eq(libraryHandle.userId, libraryEntry.userId));

/** Puts the examples in on every start; ones already there keep their counts. */
export async function ensureExamples(db: AccountsDatabase): Promise<void> {
	await db
		.insert(libraryEntry)
		.values(
			SEED_EXAMPLES.map((example) => ({
				id: `example-${example.id}`,
				userId: null,
				dashboardId: example.id,
				name: example.name,
				description: example.description,
				tags: [...example.tags],
				document: dashboardSchema.parse(example.dashboard)
			}))
		)
		.onConflictDoNothing();
}

export async function handleOf(db: AccountsDatabase, userId: string): Promise<string | null> {
	const [row] = await db
		.select({ handle: libraryHandle.handle })
		.from(libraryHandle)
		.where(eq(libraryHandle.userId, userId));

	return row?.handle ?? null;
}

export type ClaimOutcome =
	| { kind: 'claimed'; handle: string }
	| { kind: 'rejected'; reason: 'format' | 'reserved' | 'profanity' }
	| { kind: 'taken' }
	/** A handle is chosen once, so a published name never changes under what fans see. */
	| { kind: 'already-set'; handle: string };

export async function claimHandle(
	db: AccountsDatabase,
	userId: string,
	raw: string,
	policy: Policy
): Promise<ClaimOutcome> {
	const existing = await handleOf(db, userId);

	if (existing) {
		return { kind: 'already-set', handle: existing };
	}

	const checked = checkHandle(raw, policy);

	if (!checked.ok) {
		return { kind: 'rejected', reason: checked.reason };
	}

	const inserted = await db
		.insert(libraryHandle)
		.values({ userId, handle: checked.handle })
		.onConflictDoNothing()
		.returning({ handle: libraryHandle.handle });

	return inserted.length > 0 ? { kind: 'claimed', handle: checked.handle } : { kind: 'taken' };
}

/** Whether a handle could be taken now, for the form to say so while it is typed. */
export async function handleAvailability(
	db: AccountsDatabase,
	raw: string,
	policy: Policy
): Promise<'available' | 'taken' | 'format' | 'reserved' | 'profanity'> {
	const checked = checkHandle(raw, policy);

	if (!checked.ok) {
		return checked.reason;
	}

	const [row] = await db
		.select({ userId: libraryHandle.userId })
		.from(libraryHandle)
		.where(eq(libraryHandle.handle, checked.handle));

	return row ? 'taken' : 'available';
}

export type ListQuery = { q: string; tag: string; sort: LibrarySort; page: number };

/** Characters that mean something to LIKE are searched for as themselves. */
function escapeLike(text: string): string {
	return text.replaceAll(/[\\%_]/g, (char) => `\\${char}`);
}

export async function listEntries(
	db: AccountsDatabase,
	query: ListQuery,
	viewerId: string | null
): Promise<{ entries: LibraryEntry[]; hasMore: boolean }> {
	const term = `%${escapeLike(query.q.trim())}%`;

	const search = query.q.trim()
		? or(
				ilike(libraryEntry.name, term),
				ilike(libraryEntry.description, term),
				ilike(libraryHandle.handle, term),
				sql`exists (select 1 from jsonb_array_elements_text(${libraryEntry.tags}) as tag where tag ilike ${term})`
			)
		: undefined;

	const tag = query.tag.trim()
		? sql`exists (select 1 from jsonb_array_elements_text(${libraryEntry.tags}) as tag where lower(tag) = ${query.tag.trim().toLowerCase()})`
		: undefined;

	const rows = await withHandle(db)
		.where(and(eq(libraryEntry.hidden, false), search, tag))
		.orderBy(
			...(query.sort === 'popular'
				? [desc(libraryEntry.adds), desc(libraryEntry.publishedAt)]
				: [desc(libraryEntry.publishedAt)]),
			libraryEntry.id
		)
		.limit(LIBRARY_PAGE_SIZE + 1)
		.offset(query.page * LIBRARY_PAGE_SIZE);

	return {
		entries: rows
			.slice(0, LIBRARY_PAGE_SIZE)
			.map(({ entry, handle }) => toEntry(entry, handle, viewerId)),
		hasMore: rows.length > LIBRARY_PAGE_SIZE
	};
}

/** Every tag in use, most used first, for the filter. */
export async function listTags(db: AccountsDatabase): Promise<string[]> {
	const tag = sql<string>`lower(tag)`;
	const uses = sql<number>`count(*)::int`;

	const rows = await db
		.select({ tag, uses })
		.from(sql`${libraryEntry}, jsonb_array_elements_text(${libraryEntry.tags}) as tag`)
		.where(eq(libraryEntry.hidden, false))
		.groupBy(tag)
		.orderBy(desc(uses), tag)
		.limit(30);

	return rows.map((row) => row.tag);
}

/** One entry. A hidden one shows to its author only. */
export async function getEntry(
	db: AccountsDatabase,
	id: string,
	viewerId: string | null
): Promise<LibraryEntry | null> {
	const [row] = await withHandle(db).where(eq(libraryEntry.id, id));

	if (!row || (row.entry.hidden && row.entry.userId !== viewerId)) {
		return null;
	}

	return toEntry(row.entry, row.handle, viewerId);
}

/** What this viewer has published, hidden ones too. */
export async function listMine(db: AccountsDatabase, userId: string): Promise<LibraryEntry[]> {
	const rows = await withHandle(db)
		.where(eq(libraryEntry.userId, userId))
		.orderBy(desc(libraryEntry.publishedAt));

	return rows.map(({ entry, handle }) => toEntry(entry, handle, userId));
}

export type PublishOutcome =
	| { kind: 'published'; entry: LibraryEntry; created: boolean }
	| { kind: 'needs-handle' }
	| { kind: 'rejected'; field: 'name' | 'description' | 'tags' }
	| { kind: 'too-many'; limit: number };

/**
 * Publishes a copy of the author's dashboard, or replaces the copy they published of it before.
 * The plan check is the caller's: this only needs the author to have a handle and clean text.
 */
export async function publish(
	db: AccountsDatabase,
	userId: string,
	body: PublishBody,
	policy: LibraryPolicy
): Promise<PublishOutcome> {
	const handle = await handleOf(db, userId);

	if (!handle) {
		return { kind: 'needs-handle' };
	}

	if (hasBlockedWord(body.dashboard.name, policy)) {
		return { kind: 'rejected', field: 'name' };
	}

	if (hasBlockedWord(body.description, policy)) {
		return { kind: 'rejected', field: 'description' };
	}

	if (body.tags.some((tag) => hasBlockedWord(tag, policy))) {
		return { kind: 'rejected', field: 'tags' };
	}

	const save = () =>
		db.transaction(async (tx) => {
			const own = await tx.select().from(libraryEntry).where(eq(libraryEntry.userId, userId));
			const existing = own.find((row) => row.dashboardId === body.dashboard.id);

			if (!existing && own.length >= policy.maxPublished) {
				return { kind: 'too-many', limit: policy.maxPublished } as const;
			}

			const fields = {
				name: body.dashboard.name,
				description: body.description,
				tags: [...new Set(body.tags)],
				document: body.dashboard
			};

			if (existing) {
				const [row] = await tx
					.update(libraryEntry)
					.set(fields)
					.where(eq(libraryEntry.id, existing.id))
					.returning();

				return {
					kind: 'published',
					entry: toEntry(row ?? existing, handle, userId),
					created: false
				} as const;
			}

			const [row] = await tx
				.insert(libraryEntry)
				.values({
					id: `fan-${randomBytes(6).toString('base64url')}`,
					userId,
					dashboardId: body.dashboard.id,
					...fields
				})
				.returning();

			if (!row) {
				throw new Error('The library entry was not saved');
			}

			return { kind: 'published', entry: toEntry(row, handle, userId), created: true } as const;
		});

	try {
		return await save();
	} catch (cause) {
		// Two publishes of one dashboard at once: the second finds the first and updates it.
		if (cause instanceof Error && isUniqueViolation(cause)) {
			return save();
		}

		throw cause;
	}
}

const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: Error): boolean {
	return [error, error.cause].some(
		(candidate) =>
			candidate instanceof Error && 'code' in candidate && candidate.code === UNIQUE_VIOLATION
	);
}

/** Takes the author's own entry out; false when there is none by that id. */
export async function unpublish(
	db: AccountsDatabase,
	userId: string,
	id: string
): Promise<boolean> {
	const removed = await db
		.delete(libraryEntry)
		.where(and(eq(libraryEntry.id, id), eq(libraryEntry.userId, userId)))
		.returning({ id: libraryEntry.id });

	return removed.length > 0;
}

/** Counts a viewer's add once, and never the author's own; null when there is no such entry. */
export async function recordAdd(
	db: AccountsDatabase,
	userId: string,
	id: string
): Promise<number | null> {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select({ adds: libraryEntry.adds, author: libraryEntry.userId, hidden: libraryEntry.hidden })
			.from(libraryEntry)
			.where(eq(libraryEntry.id, id));

		if (!row || row.hidden) {
			return null;
		}

		if (row.author === userId) {
			return row.adds;
		}

		const added = await tx
			.insert(libraryAdd)
			.values({ entryId: id, userId })
			.onConflictDoNothing()
			.returning({ entryId: libraryAdd.entryId });

		if (added.length === 0) {
			return row.adds;
		}

		const [updated] = await tx
			.update(libraryEntry)
			.set({ adds: sql`${libraryEntry.adds} + 1` })
			.where(eq(libraryEntry.id, id))
			.returning({ adds: libraryEntry.adds });

		return updated?.adds ?? row.adds;
	});
}

export type ReportOutcome =
	| { kind: 'reported'; hidden: boolean }
	| { kind: 'not-found' }
	| { kind: 'own' }
	| { kind: 'already' };

/** One report per viewer; enough different viewers hide the entry until someone looks. */
export async function report(
	db: AccountsDatabase,
	userId: string,
	id: string,
	reason: ReportReason,
	policy: LibraryPolicy
): Promise<ReportOutcome> {
	return db.transaction(async (tx) => {
		const [entry] = await tx
			.select({ author: libraryEntry.userId, hidden: libraryEntry.hidden })
			.from(libraryEntry)
			.where(eq(libraryEntry.id, id));

		if (!entry) {
			return { kind: 'not-found' } as const;
		}

		if (entry.author === userId) {
			return { kind: 'own' } as const;
		}

		const inserted = await tx
			.insert(libraryReport)
			.values({ entryId: id, userId, reason })
			.onConflictDoNothing()
			.returning({ entryId: libraryReport.entryId });

		if (inserted.length === 0) {
			return { kind: 'already' } as const;
		}

		const [{ reports } = { reports: 0 }] = await tx
			.select({ reports: count() })
			.from(libraryReport)
			.where(eq(libraryReport.entryId, id));

		// The examples are the library's own: reports are kept, but fans cannot hold them back.
		const hidden = entry.hidden || (entry.author !== null && reports >= policy.reportsToHide);

		if (hidden && !entry.hidden) {
			await tx.update(libraryEntry).set({ hidden: true }).where(eq(libraryEntry.id, id));
		}

		return { kind: 'reported', hidden } as const;
	});
}
