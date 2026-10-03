import type { IncomingHttpHeaders } from 'node:http';

/**
 * A payment provider as the accounts server sees it: a hosted checkout, a hosted page to manage
 * billing, signed webhooks, and the current state of a subscription. Stripe and the fake provider
 * implement it; a merchant of record (Paddle, Lemon Squeezy) fits the same shape.
 */
export interface PaymentProvider {
	readonly name: PaymentProviderName;
	/** Prices to show before checkout; `null` amounts when the provider does not say. */
	prices(): Promise<PriceInfo[]>;
	createCheckout(request: CheckoutRequest): Promise<{ url: string }>;
	createPortal(request: PortalRequest): Promise<{ url: string }>;
	/**
	 * Checks the signature and reads which subscription an event is about. Returns null for events
	 * that change nothing here; throws `WebhookSignatureError` when the payload is not genuine.
	 */
	parseWebhook(payload: string, headers: IncomingHttpHeaders): Promise<WebhookNotice | null>;
	/** The provider's current view, so late or out-of-order webhooks never roll a plan back. */
	getSubscription(subscriptionId: string): Promise<SubscriptionState>;
	/** Ends a subscription now, with no renewal: used when an account is deleted. */
	cancelSubscription(subscriptionId: string): Promise<void>;
}

export type PaymentProviderName = 'stripe' | 'fake';

export const BILLING_INTERVALS = ['month', 'year'] as const;

export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/** Provider statuses, narrowed to what decides a plan. */
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';

export type PriceInfo = {
	interval: BillingInterval;
	/** In the currency's minor unit (cents). */
	amount: number | null;
	currency: string | null;
};

export type CheckoutRequest = {
	userId: string;
	email: string;
	interval: BillingInterval;
	/** Reuses the provider's customer when this account paid before. */
	customerId: string | null;
	successUrl: string;
	cancelUrl: string;
};

export type PortalRequest = { customerId: string; returnUrl: string };

export type WebhookNotice = {
	eventId: string;
	subscriptionId: string;
	/** Present when the event itself names the account (checkout), else read from the subscription. */
	userId: string | null;
};

export type SubscriptionState = {
	subscriptionId: string;
	customerId: string;
	/** The account the subscription was bought for, as recorded at checkout. */
	userId: string | null;
	status: SubscriptionStatus;
	interval: BillingInterval | null;
	currentPeriodEnd: Date | null;
	cancelAtPeriodEnd: boolean;
};

export class WebhookSignatureError extends Error {
	override readonly name = 'WebhookSignatureError';
}

export class PaymentProviderError extends Error {
	override readonly name = 'PaymentProviderError';
}
