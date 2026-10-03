import * as React from 'react';
import { useLocation } from 'react-router';

import { useRaceView } from '../../data/race-context';
import { useDashboards } from '../dashboard/dashboard-store';
import type { Dashboard } from '../dashboard/dashboards';
import { dashboardIdFromPath, safeDecode } from '../dashboard/paths';
import { sessionLayoutId } from '../dashboard/session-layouts';
import { decodeShare } from './share';
import { useLibraryEntry } from './use-library';

/** The dashboard the current page shows: one of the viewer's, a library preview or a shared link. */
export function useShownDashboard(): Dashboard | null {
	const { pathname, search } = useLocation();
	const { dashboards } = useDashboards();
	const { race } = useRaceView();
	const id = dashboardIdFromPath(pathname, sessionLayoutId(race.session.type));
	const libraryId = /^\/library\/([^/]+)$/.exec(pathname)?.[1];
	const library = useLibraryEntry(libraryId ? safeDecode(libraryId) : null);
	const code = pathname === '/shared' ? new URLSearchParams(search).get('d') : null;
	// The header asks on every lap; decode a shared link once per link.
	const shared = React.useMemo(() => (code ? decodeShare(code) : null), [code]);

	if (id) {
		return dashboards.find((dashboard) => dashboard.id === id) ?? null;
	}

	if (libraryId) {
		return library.entry?.dashboard ?? null;
	}

	if (pathname === '/shared') {
		return shared;
	}

	return null;
}
