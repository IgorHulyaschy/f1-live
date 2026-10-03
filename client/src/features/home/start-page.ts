import { z } from 'zod';

import { createLocalStore } from '../../lib/local-store.ts';
import { dashboardPath, SESSION_PATH } from '../dashboard/paths.ts';
import { isSessionLayout } from '../dashboard/session-layouts.ts';

export const HOME = 'home';

/** The session on screen in its own layout: Race, Quali or Practice. */
export const SESSION_START = 'session';

/** Where a fresh visit to `/` opens: the home, the session's layout or a dashboard id. */
export const startPageStore = createLocalStore('pitwall-start-page', z.string().min(1), HOME);

/**
 * Where `/` sends a returning viewer who chose another start page, or null to show the home. A
 * start page that no longer exists, say a deleted dashboard, falls back to the home.
 */
export function startRedirect(start: string, dashboardIds: readonly string[]): string | null {
	if (start === SESSION_START) {
		return SESSION_PATH;
	}

	if (start === HOME || !dashboardIds.includes(start)) {
		return null;
	}

	return isSessionLayout(start) ? SESSION_PATH : dashboardPath(start);
}

/**
 * Old links to `/` carried the session, its replay position or edit mode for the dashboard that
 * lived there; they now open that dashboard at its own address.
 */
export const SESSION_LINK_PARAMS = ['session', 'lap', 'edit'] as const;

export function isSessionLink(params: URLSearchParams): boolean {
	return SESSION_LINK_PARAMS.some((name) => params.has(name));
}
