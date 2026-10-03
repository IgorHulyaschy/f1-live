import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Stripe } from 'stripe';

import { WebhookSignatureError } from './provider.js';
import { StripeProvider, subscriptionState } from './stripe-provider.js';

// Placeholders: nothing here reaches Stripe.
const WEBHOOK_SECRET = 'whsec_unit_test_only';

const provider = new StripeProvider({
	secretKey: 'sk_test_unit_placeholder',
	webhookSecret: WEBHOOK_SECRET,
	priceIds: { month: 'price_month_placeholder', year: 'price_year_placeholder' }
});

function signed(event: { id: string; type: string; object: object }) {
	const payload = JSON.stringify({
		id: event.id,
		object: 'event',
		type: event.type,
		data: { object: event.object }
	});

	const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });

	return { payload, headers: { 'stripe-signature': header } };
}

describe('StripeProvider webhooks', () => {
	it('reads the account and subscription from a completed checkout', async () => {
		const { payload, headers } = signed({
			id: 'evt_checkout',
			type: 'checkout.session.completed',
			object: {
				object: 'checkout.session',
				mode: 'subscription',
				client_reference_id: 'user-1',
				subscription: 'sub_1'
			}
		});

		assert.deepEqual(await provider.parseWebhook(payload, headers), {
			eventId: 'evt_checkout',
			subscriptionId: 'sub_1',
			userId: 'user-1'
		});
	});

	it('reads the subscription from its own events, with the account from its metadata', async () => {
		const { payload, headers } = signed({
			id: 'evt_updated',
			type: 'customer.subscription.updated',
			object: { object: 'subscription', id: 'sub_1', metadata: { userId: 'user-1' } }
		});

		assert.deepEqual(await provider.parseWebhook(payload, headers), {
			eventId: 'evt_updated',
			subscriptionId: 'sub_1',
			userId: 'user-1'
		});
	});

	it('ignores events that change no plan', async () => {
		const { payload, headers } = signed({
			id: 'evt_invoice',
			type: 'invoice.created',
			object: { object: 'invoice', id: 'in_1' }
		});

		assert.equal(await provider.parseWebhook(payload, headers), null);
	});

	it('refuses a payload that Stripe did not sign', async () => {
		const { payload, headers } = signed({
			id: 'evt_checkout',
			type: 'checkout.session.completed',
			object: { object: 'checkout.session', mode: 'subscription', client_reference_id: 'u' }
		});

		await assert.rejects(
			provider.parseWebhook(payload.replace('"u"', '"someone-else"'), headers),
			WebhookSignatureError
		);
		await assert.rejects(provider.parseWebhook(payload, {}), WebhookSignatureError);
	});
});

describe('subscriptionState', () => {
	const base = {
		id: 'sub_1',
		customer: 'cus_1',
		status: 'active',
		cancel_at_period_end: false,
		metadata: { userId: 'user-1' },
		items: {
			data: [{ current_period_end: 1_793_000_000, price: { recurring: { interval: 'year' } } }]
		}
	};

	it('maps the period, interval, account and cancellation', () => {
		assert.deepEqual(subscriptionState({ ...base, cancel_at_period_end: true }), {
			subscriptionId: 'sub_1',
			customerId: 'cus_1',
			userId: 'user-1',
			status: 'active',
			interval: 'year',
			currentPeriodEnd: new Date(1_793_000_000 * 1000),
			cancelAtPeriodEnd: true
		});
	});

	const status = (value: string) => subscriptionState({ ...base, status: value }).status;

	it('narrows Stripe statuses to the ones that decide a plan', () => {
		assert.equal(status('past_due'), 'past_due');
		assert.equal(status('unpaid'), 'incomplete');
		assert.equal(status('incomplete_expired'), 'canceled');
		assert.equal(status('paused'), 'incomplete');
		assert.equal(status('something_new'), 'incomplete');
	});
});
