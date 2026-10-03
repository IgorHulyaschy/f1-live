import { type Entitlements, PLAN_ENTITLEMENTS, type PlanId } from '@f1-live/shared/plans';
import { desc, eq } from 'drizzle-orm';

import type {
	BillingInterval,
	PaymentProviderName,
	SubscriptionStatus
} from '../payments/provider.js';
import type { AccountsDatabase } from './db/database.js';
import { subscription } from './db/schema.js';

/** Statuses the provider still collects for: a failed renewal keeps Pro while it retries. */
const LIVE_STATUSES: ReadonlySet<SubscriptionStatus> = new Set(['active', 'trialing', 'past_due']);

/** A renewal webhook can land a little after the period ends; Pro does not blink off meanwhile. */
const RENEWAL_GRACE_MS = 24 * 60 * 60 * 1000;

export type SubscriptionRecord = {
	provider: string;
	id: string;
	customerId: string;
	status: SubscriptionStatus;
	interval: BillingInterval | null;
	currentPeriodEnd: Date | null;
	cancelAtPeriodEnd: boolean;
};

export type AccountPlan = {
	plan: PlanId;
	entitlements: Entitlements;
	/** The subscription to show: the live one, else the latest. */
	subscription: SubscriptionRecord | null;
};

export function isLive(record: SubscriptionRecord, now: Date): boolean {
	return (
		LIVE_STATUSES.has(record.status) &&
		(record.currentPeriodEnd === null ||
			record.currentPeriodEnd.getTime() + RENEWAL_GRACE_MS > now.getTime())
	);
}

/** Pro while any subscription is live; Free otherwise. Records come newest first. */
export function planFor(records: readonly SubscriptionRecord[], now: Date): AccountPlan {
	const live = records.find((record) => isLive(record, now));
	const plan = live ? 'pro' : 'free';

	return { plan, entitlements: PLAN_ENTITLEMENTS[plan], subscription: live ?? records[0] ?? null };
}

export async function subscriptionsOf(
	db: AccountsDatabase,
	userId: string
): Promise<SubscriptionRecord[]> {
	return db
		.select({
			provider: subscription.provider,
			id: subscription.id,
			customerId: subscription.customerId,
			status: subscription.status,
			interval: subscription.interval,
			currentPeriodEnd: subscription.currentPeriodEnd,
			cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
		})
		.from(subscription)
		.where(eq(subscription.userId, userId))
		.orderBy(desc(subscription.updatedAt));
}

/** The provider's customer for this account, so a second checkout or the portal reuses it. */
export function customerOf(
	records: readonly SubscriptionRecord[],
	provider: PaymentProviderName
): string | null {
	return records.find((record) => record.provider === provider)?.customerId ?? null;
}
