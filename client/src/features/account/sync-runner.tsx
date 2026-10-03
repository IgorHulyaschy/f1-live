import { useAlertSync } from '@/features/alerts/use-alert-sync';

import { useDashboardSync } from './dashboard-sync';

/** The signed-in session's background sync, in its own chunk so a first visit does not load it. */
export default function SyncRunner() {
	useDashboardSync();
	useAlertSync();

	return null;
}
