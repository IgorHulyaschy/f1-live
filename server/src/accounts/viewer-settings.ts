import { mergeViewerSettings, type ViewerSettings } from '@f1-live/shared/viewer';
import { eq } from 'drizzle-orm';

import type { AccountsDatabase } from './db/database.js';
import { user, viewerSettings } from './db/schema.js';

/**
 * Merges one device's spoiler settings into the account's and returns the result, for the
 * device to adopt. The account row is locked, so two devices writing at once both count.
 */
export async function writeViewerSettings(
	db: AccountsDatabase,
	userId: string,
	incoming: ViewerSettings
): Promise<{ settings: ViewerSettings; changed: boolean }> {
	return db.transaction(async (tx) => {
		await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('update');

		const [stored] = await tx
			.select()
			.from(viewerSettings)
			.where(eq(viewerSettings.userId, userId));

		const settings = mergeViewerSettings(stored?.settings ?? null, incoming);

		// Every sync round sends the settings; most change nothing.
		if (stored && JSON.stringify(stored.settings) === JSON.stringify(settings)) {
			return { settings, changed: false };
		}

		await tx
			.insert(viewerSettings)
			.values({ userId, settings })
			.onConflictDoUpdate({ target: viewerSettings.userId, set: { settings } });

		return { settings, changed: true };
	});
}

export async function readViewerSettings(
	db: AccountsDatabase,
	userId: string
): Promise<ViewerSettings | null> {
	const [stored] = await db.select().from(viewerSettings).where(eq(viewerSettings.userId, userId));

	return stored?.settings ?? null;
}
