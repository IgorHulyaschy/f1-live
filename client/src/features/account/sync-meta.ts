import { z } from 'zod';

import { createLocalStore } from '@/lib/local-store';

import { EMPTY_META, recordDelete, recordSave, type SyncMeta } from './sync-rules';

const syncMetaSchema = z.object({
	accountId: z.string().nullable(),
	docs: z.record(
		z.string(),
		z.object({
			version: z.int().min(0),
			updatedAt: z.iso.datetime(),
			pending: z.enum(['save', 'delete']).nullable(),
			blocked: z.boolean()
		})
	)
});

/** What the account last confirmed for each saved dashboard, and what is still to send. */
const syncMetaStore = createLocalStore<SyncMeta>(
	'pitwall-dashboard-sync',
	syncMetaSchema,
	EMPTY_META
);

export const readSyncMeta = syncMetaStore.get;

export const writeSyncMeta = syncMetaStore.set;

export const useSyncMeta = syncMetaStore.useValue;

const editListeners = new Set<() => void>();

/** Called on every edit made here, signed in or not, so the first sign-in knows edit times. */
export function noteSaved(id: string): void {
	writeSyncMeta(recordSave(readSyncMeta(), id, new Date().toISOString()));
	notifyEdit();
}

export function noteDeleted(id: string): void {
	writeSyncMeta(recordDelete(readSyncMeta(), id, new Date().toISOString()));
	notifyEdit();
}

/** Runs `listener` after each edit made in this window. */
export function onLocalEdit(listener: () => void): () => void {
	editListeners.add(listener);

	return () => {
		editListeners.delete(listener);
	};
}

function notifyEdit(): void {
	for (const listener of editListeners) {
		listener();
	}
}
