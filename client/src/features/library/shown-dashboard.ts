import * as React from 'react';
import { useLocation } from 'react-router';

import { useDashboards } from '../dashboard/dashboard-store';
import type { Dashboard } from '../dashboard/dashboards';
import { dashboardIdFromPath, safeDecode } from '../dashboard/paths';
import { COMMUNITY } from './community';
import { usePublished } from './library-data';
import { decodeShare } from './share';

/** The dashboard the current page shows: one of the viewer's, a library preview or a shared link. */
export function useShownDashboard(): Dashboard | null {
	const { pathname, search } = useLocation();
	const { dashboards } = useDashboards();
	const published = usePublished();
	const id = dashboardIdFromPath(pathname);
	const code = pathname === '/shared' ? new URLSearchParams(search).get('d') : null;
	// The header asks on every lap; decode a shared link once per link.
	const shared = React.useMemo(() => (code ? decodeShare(code) : null), [code]);

	if (id) {
		return dashboards.find((dashboard) => dashboard.id === id) ?? null;
	}

	const entryId = /^\/library\/([^/]+)$/.exec(pathname)?.[1];

	if (entryId) {
		const decoded = safeDecode(entryId);

		return [...published, ...COMMUNITY].find((entry) => entry.id === decoded)?.dashboard ?? null;
	}

	if (pathname === '/shared') {
		return shared;
	}

	return null;
}
