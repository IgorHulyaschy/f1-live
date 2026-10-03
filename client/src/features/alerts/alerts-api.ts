import { type AlertSettings, alertSettingsSchema } from '@f1-live/shared/alert-settings';
import { z } from 'zod';

import { json, send } from '../account/api';

const deviceSchema = z.object({
	endpoint: z.string(),
	userAgent: z.string().nullable(),
	createdAt: z.iso.datetime()
});

export type Device = z.infer<typeof deviceSchema>;

const devicesReply = z.object({ devices: z.array(deviceSchema) });

/** The account's alert settings (null before the first save) and the browsers registered for push. */
export async function fetchAlerts(): Promise<{
	settings: AlertSettings | null;
	devices: Device[];
}> {
	return json(
		await send('GET', '/api/me/alerts'),
		z.object({ settings: alertSettingsSchema.nullable(), devices: z.array(deviceSchema) })
	);
}

export async function saveAlertSettings(settings: AlertSettings): Promise<void> {
	await json(
		await send('PUT', '/api/me/alerts', JSON.stringify(settings)),
		z.object({ settings: alertSettingsSchema })
	);
}

/** Registers this browser's push subscription; the answer is every device of the account. */
export async function registerDevice(subscription: PushSubscriptionJSON): Promise<Device[]> {
	return (
		await json(
			await send(
				'POST',
				'/api/me/push',
				JSON.stringify({ subscription, userAgent: navigator.userAgent.slice(0, 200) })
			),
			devicesReply
		)
	).devices;
}

export async function removeDevice(endpoint: string): Promise<Device[]> {
	return (
		await json(await send('DELETE', '/api/me/push', JSON.stringify({ endpoint })), devicesReply)
	).devices;
}

export type TestResult = { sent: number; gone: number; failed: number; devices: number };

/** Sends a test notice to every device of the account. */
export async function sendTestPush(): Promise<TestResult> {
	return json(
		await send('POST', '/api/me/push/test', JSON.stringify({})),
		z.object({ sent: z.int(), gone: z.int(), failed: z.int(), devices: z.int() })
	);
}
