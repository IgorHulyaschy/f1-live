import type { IncomingHttpHeaders } from 'node:http';

import { Stripe } from 'stripe';
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
	type SubscriptionStatus,
	type WebhookNotice,
	WebhookSignatureError
} from './provider.js';

export type StripeProviderOptions = {
	secretKey: string;
	webhookSecret: string;
	/** Stripe price ids for Pro, one per billing interval. */
	priceIds: Record<BillingInterval, string>;
};

const PRICE_CACHE_MS = 10 * 60 * 1000;

const CHECKOUT_MINUTES = 30;

/** A reference Stripe sends either as an id or, when expanded, as the object. */
const stripeRef = z.union([z.string(), z.object({ id: z.string() }).transform((ref) => ref.id)]);

/** The parts of a Stripe subscription this server reads, checked rather than trusted. */
const stripeSubscription = z.object({
	id: z.string(),
	customer: stripeRef,
	status: z.string(),
	cancel_at_period_end: z.boolean(),
	metadata: z.record(z.string(), z.string()).nullable(),
	items: z.object({
		data: z.array(
			z.object({
				current_period_end: z.number(),
				price: z.object({
					recurring: z.object({ interval: z.string() }).nullable()
				})
			})
		)
	})
});

export type StripeSubscription = z.infer<typeof stripeSubscription>;

const checkoutCompleted = z.object({
	mode: z.string(),
	client_reference_id: z.string().nullable(),
	subscription: stripeRef.nullable()
});

const subscriptionEvent = z.object({ id: z.string(), metadata: z.record(z.string(), z.string()) });

const SUBSCRIPTION_EVENTS = new Set([
	'customer.subscription.created',
	'customer.subscription.updated',
	'customer.subscription.deleted',
	'customer.subscription.paused',
	'customer.subscription.resumed'
]);

/** Stripe Checkout for buying Pro, the Stripe customer portal for changing or cancelling it. */
export class StripeProvider implements PaymentProvider {
	readonly name = 'stripe';
	private readonly stripe: Stripe;
	private readonly options: StripeProviderOptions;
	private priceCache: { at: number; prices: PriceInfo[] } | null = null;

	constructor(options: StripeProviderOptions) {
		this.options = options;
		this.stripe = new Stripe(options.secretKey);
	}

	async prices(): Promise<PriceInfo[]> {
		if (this.priceCache && Date.now() - this.priceCache.at < PRICE_CACHE_MS) {
			return this.priceCache.prices;
		}

		const prices = await Promise.all(
			BILLING_INTERVALS.map(async (interval): Promise<PriceInfo> => {
				try {
					const price = await this.stripe.prices.retrieve(this.options.priceIds[interval]);

					return { interval, amount: price.unit_amount, currency: price.currency };
				} catch {
					return { interval, amount: null, currency: null };
				}
			})
		);

		this.priceCache = { at: Date.now(), prices };

		return prices;
	}

	async createCheckout(request: CheckoutRequest): Promise<{ url: string }> {
		const session = await this.call(() =>
			this.stripe.checkout.sessions.create({
				mode: 'subscription',
				line_items: [{ price: this.options.priceIds[request.interval], quantity: 1 }],
				client_reference_id: request.userId,
				...(request.customerId
					? { customer: request.customerId }
					: { customer_email: request.email }),
				subscription_data: { metadata: { userId: request.userId } },
				// Stripe's shortest: a checkout left open in another tab cannot buy Pro twice a day later.
				expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_MINUTES * 60,
				success_url: request.successUrl,
				cancel_url: request.cancelUrl
			})
		);

		if (!session.url) {
			throw new PaymentProviderError('Stripe returned a checkout without a URL');
		}

		return { url: session.url };
	}

	async createPortal(request: PortalRequest): Promise<{ url: string }> {
		const session = await this.call(() =>
			this.stripe.billingPortal.sessions.create({
				customer: request.customerId,
				return_url: request.returnUrl
			})
		);

		return { url: session.url };
	}

	async parseWebhook(payload: string, headers: IncomingHttpHeaders): Promise<WebhookNotice | null> {
		const header = headers['stripe-signature'];
		let event: Stripe.Event;

		try {
			event = this.stripe.webhooks.constructEvent(
				payload,
				Array.isArray(header) ? (header[0] ?? '') : (header ?? ''),
				this.options.webhookSecret
			);
		} catch (error) {
			throw new WebhookSignatureError(
				error instanceof Error ? error.message : 'Stripe signature check failed'
			);
		}

		return noticeFromEvent(event);
	}

	async getSubscription(subscriptionId: string): Promise<SubscriptionState> {
		const subscription = await this.call(() => this.stripe.subscriptions.retrieve(subscriptionId));

		return subscriptionState(stripeSubscription.parse(subscription));
	}

	async cancelSubscription(subscriptionId: string): Promise<void> {
		const current = await this.getSubscription(subscriptionId);

		if (current.status !== 'canceled') {
			await this.call(() => this.stripe.subscriptions.cancel(subscriptionId));
		}
	}

	private async call<Result>(request: () => Promise<Result>): Promise<Result> {
		try {
			return await request();
		} catch (error) {
			throw new PaymentProviderError(
				error instanceof Error ? `Stripe: ${error.message}` : 'Stripe request failed',
				{ cause: error }
			);
		}
	}
}

/** Reads which subscription an event is about; other events change nothing here. */
function noticeFromEvent(event: Stripe.Event): WebhookNotice | null {
	if (event.type === 'checkout.session.completed') {
		const session = checkoutCompleted.parse(event.data.object);

		if (session.mode !== 'subscription' || !session.subscription) {
			return null;
		}

		return {
			eventId: event.id,
			subscriptionId: session.subscription,
			userId: session.client_reference_id
		};
	}

	if (SUBSCRIPTION_EVENTS.has(event.type)) {
		const subscription = subscriptionEvent.parse(event.data.object);

		return {
			eventId: event.id,
			subscriptionId: subscription.id,
			userId: subscription.metadata.userId ?? null
		};
	}

	return null;
}

export function subscriptionState(subscription: StripeSubscription): SubscriptionState {
	const item = subscription.items.data[0];
	const interval = item?.price.recurring?.interval;

	return {
		subscriptionId: subscription.id,
		customerId: subscription.customer,
		userId: subscription.metadata?.userId ?? null,
		status: planStatus(subscription.status),
		interval: BILLING_INTERVALS.find((known) => known === interval) ?? null,
		currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
		cancelAtPeriodEnd: subscription.cancel_at_period_end
	};
}

/** Stripe's statuses, narrowed to the ones that decide a plan; an unknown one is not Pro. */
function planStatus(status: string): SubscriptionStatus {
	switch (status) {
		case 'active':
		case 'trialing':
		case 'past_due':
		case 'canceled':
			return status;
		case 'incomplete_expired':
			return 'canceled';
		default:
			return 'incomplete';
	}
}
