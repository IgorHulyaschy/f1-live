import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { useRace } from '@/data/race-context';

import { newId, saveDashboard, useDashboards } from './dashboard-store';
import { type Dashboard, isPreset } from './dashboards';
import { dashboardPath } from './paths';

/** Dashboards of their own a Free viewer keeps; presets do not count. Pro keeps any number. */
export const FREE_OWN_DASHBOARDS = 3;

/**
 * Saves a new dashboard of the viewer's own under a fresh id and opens it, unless Free is full:
 * then it says so once and offers Pro, and returns false.
 */
export function useAddDashboard(): (dashboard: Dashboard, options?: { edit?: boolean }) => boolean {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { plan, setPlan } = useRace();
	const { dashboards } = useDashboards();
	const own = dashboards.filter((dashboard) => !isPreset(dashboard.id)).length;

	return (dashboard, { edit = false } = {}) => {
		if (plan === 'free' && own >= FREE_OWN_DASHBOARDS) {
			toast(`Free keeps ${FREE_OWN_DASHBOARDS} dashboards of your own`, {
				description: 'Delete one to make room, or preview Pro to keep any number.',
				action: { label: 'Preview Pro', onClick: () => setPlan('pro') }
			});

			return false;
		}

		const id = newId('board');

		saveDashboard({ ...dashboard, id });

		const params = new URLSearchParams(searchParams);

		params.delete('d');
		params.delete('edit');

		if (edit) {
			params.set('edit', '1');
		}

		void navigate({ pathname: dashboardPath(id), search: params.toString() });

		return true;
	};
}
