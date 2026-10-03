import { type Dashboard, parseDashboardText } from '../dashboard/dashboards.ts';

/**
 * A dashboard carried whole in a link, so sharing needs no server: the layout is small, and the
 * receiver's browser parses it with the same checks as an imported file.
 */
export function encodeShare(dashboard: Dashboard): string {
	const bytes = new TextEncoder().encode(JSON.stringify(dashboard));
	const binary = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');

	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function decodeShare(code: string): Dashboard | null {
	try {
		const binary = atob(code.replaceAll('-', '+').replaceAll('_', '/'));
		const bytes = Uint8Array.from(binary, (character) => character.codePointAt(0) ?? 0);

		return parseDashboardText(new TextDecoder().decode(bytes));
	} catch {
		return null;
	}
}

/** The link also names the session on screen, so the receiver sees the dashboard on it. */
export function shareUrl(dashboard: Dashboard, sessionKey: string): string {
	const params = new URLSearchParams({ d: encodeShare(dashboard), session: sessionKey });

	return `${window.location.origin}/shared?${params}`;
}
