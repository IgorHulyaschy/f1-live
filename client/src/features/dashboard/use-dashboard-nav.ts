import * as React from 'react';

import { useRaceView } from '@/data/race-context';

import { useDashboards } from './dashboard-store';
import { dashboardNav, type DashboardNav, type NavEntry } from './session-layouts';

/** The dashboards in the order the top bar, the number keys and ⌘K offer them. */
export function useDashboardNav(): DashboardNav & { all: NavEntry[] } {
	const { dashboards } = useDashboards();
	const { race } = useRaceView();
	const type = race.session.type;

	return React.useMemo(() => {
		const { tabs, more } = dashboardNav(dashboards, type);

		return { tabs, more, all: [...tabs, ...more] };
	}, [dashboards, type]);
}
