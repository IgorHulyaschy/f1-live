import { DownloadIcon } from 'lucide-react';
import * as React from 'react';
import { z } from 'zod';

import { BRAND } from '@/brand';
import { BottomNotice } from '@/components/bottom-notice';
import { Key } from '@/components/console/keys';
import { createLocalStore } from '@/lib/local-store';

import { useAnalytics } from './consent';

/** Chromium's install offer; not in the DOM typings because only Chromium sends it. */
type InstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const dismissedStore = createLocalStore('pitwall-install-dismissed', z.boolean(), false);

const listeners = new Set<() => void>();

let offer: InstallPromptEvent | null = null;

function setOffer(next: InstallPromptEvent | null): void {
	offer = next;

	for (const listener of listeners) {
		listener();
	}
}

/**
 * Keeps the browser's install offer for our own keys. It can fire before React renders, so this
 * runs at startup.
 */
export function listenForInstallOffer(): void {
	window.addEventListener('beforeinstallprompt', (event) => {
		// The banner and footer key offer the install; the browser's own bar would ask a second time.
		event.preventDefault();
		// SAFETY: browsers send `beforeinstallprompt` only as a BeforeInstallPromptEvent.
		setOffer(event as InstallPromptEvent);
	});
	window.addEventListener('appinstalled', () => setOffer(null));
}

/**
 * The offline shell (service-worker.ts), registered once the page has loaded so it never competes
 * with the first paint. Development builds skip it: Vite serves files that change on every save.
 */
export function registerServiceWorker(): void {
	if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
		return;
	}

	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/sw.js').catch((cause: unknown) => {
			console.warn('The offline shell could not be installed', cause);
		});
	});
}

function subscribe(onChange: () => void): () => void {
	listeners.add(onChange);

	return () => listeners.delete(onChange);
}

/** Opens the browser's install dialog, or null when the browser has not offered one. */
function useInstall(): (() => Promise<void>) | null {
	const current = React.useSyncExternalStore(
		subscribe,
		() => offer,
		() => null
	);

	if (!current) {
		return null;
	}

	return async () => {
		await current.prompt();
		await current.userChoice;
		// An offer can be used once; the browser sends a new one if the app is still not installed.
		setOffer(null);
	};
}

export function InstallKey({ className }: { className?: string }) {
	const install = useInstall();

	if (!install) {
		return null;
	}

	return (
		<Key className={className} onClick={() => void install()}>
			<DownloadIcon />
			Install app
		</Key>
	);
}

/** Nobody is asked to install an app they have not used yet. */
const OFFER_AFTER_MS = 60_000;

/** Offered once, after a minute on the page and any privacy question; "Not now" leaves the footer key. */
export function InstallBanner() {
	const install = useInstall();
	const dismissed = dismissedStore.useValue();
	const { ask } = useAnalytics();
	const [settled, setSettled] = React.useState(false);

	React.useEffect(() => {
		const timer = window.setTimeout(() => setSettled(true), OFFER_AFTER_MS);

		return () => window.clearTimeout(timer);
	}, []);

	if (!install || dismissed || ask || !settled) {
		return null;
	}

	return (
		<BottomNotice
			id="install-banner"
			label="Install"
			actions={
				<>
					<Key onClick={() => dismissedStore.set(true)}>Not now</Key>
					<Key onClick={() => void install()}>
						<DownloadIcon />
						Install
					</Key>
				</>
			}
		>
			Put {BRAND.name} on your home screen: it opens full screen, without the browser around it, and
			starts from the copy on your device.
		</BottomNotice>
	);
}
