/**
 * What a Web Push carries and where a tap on it leads: plain functions, so they are tested away
 * from the service worker that uses them (push-worker.ts). The payload is the server's
 * `PushPayload` (server/src/accounts/alerts/sender.ts).
 *
 * The service worker is one classic script, so this imports nothing the app shares: a shared
 * module would be split into a chunk, and a worker cannot import it.
 */

export type Notice = { title: string; body: string; tag: string | undefined; url: string };

/** A push that is not ours or is garbled still has to show something: browsers only allow visible ones. */
const FALLBACK: Notice = {
	title: 'Race alert',
	body: 'Something happened in your session.',
	tag: undefined,
	url: '/'
};

type RawPayload = { title?: string; body?: string; tag?: string; url?: string };

/** The notice a push carries; anything that is not a payload of ours reads as the fallback. */
export function noticeFrom(raw: string | null): Notice {
	if (!raw) {
		return FALLBACK;
	}

	try {
		// JSON.parse gives any: a field that is missing or not what the server sends reads as absent.
		const data: RawPayload | null = JSON.parse(raw);

		if (!data?.title) {
			return FALLBACK;
		}

		return {
			title: String(data.title),
			body: data.body ? String(data.body) : '',
			tag: data.tag ? String(data.tag) : undefined,
			url: data.url ? String(data.url) : '/'
		};
	} catch {
		return FALLBACK;
	}
}

/** The address the worker attached to the notice it showed (`showNotification`'s data); home if none. */
export function noticeUrl(data: { url?: string } | null): string {
	return data?.url ?? '/';
}

/** Where a tap opens: an address on this site, whatever the notice says. */
export function sameSiteUrl(url: string, origin: string): string {
	try {
		const target = new URL(url, origin);

		return target.origin === origin ? `${target.pathname}${target.search}` : '/';
	} catch {
		return '/';
	}
}
