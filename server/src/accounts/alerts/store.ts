import type { AlertSettings } from '@f1-live/shared/alerts';
import type { ViewerSettings } from '@f1-live/shared/viewer';
import { desc, eq, inArray } from 'drizzle-orm';

import type { AccountsDatabase } from '../db/database.js';
import { alertSettings, pushSubscription, viewerSettings } from '../db/schema.js';
import type { PushTarget } from './sender.js';

/** A few phones, a laptop and a tablet; more is a script or a leak. */
export const MAX_DEVICES = 10;

export type Device = {
	endpoint: string;
	userAgent: string | null;
	createdAt: string;
};

export async function readAlertSettings(
	db: AccountsDatabase,
	userId: string
): Promise<AlertSettings | null> {
	const [row] = await db.select().from(alertSettings).where(eq(alertSettings.userId, userId));

	return row?.settings ?? null;
}

export async function writeAlertSettings(
	db: AccountsDatabase,
	userId: string,
	settings: AlertSettings
): Promise<void> {
	await db
		.insert(alertSettings)
		.values({ userId, settings })
		.onConflictDoUpdate({ target: alertSettings.userId, set: { settings } });
}

export async function listDevices(db: AccountsDatabase, userId: string): Promise<Device[]> {
	const rows = await db
		.select()
		.from(pushSubscription)
		.where(eq(pushSubscription.userId, userId))
		.orderBy(desc(pushSubscription.createdAt));

	return rows.map((row) => ({
		endpoint: row.endpoint,
		userAgent: row.userAgent,
		createdAt: row.createdAt.toISOString()
	}));
}

/**
 * Keeps a browser's subscription for this account. The same browser subscribing again, even as
 * another account, takes the row over. Past the limit the oldest go.
 */
export async function saveDevice(
	db: AccountsDatabase,
	userId: string,
	target: PushTarget,
	userAgent: string | null
): Promise<void> {
	await db.transaction(async (tx) => {
		await tx
			.insert(pushSubscription)
			.values({ ...target, userId, userAgent })
			.onConflictDoUpdate({
				target: pushSubscription.endpoint,
				set: { userId, p256dh: target.p256dh, auth: target.auth, userAgent, createdAt: new Date() }
			});

		const own = await tx
			.select({ endpoint: pushSubscription.endpoint })
			.from(pushSubscription)
			.where(eq(pushSubscription.userId, userId))
			.orderBy(desc(pushSubscription.createdAt));

		const surplus = own.slice(MAX_DEVICES).map((row) => row.endpoint);

		if (surplus.length > 0) {
			await tx.delete(pushSubscription).where(inArray(pushSubscription.endpoint, surplus));
		}
	});
}

/** Whether the account had that device. Another account's endpoint is not this one's to remove. */
export async function removeDevice(
	db: AccountsDatabase,
	userId: string,
	endpoint: string
): Promise<boolean> {
	const rows = await db
		.select({ userId: pushSubscription.userId })
		.from(pushSubscription)
		.where(eq(pushSubscription.endpoint, endpoint));

	if (rows[0]?.userId !== userId) {
		return false;
	}

	await db.delete(pushSubscription).where(eq(pushSubscription.endpoint, endpoint));

	return true;
}

/** A dead subscription, reported by the push service. */
export async function forgetDevice(db: AccountsDatabase, endpoint: string): Promise<void> {
	await db.delete(pushSubscription).where(eq(pushSubscription.endpoint, endpoint));
}

export type Recipient = {
	userId: string;
	settings: AlertSettings;
	/** Null before the account's first sync, which reads as protection on. */
	viewer: ViewerSettings | null;
	devices: PushTarget[];
};

/** Everyone with a device and settings: who an alert may go to. */
export async function loadRecipients(db: AccountsDatabase): Promise<Recipient[]> {
	const [subscriptions, settings, viewers] = await Promise.all([
		db.select().from(pushSubscription),
		db.select().from(alertSettings),
		db.select().from(viewerSettings)
	]);

	const viewerOf = new Map(viewers.map((row) => [row.userId, row.settings]));

	return settings.flatMap((row) => {
		const devices = subscriptions
			.filter((subscription) => subscription.userId === row.userId)
			.map(({ endpoint, p256dh, auth }) => ({ endpoint, p256dh, auth }));

		return devices.length === 0
			? []
			: [
					{
						userId: row.userId,
						settings: row.settings,
						viewer: viewerOf.get(row.userId) ?? null,
						devices
					}
				];
	});
}
