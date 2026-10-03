import * as React from 'react';
import { useSearchParams } from 'react-router';

import { SESSION_TYPE_LABEL } from '@/data/catalog';
import { useRaceView } from '@/data/race-context';
import { readDrill } from '@/features/drill/drill-url';

/**
 * The tab names the session and the open driver or lap, never a result, so a title read in a tab
 * bar, a bookmark or a shared preview spoils nothing.
 */
export function usePageTitle(): void {
	const { race } = useRaceView();
	const [searchParams] = useSearchParams();
	const view = readDrill(searchParams);
	const driver = view && race.drivers.find((entry) => entry.number === view.driverNumber);
	const meeting = race.session.meetingName.replace(/ Grand Prix$/, '');
	const session = race.session.name ?? SESSION_TYPE_LABEL[race.session.type];
	const year = new Date(race.session.startsAt).getUTCFullYear();

	const opened =
		view && driver ? `${driver.code}${view.kind === 'lap' ? ` lap ${view.lap}` : ''}, ` : '';

	const title = `${opened}${meeting} ${year} ${session} · Pitwall`;

	React.useEffect(() => {
		document.title = title;
	}, [title]);
}
