import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import webpush from 'web-push';
import { z } from 'zod';

import type { AccountsConfig } from '../config.js';

/** A browser's Web Push subscription as the push service gave it. */
export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** What the service worker shows; small, since push services cap a message at about 4 KB. */
export type PushPayload = {
	title: string;
	body: string;
	/** Notices with the same tag replace each other, so two devices or a retry show one. */
	tag: string;
	kind: string;
	/** Where a tap on the notice opens. */
	url: string;
};

/** `gone`: the browser unsubscribed or the service dropped it; the subscription is dead. */
export type PushResult = 'sent' | 'gone' | 'failed';

export interface PushSender {
	readonly publicKey: string;
	send(target: PushTarget, payload: PushPayload): Promise<PushResult>;
}

/** Alerts are about now: a notice that could not be delivered within two minutes is dropped. */
const TTL_SECONDS = 120;

const GONE_STATUSES = new Set([404, 410]);

/** Sends through the browser vendors' push services, signed with the server's VAPID keys. */
export class WebPushSender implements PushSender {
	readonly publicKey: string;
	private readonly options: webpush.RequestOptions;

	constructor(keys: { publicKey: string; privateKey: string }, subject: string) {
		this.publicKey = keys.publicKey;
		this.options = {
			vapidDetails: { subject, ...keys },
			TTL: TTL_SECONDS,
			timeout: 10_000
		};
	}

	async send(target: PushTarget, payload: PushPayload): Promise<PushResult> {
		try {
			await webpush.sendNotification(
				{ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
				JSON.stringify(payload),
				this.options
			);

			return 'sent';
		} catch (cause) {
			const status = cause instanceof webpush.WebPushError ? cause.statusCode : null;

			return status !== null && GONE_STATUSES.has(status) ? 'gone' : 'failed';
		}
	}
}

const keyFileSchema = z.object({ publicKey: z.string().min(1), privateKey: z.string().min(1) });

/**
 * The server's VAPID keys: the ones configured, or in development a pair made once and kept
 * beside the database so subscriptions survive a restart. Null when there are none and none may
 * be made (production without keys): alerts then stay in the app.
 */
export async function resolveVapidKeys(
	push: AccountsConfig['push']
): Promise<{ publicKey: string; privateKey: string } | null> {
	if (push.keys) {
		return push.keys;
	}

	if (!push.generateInto) {
		return null;
	}

	const { file } = push.generateInto;

	if (file) {
		try {
			return keyFileSchema.parse(JSON.parse(await readFile(file, 'utf8')));
		} catch {
			// None yet, or unreadable: make a new pair.
		}
	}

	const keys = webpush.generateVAPIDKeys();

	if (file) {
		await mkdir(path.dirname(file), { recursive: true });
		await writeFile(file, JSON.stringify(keys), { mode: 0o600 });
	}

	return keys;
}

/**
 * The push services the browsers use. A subscription's endpoint is a URL the server will POST to,
 * so one that points anywhere else (an internal host, a metadata address) is refused. The owner
 * adds a vendor's host through `PUSH_ENDPOINT_HOSTS`; a leading `*.` allows its subdomains.
 */
const PUSH_SERVICE_HOSTS = [
	'fcm.googleapis.com',
	'*.push.services.mozilla.com',
	'*.notify.windows.com',
	'*.push.apple.com'
];

export function isPushEndpointAllowed(endpoint: string, extraHosts: readonly string[]): boolean {
	let url: URL;

	try {
		url = new URL(endpoint);
	} catch {
		return false;
	}

	// A port or credentials in the address are never a vendor's.
	if (url.protocol !== 'https:' || url.port !== '' || url.username !== '' || url.password !== '') {
		return false;
	}

	return [...PUSH_SERVICE_HOSTS, ...extraHosts].some((allowed) =>
		allowed.startsWith('*.') ? url.hostname.endsWith(allowed.slice(1)) : url.hostname === allowed
	);
}
