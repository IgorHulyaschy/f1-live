import * as React from 'react';
import { useSearchParams } from 'react-router';

import { SESSION_TYPE_LABEL } from '@/data/catalog';
import { useRaceView } from '@/data/race-context';
import { readDrill } from '@/features/drill/drill-url';
import { setViewTitle } from '@/platform/page-meta';

/**
 * With a driver or lap view open, the tab and share card name it and its session, never a
 * result, so a title read in a tab bar or a shared preview spoils nothing.
 */
export function useViewTitle(): void {
	const { race } = useRaceView();
	const [searchParams] = useSearchParams();
	const view = readDrill(searchParams);
	const driver = view && race.drivers.find((entry) => entry.number === view.driverNumber);
	const meeting = race.session.meetingName.replace(/ Grand Prix$/, '');
	const session = race.session.name ?? SESSION_TYPE_LABEL[race.session.type];
	const year = new Date(race.session.startsAt).getUTCFullYear();
	const lap = view?.kind === 'lap' ? ` lap ${view.lap}` : '';

	const title = view && driver ? `${driver.code}${lap}, ${meeting} ${year} ${session}` : null;

	React.useEffect(() => {
		setViewTitle(title);

		return () => setViewTitle(null);
	}, [title]);
}
