import type { AlertSettings } from '@f1-live/shared/alerts';
import type { Dashboard } from '@f1-live/shared/dashboard';
import type { ViewerSettings } from '@f1-live/shared/viewer';
import { and, eq, isNotNull, sql } from 'drizzle-orm';

import { type PaymentProvider, PaymentProviderError } from '../payments/provider.js';
import type { AccountsDatabase } from './db/database.js';
import {
	account,
	dashboard,
	deletedAccount,
	libraryAdd,
	libraryEntry,
	libraryReport,
	session,
	user,
	verification
} from './db/schema.js';
import { isLive, subscriptionsOf } from './entitlements.js';
import { listDevices, readAlertSettings, type Device } from './alerts/store.js';
import { handleOf } from './library/entries.js';
import { readViewerSettings } from './viewer-settings.js';

/** Everything the account server holds about a person, minus secrets such as session tokens. */
export type AccountExport = {
	exportedAt: string;
	account: { id: string; email: string; name: string; emailVerified: boolean; createdAt: string };
	signInMethods: { provider: string; linkedAt: string }[];
	sessions: {
		createdAt: string;
		expiresAt: string;
		ipAddress: string | null;
		userAgent: string | null;
	}[];
	subscriptions: {
		provider: string;
		status: string;
		interval: string | null;
		currentPeriodEnd: string | null;
		cancelAtPeriodEnd: boolean;
	}[];
	dashboards: { id: string; version: number; updatedAt: string; dashboard: Dashboard }[];
	/** Spoiler protection and the sessions revealed; null before the first sync. */
	viewer: ViewerSettings | null;
	/** Alert settings, and the browsers registered for Web Push. */
	alerts: { settings: AlertSettings | null; devices: Device[] };
	/** The handle chosen for the fan library, and what was published, added and reported there. */
	library: {
		handle: string | null;
		published: { id: string; name: string; description: string; tags: string[]; adds: number }[];
		added: string[];
		reported: { entryId: string; reason: string }[];
	};
};

export async function exportAccount(
	db: AccountsDatabase,
	userId: string,
	now: Date
): Promise<AccountExport | null> {
	const [person] = await db.select().from(user).where(eq(user.id, userId));

	if (!person) {
		return null;
	}

	const [
		links,
		sessions,
		subscriptions,
		dashboards,
		viewer,
		handle,
		published,
		added,
		reported,
		alertSettings,
		devices
	] = await Promise.all([
		db.select().from(account).where(eq(account.userId, userId)),
		db.select().from(session).where(eq(session.userId, userId)),
		subscriptionsOf(db, userId),
		db
			.select()
			.from(dashboard)
			.where(and(eq(dashboard.userId, userId), isNotNull(dashboard.document))),
		readViewerSettings(db, userId),
		handleOf(db, userId),
		db.select().from(libraryEntry).where(eq(libraryEntry.userId, userId)),
		db.select().from(libraryAdd).where(eq(libraryAdd.userId, userId)),
		db.select().from(libraryReport).where(eq(libraryReport.userId, userId)),
		readAlertSettings(db, userId),
		listDevices(db, userId)
	]);

	return {
		exportedAt: now.toISOString(),
		account: {
			id: person.id,
			email: person.email,
			name: person.name,
			emailVerified: person.emailVerified,
			createdAt: person.createdAt.toISOString()
		},
		signInMethods: links.map((link) => ({
			provider: link.providerId,
			linkedAt: link.createdAt.toISOString()
		})),
		sessions: sessions.map((entry) => ({
			createdAt: entry.createdAt.toISOString(),
			expiresAt: entry.expiresAt.toISOString(),
			ipAddress: entry.ipAddress,
			userAgent: entry.userAgent
		})),
		subscriptions: subscriptions.map((record) => ({
			provider: record.provider,
			status: record.status,
			interval: record.interval,
			currentPeriodEnd: record.currentPeriodEnd?.toISOString() ?? null,
			cancelAtPeriodEnd: record.cancelAtPeriodEnd
		})),
		dashboards: dashboards.flatMap((row) =>
			row.document
				? [
						{
							id: row.id,
							version: row.version,
							updatedAt: row.updatedAt.toISOString(),
							dashboard: row.document
						}
					]
				: []
		),
		viewer,
		alerts: { settings: alertSettings, devices },
		library: {
			handle,
			published: published.map((row) => ({
				id: row.id,
				name: row.name,
				description: row.description,
				tags: row.tags,
				adds: row.adds
			})),
			added: added.map((row) => row.entryId),
			reported: reported.map((row) => ({ entryId: row.entryId, reason: row.reason }))
		}
	};
}

/**
 * Deletes an account and everything under it (sessions, sign-in methods, dashboards,
 * subscriptions, the library handle and what was published, alert settings and push devices
 * cascade with the user row; unused sign-in links name the email, so they go
 * too). Every subscription not yet ended, live or still settling, is ended with the provider
 * first; if the provider refuses, nothing is deleted, so nobody is billed for a gone account.
 */
export async function deleteAccount(
	db: AccountsDatabase,
	provider: PaymentProvider,
	userId: string,
	now: Date
): Promise<void> {
	const open = (await subscriptionsOf(db, userId)).filter((record) => record.status !== 'canceled');

	for (const record of open) {
		if (record.provider !== provider.name) {
			// One left behind by a provider this server no longer runs; only a live one blocks.
			if (!isLive(record, now)) {
				continue;
			}

			throw new PaymentProviderError(
				`Subscription ${record.id} is with ${record.provider}, which this server is not set up for`
			);
		}

		await provider.cancelSubscription(record.id);
	}

	const [person] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));

	await db.transaction(async (tx) => {
		if (person) {
			// Links keep the address as it was typed; accounts keep it in lower case.
			await tx
				.delete(verification)
				.where(
					sql`strpos(lower(${verification.value}), ${JSON.stringify(person.email.toLowerCase())}) > 0`
				);
		}

		await tx.delete(user).where(eq(user.id, userId));
		await tx.insert(deletedAccount).values({ userId }).onConflictDoNothing();
	});
}
