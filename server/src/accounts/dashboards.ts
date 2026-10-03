import { type Dashboard, PRESET_IDS, sameDashboard } from '@f1-live/shared/dashboard';
import { canAddOwnDashboard, type Entitlements } from '@f1-live/shared/plans';
import { and, count, eq, isNotNull, isNull, lt, notInArray } from 'drizzle-orm';

import type { AccountsDatabase } from './db/database.js';
import { dashboard, user } from './db/schema.js';

/** A saved dashboard as the API returns it; `dashboard: null` means it was deleted. */
export type DashboardDocument = {
	id: string;
	version: number;
	updatedAt: string;
	dashboard: Dashboard | null;
};

/** A save (`dashboard` set) or a deletion (`dashboard: null`) from one device. */
export type DocumentWrite = {
	id: string;
	dashboard: Dashboard | null;
	/** The version the device last saw; 0 when it never saw one. */
	baseVersion: number;
	/** When the edit was made on the device. */
	updatedAt: Date;
};

export type WriteOutcome =
	| { kind: 'saved'; document: DashboardDocument }
	/** Another device's edit is newer; here it is, for the caller to adopt. */
	| { kind: 'stale'; document: DashboardDocument }
	/** Free is full: creating another dashboard of one's own needs Pro. */
	| { kind: 'limit'; limit: number }
	| { kind: 'too-many'; limit: number };

/**
 * A guard against runaway clients, far above any real use; Pro's "any number" is not this.
 * Deletion markers count too, so creating and deleting in a loop cannot grow an account forever.
 */
export const MAX_DOCUMENTS = 1000;

/**
 * Deletion markers are forgotten after this. A device away longer than that offers its copy of
 * a deleted dashboard again, as a new one.
 */
export const TOMBSTONE_DAYS = 90;

type Stored = { version: number; updatedAt: Date };

/**
 * Who wins when a write arrives. A device that saw the latest version simply wins. Otherwise
 * another device wrote in between, and the newer edit wins; a tie keeps what is stored.
 */
export function decideWrite(
	stored: Stored | null,
	incoming: { baseVersion: number; updatedAt: Date }
): 'accept' | 'stale' {
	if (!stored || incoming.baseVersion === stored.version) {
		return 'accept';
	}

	return incoming.updatedAt > stored.updatedAt ? 'accept' : 'stale';
}

export async function listDocuments(
	db: AccountsDatabase,
	userId: string
): Promise<DashboardDocument[]> {
	// Ids start with a base-36 timestamp, so this is creation order for a new device.
	const rows = await db
		.select()
		.from(dashboard)
		.where(eq(dashboard.userId, userId))
		.orderBy(dashboard.id);

	return rows.map(toDocument);
}

/**
 * Applies one device's save or deletion, enforcing the plan. The account row is locked for the
 * duration, so two devices creating at once cannot both slip under the Free limit.
 */
export async function writeDocument(
	db: AccountsDatabase,
	userId: string,
	entitlements: Entitlements,
	write: DocumentWrite,
	now: Date
): Promise<WriteOutcome> {
	// A device clock running ahead must not win every future conflict.
	const updatedAt = write.updatedAt > now ? now : write.updatedAt;

	return db.transaction(async (tx) => {
		await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('update');

		const [stored] = await tx
			.select()
			.from(dashboard)
			.where(and(eq(dashboard.userId, userId), eq(dashboard.id, write.id)));

		if (decideWrite(stored ?? null, { baseVersion: write.baseVersion, updatedAt }) === 'stale') {
			// The stale branch is only reachable with a stored row.
			return { kind: 'stale', document: toDocument(stored ?? missing(write.id)) };
		}

		const unchanged =
			stored?.document && write.dashboard
				? sameDashboard(stored.document, write.dashboard)
				: (stored?.document ?? null) === write.dashboard;

		if (unchanged) {
			return { kind: 'saved', document: toDocument(stored ?? missing(write.id)) };
		}

		const creating = write.dashboard !== null && !stored?.document;

		if (creating) {
			const mine = eq(dashboard.userId, userId);

			await tx
				.delete(dashboard)
				.where(
					and(
						mine,
						isNull(dashboard.document),
						lt(dashboard.updatedAt, new Date(now.getTime() - TOMBSTONE_DAYS * 86_400_000))
					)
				);

			const [own] = await tx
				.select({ total: count() })
				.from(dashboard)
				.where(and(mine, isNotNull(dashboard.document), notInArray(dashboard.id, [...PRESET_IDS])));

			const [all] = await tx.select({ total: count() }).from(dashboard).where(mine);

			if (
				!PRESET_IDS.some((id) => id === write.id) &&
				!canAddOwnDashboard(entitlements, own?.total ?? 0)
			) {
				return { kind: 'limit', limit: entitlements.ownDashboards ?? 0 };
			}

			if ((all?.total ?? 0) >= MAX_DOCUMENTS) {
				return { kind: 'too-many', limit: MAX_DOCUMENTS };
			}
		}

		const values = {
			document: write.dashboard,
			version: (stored?.version ?? 0) + 1,
			updatedAt
		};

		const [saved] = await tx
			.insert(dashboard)
			.values({ userId, id: write.id, ...values })
			.onConflictDoUpdate({ target: [dashboard.userId, dashboard.id], set: values })
			.returning();

		return { kind: 'saved', document: toDocument(saved ?? missing(write.id)) };
	});
}

function toDocument(row: typeof dashboard.$inferSelect): DashboardDocument {
	return {
		id: row.id,
		version: row.version,
		updatedAt: row.updatedAt.toISOString(),
		dashboard: row.document
	};
}

/** A dashboard the account never had: version 0, nothing stored. */
function missing(id: string): typeof dashboard.$inferSelect {
	return { userId: '', id, document: null, version: 0, updatedAt: new Date(0) };
}
