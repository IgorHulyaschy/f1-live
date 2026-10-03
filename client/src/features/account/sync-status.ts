import { useAccount } from './account-store';
import { useSyncMeta } from './sync-meta';

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
