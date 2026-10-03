import { canAddOwnDashboard } from '@f1-live/shared/plans';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { useEntitlements } from '@/features/account/account-store';
import { useGoPro } from '@/features/account/go-pro';

import { newId, saveDashboard, useDashboards } from './dashboard-store';
import { type Dashboard, isPreset } from './dashboards';
import { dashboardPath } from './paths';

/**
 * Saves a new dashboard of the viewer's own under a fresh id and opens it, unless the plan is
 * full: then it says so once and offers Pro, and returns false. The account server holds the
 * same limit, so this only saves a round trip.
 */
export function useAddDashboard(): (dashboard: Dashboard, options?: { edit?: boolean }) => boolean {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const entitlements = useEntitlements();
	const goPro = useGoPro();
	const { dashboards } = useDashboards();
	const own = dashboards.filter((dashboard) => !isPreset(dashboard.id)).length;

	return (dashboard, { edit = false } = {}) => {
		if (!canAddOwnDashboard(entitlements, own)) {
			toast(`Free keeps ${entitlements.ownDashboards} dashboards of your own`, {
				description: 'Delete one to make room, or go Pro to keep any number.',
				action: { label: 'Go Pro', onClick: goPro }
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

/** Starts a new dashboard, empty or copied from another, and opens it in edit mode. */
export function useCreateDashboard(): (from?: Dashboard) => void {
	const add = useAddDashboard();

	return (from) => {
		add(
			from
				? { ...from, name: `${from.name} copy`.slice(0, 40) }
				: { id: 'new', name: 'My dashboard', tiles: [], layout: [] },
			{ edit: true }
		);
	};
}
