import * as React from 'react';
import { toast } from 'sonner';

import {
	adoptViewerSettings,
	readViewerSettings,
	useSpoilerSettings
} from '@/data/viewer-settings';
import { readSavedDashboards, replaceSavedDashboards } from '@/features/dashboard/dashboard-store';
import { refreshAccount, useAccount } from './account-store';
import { AccountsError, listDocuments, pushDocument, pushViewerSettings } from './api';
import { useGoPro } from './go-pro';
import { onLocalEdit, readSyncMeta, useSyncMeta, writeSyncMeta } from './sync-meta';
import { bindAccount, reconcile, settle, type SyncNotice, type SyncState } from './sync-rules';

/** Edits are sent this long after the last change, so a drag is one request, not fifty. */
const EDIT_DELAY_MS = 1000;

/** Other devices' changes arrive at the latest this long after they happen, while visible. */
const PULL_INTERVAL_MS = 30_000;

/** Two tabs of the same browser never sync at once. */
const LOCK = 'pitwall-dashboard-sync';

function current(): SyncState {
	return { saved: readSavedDashboards(), meta: readSyncMeta() };
}

function commit(next: SyncState): void {
	replaceSavedDashboards(next.saved);
	writeSyncMeta(next.meta);
}

/**
 * One round: pull, take in other devices' changes, send this device's, apply the answers. The
 * spoiler settings go last, in one request that merges them both ways.
 */
async function syncOnce(accountId: string): Promise<SyncNotice[]> {
	commit({ ...current(), meta: bindAccount(readSyncMeta(), readSavedDashboards(), accountId) });

	const remote = await listDocuments();
	// Read local state only after the network answers: edits made meanwhile must not be lost.
	const plan = reconcile(current(), remote);
	const notices: SyncNotice[] = [];

	commit(plan);

	for (const op of plan.push) {
		const outcome = await pushDocument(op);
		const settled = settle(current(), op, outcome);

		commit(settled);

		if (settled.notice) {
			notices.push(settled.notice);
		}
	}

	adoptViewerSettings(await pushViewerSettings(readViewerSettings()));

	return notices;
}

let running: Promise<void> | null = null;

let again = false;

/** Runs a sync now, or once more right after the one in flight. */
function requestSync(accountId: string, report: (notices: SyncNotice[]) => void): void {
	if (running) {
		again = true;

		return;
	}

	const round = async () => {
		try {
			report(await syncOnce(accountId));
		} catch (error) {
			if (error instanceof AccountsError && error.kind === 'signed-out') {
				void refreshAccount();
			}
			// Unreachable or refused: everything stays here and goes out with the next round.
		}
	};

	running = ('locks' in navigator ? navigator.locks.request(LOCK, round) : round()).finally(() => {
		running = null;

		if (again) {
			again = false;
			requestSync(accountId, report);
		}
	});
}

/**
 * Keeps this browser's dashboards and spoiler settings and the signed-in account in step: right
 * after sign-in, a moment after each edit or reveal, when the window comes back, and every half
 * minute while it is open.
 */
export function useDashboardSync(): void {
	const account = useAccount();
	const accountId = account.status === 'signed-in' ? account.me.user.id : null;
	const spoilerSettings = useSpoilerSettings();
	const syncRef = React.useRef<(() => void) | null>(null);
	const sentSettings = React.useRef(spoilerSettings);
	const goPro = useGoPro();
	const goProRef = React.useRef(goPro);

	React.useEffect(() => {
		goProRef.current = goPro;
	});

	React.useEffect(() => {
		if (!accountId) {
			return;
		}

		const report = (notices: SyncNotice[]) => {
			for (const notice of notices) {
				if (notice.kind === 'limit') {
					toast(`Free syncs ${notice.limit} dashboards of your own`, {
						description: 'The others stay on this device. Go Pro to sync any number.',
						action: { label: 'Go Pro', onClick: () => goProRef.current() }
					});
				} else {
					toast(
						notice.kind === 'restored'
							? `${notice.name} came back: it was edited on another device after you deleted it`
							: `${notice.name} changed on another device`,
						{ description: 'The newer version is the one on screen.' }
					);
				}
			}
		};

		const sync = () => requestSync(accountId, report);
		let editTimer: number | undefined;

		syncRef.current = sync;

		const offEdit = onLocalEdit(() => {
			window.clearTimeout(editTimer);
			editTimer = window.setTimeout(sync, EDIT_DELAY_MS);
		});

		const onVisible = () => {
			if (document.visibilityState === 'visible') {
				sync();
			}
		};

		const pull = window.setInterval(onVisible, PULL_INTERVAL_MS);

		sync();
		window.addEventListener('online', sync);
		document.addEventListener('visibilitychange', onVisible);

		return () => {
			syncRef.current = null;
			offEdit();
			window.clearTimeout(editTimer);
			window.clearInterval(pull);
			window.removeEventListener('online', sync);
			document.removeEventListener('visibilitychange', onVisible);
		};
	}, [accountId]);

	// A reveal or a change of protection goes out like a dashboard edit.
	React.useEffect(() => {
		if (sentSettings.current === spoilerSettings) {
			return;
		}

		sentSettings.current = spoilerSettings;

		const timer = window.setTimeout(() => syncRef.current?.(), EDIT_DELAY_MS);

		return () => window.clearTimeout(timer);
	}, [spoilerSettings]);
}

export type SyncStatus = 'local' | 'pending' | 'blocked' | 'synced';

/** Where one dashboard is kept, for the line next to its name while editing. */
export function useSyncStatus(id: string): SyncStatus {
	const account = useAccount();
	const meta = useSyncMeta();
	const entry = meta.docs[id];

	if (account.status !== 'signed-in' || meta.accountId !== account.me.user.id) {
		return 'local';
	}

	if (entry?.blocked) {
		return 'blocked';
	}

	return entry?.pending ? 'pending' : 'synced';
}
