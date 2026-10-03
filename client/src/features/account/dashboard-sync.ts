import * as React from 'react';
import { toast } from 'sonner';

import {
	adoptViewerSettings,
	readViewerSettings,
	useSpoilerSettings
} from '@/data/viewer-settings';
import { readSavedDashboards, replaceSavedDashboards } from '@/features/dashboard/dashboard-store';
import { refreshAccount, useAccount } from './account-store';
import {
	ACCOUNTS_BASE,
	AccountsError,
	DEVICE_ID,
	listDocuments,
	pushDocument,
	pushViewerSettings
} from './api';
import { useGoPro } from './go-pro';
import { onLocalEdit, readSyncMeta, writeSyncMeta } from './sync-meta';
import { bindAccount, reconcile, settle, type SyncNotice, type SyncState } from './sync-rules';
import { eventsUrl, openSyncSocket } from './sync-socket';

/** Edits are sent this long after the last change, so a drag is one request, not fifty. */
const EDIT_DELAY_MS = 1000;

/**
 * A backstop for the device channel: other devices' changes arrive at the latest this long
 * after they happen, while visible. With the channel down it is the only way, so it is quick.
 */
const PULL_INTERVAL_MS = 30_000;

const PULL_INTERVAL_CHANNEL_UP_MS = 300_000;

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

	try {
		adoptViewerSettings(await pushViewerSettings(readViewerSettings()));
	} catch {
		// The dashboards went through; the settings go out with the next round.
	}

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
 * after sign-in, a moment after each edit or reveal, when the window comes back, when the server
 * says another device changed something, and as a backstop every half minute (every five while
 * the channel is up) while it is open.
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

		let channelUp = false;
		let sinceLastPull = 0;

		const pull = window.setInterval(() => {
			sinceLastPull += PULL_INTERVAL_MS;

			if (!channelUp || sinceLastPull >= PULL_INTERVAL_CHANNEL_UP_MS) {
				sinceLastPull = 0;
				onVisible();
			}
		}, PULL_INTERVAL_MS);

		const closeChannel = openSyncSocket({
			url: eventsUrl(ACCOUNTS_BASE, window.location, DEVICE_ID),
			onChange: sync,
			onOpen: (open) => {
				channelUp = open;
			}
		});

		sync();
		window.addEventListener('online', sync);
		document.addEventListener('visibilitychange', onVisible);

		return () => {
			syncRef.current = null;
			offEdit();
			closeChannel();
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
