import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingHttpHeaders } from 'node:http';
import { dirname } from 'node:path';

import { z } from 'zod';

import {
	BILLING_INTERVALS,
	type BillingInterval,
	type CheckoutRequest,
	type PaymentProvider,
	PaymentProviderError,
	type PortalRequest,
	type PriceInfo,
	type SubscriptionState,
	type WebhookNotice
} from './provider.js';
import { signPayload, verifySignature } from './signature.js';

export const FAKE_SIGNATURE_HEADER = 'fake-signature';

/** Posts a signed event to the webhook endpoint, as the real provider would. */
export type WebhookDelivery = (payload: string, signature: string) => Promise<void>;

export type FakeProviderOptions = {
	/** Where browsers reach `/api`; checkout and portal pages are served there. */
	publicUrl: string;
	webhookSecret: string;
	deliver: WebhookDelivery;
	/** Keeps subscriptions across restarts; omitted, they live in memory. */
	statePath: string | null;
	now?: () => Date;
};

export type FakeAction = 'cancel-at-period-end' | 'resume' | 'cancel-now';

const subscriptionRecord = z.object({
	id: z.string(),
	customerId: z.string(),
	userId: z.string(),
	status: z.enum(['active', 'canceled']),
	interval: z.enum(BILLING_INTERVALS),
	currentPeriodEnd: z.iso.datetime(),
	cancelAtPeriodEnd: z.boolean()
});

type FakeSubscription = z.infer<typeof subscriptionRecord>;

const savedState = z.object({ subscriptions: z.array(subscriptionRecord) });

type CheckoutSession = {
	id: string;
	request: CheckoutRequest;
	status: 'open' | 'paid' | 'abandoned';
};

type PortalSession = { id: string; customerId: string; returnUrl: string };

const fakeEvent = z.object({
	id: z.string(),
	type: z.string(),
	data: z.object({
		object: z.union([
			z.object({
				object: z.literal('checkout.session'),
				client_reference_id: z.string(),
				subscription: z.string()
			}),
			z.object({ object: z.literal('subscription'), id: z.string() })
		])
	})
});

/**
 * A payment provider for development and tests. Checkout is a local page with Pay and Cancel; a
 * payment or a change in the billing page sends a signed webhook, exactly like the real thing,
 * so the whole path from checkout to Pro runs with no account anywhere.
 */
export class FakeProvider implements PaymentProvider {
	readonly name = 'fake';
	private readonly options: FakeProviderOptions;
	private readonly now: () => Date;
	private readonly checkouts = new Map<string, CheckoutSession>();
	private readonly portals = new Map<string, PortalSession>();
	private readonly subscriptions = new Map<string, FakeSubscription>();

	constructor(options: FakeProviderOptions) {
		this.options = options;
		this.now = options.now ?? (() => new Date());

		for (const saved of this.load()) {
			this.subscriptions.set(saved.id, saved);
		}
	}

	async prices(): Promise<PriceInfo[]> {
		// Prices are the owner's to set; the fake provider has none to show.
		return BILLING_INTERVALS.map((interval) => ({ interval, amount: null, currency: null }));
	}

	async createCheckout(request: CheckoutRequest): Promise<{ url: string }> {
		const id = newId('cs_fake');

		this.checkouts.set(id, { id, request, status: 'open' });

		return { url: `${this.options.publicUrl}/api/billing/fake/checkout/${id}` };
	}

	async createPortal(request: PortalRequest): Promise<{ url: string }> {
		const id = newId('bps_fake');

		this.portals.set(id, { id, ...request });

		return { url: `${this.options.publicUrl}/api/billing/fake/portal/${id}` };
	}

	async parseWebhook(payload: string, headers: IncomingHttpHeaders): Promise<WebhookNotice | null> {
		const header = headers[FAKE_SIGNATURE_HEADER];

		verifySignature(
			payload,
			Array.isArray(header) ? header[0] : header,
			this.options.webhookSecret,
			Math.floor(this.now().getTime() / 1000)
		);

		const event = fakeEvent.parse(JSON.parse(payload));
		const object = event.data.object;

		return object.object === 'checkout.session'
			? {
					eventId: event.id,
					subscriptionId: object.subscription,
					userId: object.client_reference_id
				}
			: { eventId: event.id, subscriptionId: object.id, userId: null };
	}

	async getSubscription(subscriptionId: string): Promise<SubscriptionState> {
		const found = this.subscriptions.get(subscriptionId);

		if (!found) {
			throw new PaymentProviderError(`No fake subscription ${subscriptionId}`);
		}

		return {
			subscriptionId: found.id,
			customerId: found.customerId,
			userId: found.userId,
			status: found.status,
			interval: found.interval,
			currentPeriodEnd: new Date(found.currentPeriodEnd),
			cancelAtPeriodEnd: found.cancelAtPeriodEnd
		};
	}

	async cancelSubscription(subscriptionId: string): Promise<void> {
		await this.change(subscriptionId, 'cancel-now');
	}

	checkout(id: string): CheckoutSession | null {
		return this.checkouts.get(id) ?? null;
	}

	/** Pay: starts the subscription, sends the webhook and says where the buyer goes next. */
	async pay(checkoutId: string): Promise<string> {
		const session = this.openCheckout(checkoutId);
		const { request } = session;

		const subscription: FakeSubscription = {
			id: newId('sub_fake'),
			customerId: request.customerId ?? newId('cus_fake'),
			userId: request.userId,
			status: 'active',
			interval: request.interval,
			currentPeriodEnd: periodEnd(this.now(), request.interval).toISOString(),
			cancelAtPeriodEnd: false
		};

		this.subscriptions.set(subscription.id, subscription);
		this.save();
		session.status = 'paid';

		await this.send('checkout.session.completed', {
			object: 'checkout.session',
			id: session.id,
			client_reference_id: request.userId,
			customer: subscription.customerId,
			subscription: subscription.id
		});

		return request.successUrl;
	}

	abandon(checkoutId: string): string {
		const session = this.openCheckout(checkoutId);

		session.status = 'abandoned';

		return session.request.cancelUrl;
	}

	portal(id: string): { session: PortalSession; subscriptions: FakeSubscription[] } | null {
		const session = this.portals.get(id);

		if (!session) {
			return null;
		}

		const subscriptions = [...this.subscriptions.values()].filter(
			(entry) => entry.customerId === session.customerId
		);

		return { session, subscriptions };
	}

	async change(subscriptionId: string, action: FakeAction): Promise<void> {
		const found = this.subscriptions.get(subscriptionId);

		if (!found) {
			throw new PaymentProviderError(`No fake subscription ${subscriptionId}`);
		}

		const next: FakeSubscription =
			action === 'cancel-now'
				? { ...found, status: 'canceled', cancelAtPeriodEnd: false }
				: { ...found, cancelAtPeriodEnd: action === 'cancel-at-period-end' };

		this.subscriptions.set(subscriptionId, next);
		this.save();

		await this.send(
			action === 'cancel-now' ? 'customer.subscription.deleted' : 'customer.subscription.updated',
			{ object: 'subscription', id: next.id, customer: next.customerId }
		);
	}

	private openCheckout(id: string): CheckoutSession {
		const session = this.checkouts.get(id);

		if (!session || session.status !== 'open') {
			throw new PaymentProviderError('This checkout is closed');
		}

		return session;
	}

	private async send(type: string, object: Record<string, string>): Promise<void> {
		const payload = JSON.stringify({
			id: newId('evt_fake'),
			type,
			created: Math.floor(this.now().getTime() / 1000),
			data: { object }
		});

		const signature = signPayload(
			payload,
			this.options.webhookSecret,
			Math.floor(this.now().getTime() / 1000)
		);

		await this.options.deliver(payload, signature);
	}

	private load(): FakeSubscription[] {
		if (!this.options.statePath) {
			return [];
		}

		try {
			return savedState.parse(JSON.parse(readFileSync(this.options.statePath, 'utf8')))
				.subscriptions;
		} catch {
			return [];
		}
	}

	private save(): void {
		if (!this.options.statePath) {
			return;
		}

		mkdirSync(dirname(this.options.statePath), { recursive: true });
		writeFileSync(
			this.options.statePath,
			`${JSON.stringify({ subscriptions: [...this.subscriptions.values()] }, null, 2)}\n`
		);
	}
}

function newId(prefix: string): string {
	return `${prefix}_${randomBytes(12).toString('hex')}`;
}

function periodEnd(from: Date, interval: BillingInterval): Date {
	const end = new Date(from);

	if (interval === 'year') {
		end.setUTCFullYear(end.getUTCFullYear() + 1);
	} else {
		end.setUTCMonth(end.getUTCMonth() + 1);
	}

	return end;
}
