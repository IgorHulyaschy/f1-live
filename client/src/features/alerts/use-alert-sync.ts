import * as React from 'react';

import { useChosenDriver } from '@/data/race-context';
import { useAccount } from '@/features/account/account-store';

import { alertSettingsStore, changeAlertSettings } from './alert-settings';
import { fetchAlerts, registerDevice, saveAlertSettings } from './alerts-api';
import { currentSubscription } from './push';

/** Edits are sent this long after the last change, so a slider is one request. */
const SAVE_DELAY_MS = 800;

/**
 * Keeps the alert settings of this browser and the account in step. The driver in them is always
 * the one this viewer follows, so the server pushes about the right car. Signed in, the account's
 * settings are taken on first (another device may have set them) and every change after goes up;
 * this browser's push subscription is registered again, so a server that lost it learns it back.
 */
export function useAlertSync(): void {
	const account = useAccount();
	const accountId = account.status === 'signed-in' ? account.me.user.id : null;
	const driver = useChosenDriver();
	const settings = alertSettingsStore.useValue();
	const [adopted, setAdopted] = React.useState<string | null>(null);

	React.useEffect(() => {
		if (settings.driver !== driver) {
			changeAlertSettings((current) => ({ ...current, driver }));
		}
	}, [driver, settings.driver]);

	React.useEffect(() => {
		if (!accountId) {
			setAdopted(null);

			return;
		}

		let current = true;

		void (async () => {
			try {
				const remote = await fetchAlerts();

				if (!current) {
					return;
				}

				if (remote.settings) {
					// The account's choices, about the driver this viewer follows now.
					alertSettingsStore.set({ ...remote.settings, driver });
				}

				const subscription = await currentSubscription();

				if (subscription && Notification.permission === 'granted') {
					await registerDevice(subscription.toJSON());
				}

				setAdopted(accountId);
			} catch {
				// No accounts server or a blip: settings stay here and go up with the next change.
			}
		})();

		return () => {
			current = false;
		};
		// The driver is read once, at adoption; later changes travel through the settings.
		// oxlint-disable-next-line react-hooks/exhaustive-deps -- the driver is read once, at adoption
	}, [accountId]);

	const sent = React.useRef<string | null>(null);

	React.useEffect(() => {
		const text = JSON.stringify(settings);

		if (!accountId || adopted !== accountId || sent.current === text) {
			return;
		}

		const timer = window.setTimeout(() => {
			sent.current = text;
			void saveAlertSettings(settings).catch(() => {
				sent.current = null;
			});
		}, SAVE_DELAY_MS);

		return () => window.clearTimeout(timer);
	}, [settings, accountId, adopted]);
}
