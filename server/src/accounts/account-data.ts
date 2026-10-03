import type { Dashboard } from '@f1-live/shared/dashboard';
import { and, eq, isNotNull } from 'drizzle-orm';

import { type PaymentProvider, PaymentProviderError } from '../payments/provider.js';
import type { AccountsDatabase } from './db/database.js';
import { account, dashboard, session, user } from './db/schema.js';
import { isLive, subscriptionsOf } from './entitlements.js';

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

	const [links, sessions, subscriptions, dashboards] = await Promise.all([
		db.select().from(account).where(eq(account.userId, userId)),
		db.select().from(session).where(eq(session.userId, userId)),
		subscriptionsOf(db, userId),
		db
			.select()
			.from(dashboard)
			.where(and(eq(dashboard.userId, userId), isNotNull(dashboard.document)))
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
		)
	};
}

/**
 * Deletes an account and everything under it (sessions, sign-in methods, dashboards,
 * subscriptions cascade with the user row). A live subscription is ended with the provider
 * first; if the provider refuses, nothing is deleted, so nobody is billed for a gone account.
 */
export async function deleteAccount(
	db: AccountsDatabase,
	provider: PaymentProvider,
	userId: string,
	now: Date
): Promise<void> {
	const live = (await subscriptionsOf(db, userId)).filter((record) => isLive(record, now));

	for (const record of live) {
		if (record.provider !== provider.name) {
			throw new PaymentProviderError(
				`Subscription ${record.id} is with ${record.provider}, which this server is not set up for`
			);
		}

		await provider.cancelSubscription(record.id);
	}

	await db.delete(user).where(eq(user.id, userId));
}
