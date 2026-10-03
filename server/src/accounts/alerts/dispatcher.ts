import {
	type Alert,
	diffAlerts,
	inQuietHours,
	isForDriver,
	spoilsResult
} from '@f1-live/shared/alerts';
import type { RaceSnapshot, SessionStatus } from '@f1-live/shared';

import type { LiveSession } from '../../live/session.js';
import type { EventLog } from '../../sources/f1/live.js';
import type { AccountsDatabase } from '../db/database.js';
import type { PushPayload, PushSender } from './sender.js';
import { forgetDevice, loadRecipients, type Recipient } from './store.js';

/** Who gets alerts is read this often at most: alerts come in bursts, and sign-ups are slow. */
const RECIPIENTS_TTL_MS = 10_000;

/** Devices a burst is sent to at once; the push services answer in tens of milliseconds. */
const CONCURRENCY = 25;

/** At most this many pushes per alert batch for one account: a resync must not flood a phone. */
const MAX_PER_BATCH = 3;

export type Plan = { send: true; delayMs: number } | { send: false; reason: string };

/**
 * Whether an alert goes to one account's devices, and after how long. The rules, in order: the
 * alert's kind is on for push, it is about the driver they follow (or the track), a finished
 * session's result is not given away to someone protected from it, and the moment it will be
 * shown (after their delay) is not in their quiet hours.
 */
export function planPush(
	recipient: Pick<Recipient, 'settings' | 'viewer'>,
	alert: Alert,
	status: SessionStatus | undefined,
	now: Date
): Plan {
	const { settings, viewer } = recipient;

	if (!settings.push[alert.kind]) {
		return { send: false, reason: 'off' };
	}

	if (!isForDriver(alert, settings.driver)) {
		return { send: false, reason: 'other-driver' };
	}

	if (spoilsResult(alert, status, viewer)) {
		return { send: false, reason: 'spoiler' };
	}

	const delayMs = settings.delaySeconds * 1000;

	if (inQuietHours(settings.quiet, new Date(now.getTime() + delayMs))) {
		return { send: false, reason: 'quiet-hours' };
	}

	return { send: true, delayMs };
}

function payloadOf(alert: Alert): PushPayload {
	return { title: alert.title, body: alert.body, tag: alert.id, kind: alert.kind, url: '/' };
}

export interface DispatcherOptions {
	db: AccountsDatabase;
	sender: PushSender;
	session: LiveSession;
	log: EventLog;
	now?: () => Date;
	setTimer?: typeof setTimeout;
}

/**
 * Turns what the live session does into Web Push. It compares the session before and after
 * every batch of events (`diffAlerts`, the same rules the app's toasts use) and sends each alert
 * to the devices of accounts that asked for it. Delivery is best effort: a failure is logged,
 * never retried, because an alert that is late is wrong.
 */
export class AlertDispatcher {
	private readonly options: DispatcherOptions;
	private readonly now: () => Date;
	private readonly setTimer: typeof setTimeout;
	private readonly timers = new Set<NodeJS.Timeout>();
	private unsubscribe: (() => void) | null = null;
	private last: RaceSnapshot | null = null;
	private recipients: { loadedAt: number; value: Promise<Recipient[]> } | null = null;
	private closed = false;

	constructor(options: DispatcherOptions) {
		this.options = options;
		this.now = options.now ?? (() => new Date());
		this.setTimer = options.setTimer ?? setTimeout;
	}

	start(): void {
		this.last = this.options.session.current;
		this.unsubscribe = this.options.session.subscribe((update) => {
			const next = this.options.session.current;

			// A new session or a copy replaced whole is a new baseline, not news.
			if (update.kind === 'state') {
				this.last = next;

				return;
			}

			const alerts = diffAlerts(this.last, next);

			this.last = next;

			if (alerts.length > 0) {
				void this.deliver(alerts, next.status).catch((cause: unknown) =>
					this.options.log('push-failed', { message: String(cause) })
				);
			}
		});
	}

	/** Account settings or devices changed: the next alert reads them afresh. */
	changed(): void {
		this.recipients = null;
	}

	close(): void {
		this.closed = true;
		this.unsubscribe?.();

		for (const timer of this.timers) {
			clearTimeout(timer);
		}

		this.timers.clear();
	}

	private currentRecipients(): Promise<Recipient[]> {
		const cached = this.recipients;

		if (cached && Date.now() - cached.loadedAt < RECIPIENTS_TTL_MS) {
			return cached.value;
		}

		const value = loadRecipients(this.options.db);

		this.recipients = { loadedAt: Date.now(), value };

		return value;
	}

	private async deliver(alerts: readonly Alert[], status: SessionStatus | undefined) {
		const now = this.now();
		let planned = 0;

		for (const recipient of await this.currentRecipients()) {
			const batch = alerts
				.flatMap((alert) => {
					const plan = planPush(recipient, alert, status, now);

					return plan.send ? [{ alert, delayMs: plan.delayMs }] : [];
				})
				.slice(-MAX_PER_BATCH);

			for (const { alert, delayMs } of batch) {
				planned += recipient.devices.length;
				this.after(delayMs, () => this.sendToDevices(recipient, alert));
			}
		}

		if (planned > 0) {
			this.options.log('push-planned', { alerts: alerts.length, devices: planned });
		}
	}

	private after(delayMs: number, task: () => Promise<void>) {
		if (this.closed) {
			return;
		}

		const run = () =>
			void task().catch((cause: unknown) =>
				this.options.log('push-failed', { message: String(cause) })
			);

		if (delayMs === 0) {
			run();

			return;
		}

		const timer = this.setTimer(() => {
			this.timers.delete(timer);
			run();
		}, delayMs);

		timer.unref();
		this.timers.add(timer);
	}

	private async sendToDevices(recipient: Recipient, alert: Alert) {
		const payload = payloadOf(alert);
		const counts = { sent: 0, gone: 0, failed: 0 };

		for (let start = 0; start < recipient.devices.length; start += CONCURRENCY) {
			const results = await Promise.all(
				recipient.devices.slice(start, start + CONCURRENCY).map(async (device) => ({
					device,
					result: await this.options.sender.send(device, payload)
				}))
			);

			for (const { device, result } of results) {
				counts[result] += 1;

				if (result === 'gone') {
					await forgetDevice(this.options.db, device.endpoint);
					this.changed();
				}
			}
		}

		this.options.log('push-sent', { kind: alert.kind, ...counts });
	}
}
