import { type Entitlements, PLAN_ENTITLEMENTS, type PlanId } from '@f1-live/shared/plans';
import * as React from 'react';

import { createLocalStore } from '@/lib/local-store';

import {
	type AccountsConfig,
	AccountsError,
	fetchConfig,
	fetchMe,
	type Me,
	meSchema,
	signOutSession
} from './api';
import { readSyncMeta, writeSyncMeta } from './sync-meta';

/**
 * Who is signed in. `unavailable` means no accounts server answered: the app works as before,
 * with dashboards kept in this browser.
 */
export type AccountState =
	| { status: 'loading' }
	| { status: 'unavailable' }
	| { status: 'signed-out' }
	| { status: 'signed-in'; me: Me };

/** Sign-in, sign-out and account deletion in one window update the others through storage. */
const CHANGED_KEY = 'pitwall-account-changed';

/**
 * The account as last seen, so a reload starts on the right plan instead of flashing Free while
 * the session is checked. The check that follows always wins.
 */
const lastSeen = createLocalStore<Me | null>('pitwall-account-seen', meSchema.nullable(), null);

const listeners = new Set<() => void>();

let state: AccountState | null = null;

let loading: Promise<void> | null = null;

function setState(next: AccountState): void {
	state = next;
	lastSeen.set(next.status === 'signed-in' ? next.me : null);

	for (const listener of listeners) {
		listener();
	}
}

export function readAccount(): AccountState {
	if (!state) {
		const seen = lastSeen.get();

		state = seen ? { status: 'signed-in', me: seen } : { status: 'loading' };
	}

	return state;
}

/** Reads the session again: after signing in elsewhere, a checkout, or coming back to the tab. */
export function refreshAccount(): Promise<void> {
	loading ??= fetchMe()
		.then(
			(me) => setState(me ? { status: 'signed-in', me } : { status: 'signed-out' }),
			(cause: unknown) => {
				if (cause instanceof AccountsError && cause.kind === 'signed-out') {
					setState({ status: 'signed-out' });
				} else if (readAccount().status !== 'signed-in') {
					// A blip while signed in keeps the session; anything else means no accounts here.
					setState({ status: 'unavailable' });
				}
			}
		)
		.finally(() => {
			loading = null;
		});

	return loading;
}

/** Tells the other windows that the account changed. */
function announceAccountChange(): void {
	try {
		window.localStorage.setItem(CHANGED_KEY, String(Date.now()));
	} catch {
		// Storage can be blocked; other windows then catch up when they get focus.
	}
}

function subscribe(onChange: () => void): () => void {
	listeners.add(onChange);

	if (listeners.size === 1) {
		window.addEventListener('storage', onStorage);
		window.addEventListener('focus', onFocus);
		void refreshAccount();
	}

	return () => {
		listeners.delete(onChange);

		if (listeners.size === 0) {
			window.removeEventListener('storage', onStorage);
			window.removeEventListener('focus', onFocus);
		}
	};
}

function onFocus(): void {
	void refreshAccount();
}

function onStorage(event: StorageEvent): void {
	if (event.key === CHANGED_KEY) {
		void refreshAccount();
	}
}

const LOADING: AccountState = { status: 'loading' };

export function useAccount(): AccountState {
	return React.useSyncExternalStore(subscribe, readAccount, () => LOADING);
}

/** What the viewer may do: the account's plan, or Free when signed out. */
export function useEntitlements(): Entitlements {
	const account = useAccount();

	return account.status === 'signed-in' ? account.me.entitlements : PLAN_ENTITLEMENTS.free;
}

export function useAccountPlan(): PlanId {
	const account = useAccount();

	return account.status === 'signed-in' ? account.me.plan : 'free';
}

/**
 * Signs out here and in every window. Dashboards stay in this browser; the next sign-in offers
 * them to whichever account it is.
 */
export async function signOut(): Promise<void> {
	await signOutSession();
	writeSyncMeta({ ...readSyncMeta(), accountId: null });
	setState({ status: 'signed-out' });
	announceAccountChange();
}

/** After the account is deleted on the server. */
export function forgetAccount(): void {
	writeSyncMeta({ ...readSyncMeta(), accountId: null });
	setState({ status: 'signed-out' });
	announceAccountChange();
}

let configRequest: Promise<AccountsConfig> | null = null;

/** Sign-in providers, the dev mailbox and prices; read once per page. */
export function useAccountsConfig(): AccountsConfig | null {
	const [config, setConfig] = React.useState<AccountsConfig | null>(null);

	React.useEffect(() => {
		let cancelled = false;

		const load = async () => {
			configRequest ??= fetchConfig();

			try {
				const loaded = await configRequest;

				if (!cancelled) {
					setConfig(loaded);
				}
			} catch {
				// No accounts here; asked again on the next page that needs it.
				configRequest = null;
			}
		};

		void load();

		return () => {
			cancelled = true;
		};
	}, []);

	return config;
}
