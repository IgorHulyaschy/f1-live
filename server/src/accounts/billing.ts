import { and, eq } from 'drizzle-orm';

import type { PaymentProvider, WebhookNotice } from '../payments/provider.js';
import type { EventLog } from '../sources/f1/live.js';
import type { AccountsDatabase } from './db/database.js';
import { subscription, user } from './db/schema.js';

/**
 * Records what a webhook is about. The event only names the subscription; its state is read
 * back from the provider, so a late or repeated delivery can never roll a plan back.
 */
export async function applyWebhook(
	db: AccountsDatabase,
	provider: PaymentProvider,
	notice: WebhookNotice,
	log: EventLog
): Promise<void> {
	const state = await provider.getSubscription(notice.subscriptionId);

	const known = await db
		.select({ userId: subscription.userId })
		.from(subscription)
		.where(
			and(eq(subscription.provider, provider.name), eq(subscription.id, state.subscriptionId))
		);

	const userId = state.userId ?? notice.userId ?? known[0]?.userId ?? null;

	const [owner] = userId
		? await db.select({ id: user.id }).from(user).where(eq(user.id, userId))
		: [];

	if (!owner) {
		// Bought for an account deleted before this event arrived: nobody may be billed for it.
		if (userId && state.status !== 'canceled') {
			await provider.cancelSubscription(state.subscriptionId);
			log('billing-orphan-cancelled', { subscription: state.subscriptionId });

			return;
		}

		// Ended already, or bought outside the app: nothing to update.
		log('billing-webhook-ignored', { event: notice.eventId, subscription: state.subscriptionId });

		return;
	}

	const values = {
		userId: owner.id,
		customerId: state.customerId,
		status: state.status,
		interval: state.interval,
		currentPeriodEnd: state.currentPeriodEnd,
		cancelAtPeriodEnd: state.cancelAtPeriodEnd
	};

	await db
		.insert(subscription)
		.values({ provider: provider.name, id: state.subscriptionId, ...values })
		.onConflictDoUpdate({ target: [subscription.provider, subscription.id], set: values });

	log('billing-webhook', {
		event: notice.eventId,
		subscription: state.subscriptionId,
		status: state.status
	});
}
