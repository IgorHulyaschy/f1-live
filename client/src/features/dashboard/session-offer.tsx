import * as React from 'react';
import { useNavigate } from 'react-router';

import { Key } from '@/components/console/keys';
import { SESSION_TYPE_LABEL } from '@/data/catalog';
import { useRaceView } from '@/data/race-context';

import { saveDashboard, useDashboards } from './dashboard-store';
import { type Dashboard, sessionKind } from './dashboards';
import { SESSION_PATH } from './paths';
import { SESSION_LAYOUT, sessionLayoutName, wantsSessionOffer } from './session-layouts';
import { useCarriedSearch } from './use-carried-search';

/** Offers waved away for now: by dashboard and session, until the page closes. */
const notNow = new Set<string>();

/**
 * On the viewer's own dashboard during a session it was not built for, one line offering the
 * session's own layout. The dashboard itself is never changed, except to stop asking.
 */
export function SessionOffer({ dashboard }: { dashboard: Dashboard }) {
	const { race, sessionKey } = useRaceView();
	const { dashboards } = useDashboards();
	const navigate = useNavigate();
	const search = useCarriedSearch();
	const [, setWaved] = React.useState(0);
	const kind = sessionKind(race.session.type);
	const offerKey = `${dashboard.id} ${sessionKey}`;

	if (!wantsSessionOffer(dashboard, kind) || notNow.has(offerKey)) {
		return null;
	}

	const layout = dashboards.find((entry) => entry.id === SESSION_LAYOUT[kind]);
	const layoutName = layout ? sessionLayoutName(layout, race.session.type) : 'session';
	const session = race.session.name ?? SESSION_TYPE_LABEL[race.session.type];

	return (
		<aside
			aria-label="Session layout"
			data-testid="session-offer"
			className="border-focus mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 py-1 pl-3"
		>
			<p className="text-sm">
				{dashboard.name} has tiles for other sessions; this is {session}.
			</p>
			<span className="flex flex-wrap gap-2">
				<Key pressed onClick={() => void navigate({ pathname: SESSION_PATH, search })}>
					Switch to the {layoutName} layout
				</Key>
				<Key
					onClick={() => {
						notNow.add(offerKey);
						setWaved((count) => count + 1);
					}}
				>
					Not now
				</Key>
				<Key
					title="For this dashboard, on every device it syncs to"
					onClick={() => saveDashboard({ ...dashboard, sessionOffer: false })}
				>
					Don’t ask again
				</Key>
			</span>
		</aside>
	);
}
