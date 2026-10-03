import type { RaceSnapshot } from '@f1-live/shared';
import * as React from 'react';
import { toast } from 'sonner';

import { useRace } from '@/data/race-context';
import { alertSettingsStore } from '@/features/alerts/alert-settings';
import { standingsAt } from '@/insights/standings';

/** The rules load on the first change worth checking, not with the first screen. */
const loadRules = () => import('@f1-live/shared/alerts');

/** A burst, such as the catch-up after a dropped connection, shows the latest few, not a wall. */
const MAX_TOASTS = 3;

type Seen = { snapshot: RaceSnapshot; lap: number; live: boolean; position: number | null };

/**
 * Toasts what matters as the session moves forward: the alerts the viewer switched on (pit stop,
 * flag, penalty, retirement and session start; the same rules the server pushes by), and the
 * followed driver's change of place. Live, every update counts; in a replay, one lap at a time.
 * Jumps and rewinds stay quiet.
 */
export function useRaceAlerts(): void {
	const { snapshot, lap, followedDriver, live } = useRace();
	const settings = alertSettingsStore.useValue();
	const seen = React.useRef<Seen | null>(null);

	React.useEffect(() => {
		const row = standingsAt(snapshot).find((entry) => entry.driver.number === followedDriver);
		const before = seen.current;

		seen.current = { snapshot, lap, live: live.isLive, position: row?.position ?? null };

		if (!before || before.snapshot === snapshot || before.live !== live.isLive) {
			return;
		}

		if (!live.isLive && lap !== before.lap + 1) {
			return;
		}

		const previous = before.snapshot;

		void (async () => {
			const { diffAlerts, isForDriver } = await loadRules();

			const alerts = diffAlerts(previous, snapshot)
				.filter((alert) => settings.toast[alert.kind] && isForDriver(alert, followedDriver))
				.slice(-MAX_TOASTS);

			for (const alert of alerts) {
				toast(alert.title, { description: alert.body, id: alert.id });
			}
		})();

		if (
			row &&
			row.state !== 'out' &&
			before.position !== null &&
			row.position !== before.position
		) {
			const gained = before.position - row.position;

			toast(`${row.driver.code} ${gained > 0 ? 'up' : 'down'} to P${row.position}`, {
				description: `${Math.abs(gained)} ${Math.abs(gained) === 1 ? 'place' : 'places'} on lap ${lap}.`,
				id: `pos-${row.driver.number}-${lap}`
			});
		}
	}, [snapshot, lap, followedDriver, live.isLive, settings]);
}
