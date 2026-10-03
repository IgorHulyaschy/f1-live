import { type Dashboard, sameDashboard } from '@f1-live/shared/dashboard';

/**
 * Dashboard sync, as pure rules. The browser keeps the dashboards (local-first) and, per
 * dashboard, what the account last confirmed and what is still to send. The account server
 * decides conflicts: a device that saw the latest version wins, otherwise the newer edit does.
 */

export type DocMeta = {
	/** The account's version this copy is based on; 0 when the account never confirmed it. */
	version: number;
	/** The last edit made here, or the account's time for a copy taken from it. */
	updatedAt: string;
	/** What this device still has to tell the account. */
	pending: 'save' | 'delete' | null;
	/** The account refused to keep it: Free is full. It stays on this device. */
	blocked: boolean;
};

export type SyncMeta = {
	/** The account the versions belong to; null before the first sign-in. */
	accountId: string | null;
	docs: Record<string, DocMeta>;
};

/** A dashboard as the account holds it; `dashboard: null` means it was deleted there. */
export type RemoteDoc = {
	id: string;
	version: number;
	updatedAt: string;
	dashboard: Dashboard | null;
};

export type PushOp =
	| { kind: 'put'; dashboard: Dashboard; baseVersion: number; updatedAt: string }
	| { kind: 'delete'; id: string; baseVersion: number; updatedAt: string };

export type PushOutcome =
	| { kind: 'saved'; document: RemoteDoc }
	/** Another device's newer edit won; this is it. */
	| { kind: 'stale'; document: RemoteDoc }
	| { kind: 'limit'; limit: number }
	/** The account will not take this one (too big, malformed): it stays here, the rest go on. */
	| { kind: 'refused' };

export type SyncNotice =
	| { kind: 'replaced'; name: string }
	| { kind: 'restored'; name: string }
	| { kind: 'limit'; limit: number };

export type SyncState = { saved: readonly Dashboard[]; meta: SyncMeta };

export const EMPTY_META: SyncMeta = { accountId: null, docs: {} };

/** An edit nobody timed (saved before sync existed) loses to any edit that was. */
const UNKNOWN_TIME = new Date(0).toISOString();

export function opId(op: PushOp): string {
	return op.kind === 'put' ? op.dashboard.id : op.id;
}

export function recordSave(meta: SyncMeta, id: string, now: string): SyncMeta {
	const entry = meta.docs[id];

	return {
		...meta,
		docs: {
			...meta.docs,
			[id]: { version: entry?.version ?? 0, updatedAt: now, pending: 'save', blocked: false }
		}
	};
}

export function recordDelete(meta: SyncMeta, id: string, now: string): SyncMeta {
	const { [id]: entry, ...rest } = meta.docs;

	// Signed out and never confirmed: nothing to tell. Signed in, its first save may be on its
	// way, so the deletion is kept and sent; the account answers it either way.
	if (!entry || (entry.version === 0 && meta.accountId === null)) {
		return { ...meta, docs: rest };
	}

	return {
		...meta,
		docs: {
			...rest,
			[id]: { version: entry.version, updatedAt: now, pending: 'delete', blocked: false }
		}
	};
}

/**
 * Ties this browser's dashboards to an account. Signing in to a different account (or for the
 * first time) offers every dashboard here to it, keeping when each was last edited.
 */
export function bindAccount(
	meta: SyncMeta,
	saved: readonly Dashboard[],
	accountId: string
): SyncMeta {
	if (meta.accountId === accountId) {
		return meta;
	}

	return {
		accountId,
		docs: Object.fromEntries(
			saved.map((dashboard) => [
				dashboard.id,
				{
					version: 0,
					updatedAt: meta.docs[dashboard.id]?.updatedAt ?? UNKNOWN_TIME,
					pending: 'save',
					blocked: false
				} satisfies DocMeta
			])
		)
	};
}

/** Takes the account's copy: replaces the local one in place, or adds it at the end. */
function adopt(state: SyncState, document: RemoteDoc): SyncState {
	const { [document.id]: _dropped, ...docs } = state.meta.docs;
	const without = state.saved.filter((dashboard) => dashboard.id !== document.id);
	const { dashboard } = document;

	if (!dashboard) {
		return { saved: without, meta: { ...state.meta, docs } };
	}

	const index = state.saved.findIndex((entry) => entry.id === document.id);

	return {
		saved:
			index === -1
				? [...state.saved, dashboard]
				: state.saved.map((entry) => (entry.id === document.id ? dashboard : entry)),
		meta: {
			...state.meta,
			docs: {
				...docs,
				[document.id]: {
					version: document.version,
					updatedAt: document.updatedAt,
					pending: null,
					blocked: false
				}
			}
		}
	};
}

/**
 * Compares this browser with the account after a pull: takes in what changed elsewhere and lists
 * what to send. Unsent edits here are always sent; the account decides who wins.
 */
export function reconcile(
	state: SyncState,
	remote: readonly RemoteDoc[]
): SyncState & { push: PushOp[] } {
	const local = new Map(state.saved.map((dashboard) => [dashboard.id, dashboard]));

	const ids = new Set([
		...local.keys(),
		...Object.keys(state.meta.docs),
		...remote.map((doc) => doc.id)
	]);

	const remoteById = new Map(remote.map((doc) => [doc.id, doc]));
	const push: PushOp[] = [];
	// Deletions the account already has: nothing left to send.
	const finished = new Set<string>();
	let next: SyncState = state;

	for (const id of ids) {
		const dashboard = local.get(id);
		const entry = next.meta.docs[id];
		const theirs = remoteById.get(id);

		if (dashboard && (entry?.pending === 'save' || !entry)) {
			push.push({
				kind: 'put',
				dashboard,
				baseVersion: entry?.version ?? 0,
				updatedAt: entry?.updatedAt ?? UNKNOWN_TIME
			});
		} else if (entry?.pending === 'delete') {
			if (theirs?.dashboard) {
				push.push({ kind: 'delete', id, baseVersion: entry.version, updatedAt: entry.updatedAt });
			} else {
				finished.add(id);
			}
		} else if (theirs && (!dashboard || !entry || theirs.version !== entry.version)) {
			next = adopt(next, theirs);
		} else if (dashboard && entry && !theirs) {
			// The account lost it: offer it again.
			push.push({ kind: 'put', dashboard, baseVersion: 0, updatedAt: entry.updatedAt });
		}
	}

	const docs = Object.fromEntries(
		Object.entries(next.meta.docs).filter(([id]) => !finished.has(id))
	);

	return { saved: next.saved, meta: { ...next.meta, docs }, push };
}

/** Applies the account's answer to one push, unless the dashboard changed here meanwhile. */
export function settle(
	state: SyncState,
	op: PushOp,
	outcome: PushOutcome
): SyncState & { notice: SyncNotice | null } {
	const id = opId(op);
	const entry = state.meta.docs[id];
	const editedSince = entry?.updatedAt !== op.updatedAt;

	if (outcome.kind === 'limit' || outcome.kind === 'refused') {
		if (!entry || editedSince) {
			return { ...state, notice: null };
		}

		return {
			saved: state.saved,
			meta: { ...state.meta, docs: { ...state.meta.docs, [id]: { ...entry, blocked: true } } },
			notice:
				outcome.kind === 'limit' && !entry.blocked ? { kind: 'limit', limit: outcome.limit } : null
		};
	}

	const { document } = outcome;

	// A newer edit here goes out with the next sync, based on what the account has now.
	if (editedSince) {
		return {
			saved: state.saved,
			meta: entry
				? {
						...state.meta,
						docs: { ...state.meta.docs, [id]: { ...entry, version: document.version } }
					}
				: state.meta,
			notice: null
		};
	}

	const next = adopt(state, document);

	if (outcome.kind === 'saved') {
		return { ...next, notice: null };
	}

	const mine = op.kind === 'put' ? op.dashboard : null;
	const theirs = document.dashboard;

	if (mine && theirs && sameDashboard(mine, theirs)) {
		return { ...next, notice: null };
	}

	return {
		...next,
		notice: theirs
			? { kind: mine ? 'replaced' : 'restored', name: theirs.name }
			: { kind: 'replaced', name: mine?.name ?? id }
	};
}
