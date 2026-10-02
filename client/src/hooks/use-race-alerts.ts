import * as React from 'react';
import { toast } from 'sonner';

import { useRace } from '@/data/race-context';
import { standingsAt } from '@/insights/standings';

const ALERT_CATEGORIES = new Set(['safety_car', 'penalty', 'flag']);

/**
 * Toasts what matters as the race moves forward one lap at a time: neutralisations, penalties,
 * flags, and the followed driver's stops and position changes. Jumps and rewinds stay quiet.
 */
export function useRaceAlerts(): void {
	const { snapshot, lap, followedDriver } = useRace();
	const previous = React.useRef<{ lap: number; position: number | null }>({ lap, position: null });

	React.useEffect(() => {
		const row = standingsAt(snapshot).find((entry) => entry.driver.number === followedDriver);
		const before = previous.current;

		previous.current = { lap, position: row?.position ?? null };

		if (lap !== before.lap + 1) {
			return;
		}

		for (const message of snapshot.raceControl) {
			if (message.lap === lap && ALERT_CATEGORIES.has(message.category)) {
				toast(message.message, {
					description: `Race control · lap ${lap}`,
					id: `${lap}-${message.message}`
				});
			}
		}

		if (!row || row.state === 'out') {
			return;
		}

		if (row.lastLap?.pitIn) {
			toast(`${row.driver.code} is in the pits`, {
				description: `Stop ${row.pitStops} on lap ${lap}, from P${row.position}.`,
				id: `pit-${row.driver.number}-${lap}`
			});
		} else if (before.position !== null && row.position !== before.position) {
			const gained = before.position - row.position;

			toast(`${row.driver.code} ${gained > 0 ? 'up' : 'down'} to P${row.position}`, {
				description: `${Math.abs(gained)} ${Math.abs(gained) === 1 ? 'place' : 'places'} on lap ${lap}.`,
				id: `pos-${row.driver.number}-${lap}`
			});
		}
	}, [snapshot, lap, followedDriver]);
}
