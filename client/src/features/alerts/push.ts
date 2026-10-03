import { urlBase64ToBytes } from './push-key';

/**
 * Why this browser cannot take pushes right now. `no-worker`: there is no service worker, which
 * development builds skip; the installed app and the production build have one.
 */
export type PushState = 'unsupported' | 'no-worker' | 'denied' | 'ready';

export class PushError extends Error {
	override readonly name = 'PushError';
	readonly reason: 'denied' | 'no-worker' | 'failed';

	constructor(reason: PushError['reason']) {
		super(reason);
		this.reason = reason;
	}
}

function supported(): boolean {
	return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** This browser's own subscription, if it has one. */
export async function currentSubscription(): Promise<PushSubscription | null> {
	if (!supported()) {
		return null;
	}

	const registration = await navigator.serviceWorker.getRegistration();

	return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function pushState(): Promise<PushState> {
	if (!supported()) {
		return 'unsupported';
	}

	if (!(await navigator.serviceWorker.getRegistration())) {
		return 'no-worker';
	}

	return Notification.permission === 'denied' ? 'denied' : 'ready';
}

/** Asks permission, then subscribes this browser with the server's key. */
export async function subscribeThisDevice(publicKey: string): Promise<PushSubscription> {
	const state = await pushState();

	if (state === 'unsupported' || state === 'no-worker') {
		throw new PushError('no-worker');
	}

	if (state === 'denied' || (await Notification.requestPermission()) !== 'granted') {
		throw new PushError('denied');
	}

	const registration = await navigator.serviceWorker.ready;

	try {
		return (
			(await registration.pushManager.getSubscription()) ??
			(await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToBytes(publicKey)
			}))
		);
	} catch {
		throw new PushError('failed');
	}
}

/** Drops this browser's subscription; the endpoint it had, so the server can forget it too. */
export async function unsubscribeThisDevice(): Promise<string | null> {
	const subscription = await currentSubscription();

	if (!subscription) {
		return null;
	}

	await subscription.unsubscribe();

	return subscription.endpoint;
}
