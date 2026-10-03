import {
	type AlertSettings,
	alertSettingsSchema,
	DEFAULT_ALERT_SETTINGS
} from '@f1-live/shared/alert-settings';

import { createLocalStore } from '@/lib/local-store';

function browserTimeZone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return DEFAULT_ALERT_SETTINGS.quiet.timeZone;
	}
}

/** Toasts are on and pushes are as the server defaults them; quiet hours follow this browser's zone. */
const INITIAL: AlertSettings = {
	...DEFAULT_ALERT_SETTINGS,
	quiet: { ...DEFAULT_ALERT_SETTINGS.quiet, timeZone: browserTimeZone() }
};

/**
 * The alert settings kept in this browser. Signed in, they are also kept on the account (and
 * read by the server when it pushes), so every device agrees.
 */
export const alertSettingsStore = createLocalStore<AlertSettings>(
	'pitwall-alerts',
	alertSettingsSchema,
	INITIAL
);

export function changeAlertSettings(change: (settings: AlertSettings) => AlertSettings): void {
	alertSettingsStore.set(change(alertSettingsStore.get()));
}
