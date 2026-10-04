import { useParams, useSearchParams } from 'react-router';

import { useRaceView } from '@/data/race-context';
import { SpoilerStart } from '@/features/session/spoiler-start';

import { saveDashboard, useDashboards } from './dashboard-store';
import { DashboardGrid } from './dashboard-grid';
import { SessionOffer } from './session-offer';
import { sessionLayoutId } from './session-layouts';

/**
 * A dashboard by id: the session's own layout at `/`, presets at their old addresses, everything
 * else under /d/:id.
 */
export function DashboardPage({ id: fixedId }: { id?: string }) {
	const params = useParams();
	const { race } = useRaceView();
	const id = fixedId ?? params.id ?? sessionLayoutId(race.session.type);
	const { dashboards } = useDashboards();
	const [searchParams] = useSearchParams();
	const dashboard = dashboards.find((entry) => entry.id === id);
	const editing = searchParams.get('edit') === '1';

	if (!dashboard) {
		return (
			<div className="text-muted-foreground border border-dashed p-8 text-sm" role="alert">
				This dashboard does not exist on this device. Dashboards are saved in the browser that made
				them; use Export and Import to move one.
			</div>
		);
	}

	return (
		<div data-testid={`dashboard-${dashboard.id}`}>
			<SpoilerStart />
			<SessionOffer dashboard={dashboard} />
			<h1 className="sr-only">{dashboard.name}</h1>
			<DashboardGrid dashboard={dashboard} editing={editing} onChange={saveDashboard} />
		</div>
	);
}
