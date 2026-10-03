import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PLAN_ENTITLEMENTS } from '@f1-live/shared/plans';

import { planFor, type SubscriptionRecord } from './entitlements.js';

const NOW = new Date('2026-10-03T12:00:00.000Z');

const days = (count: number) => new Date(NOW.getTime() + count * 24 * 60 * 60 * 1000);

function record(overrides: Partial<SubscriptionRecord>): SubscriptionRecord {
	return {
		provider: 'fake',
		id: 'sub_1',
		customerId: 'cus_1',
		status: 'active',
		interval: 'month',
		currentPeriodEnd: days(20),
		cancelAtPeriodEnd: false,
		...overrides
	};
}

describe('planFor', () => {
	it('is Free with the docs default limits when nothing was ever bought', () => {
		const plan = planFor([], NOW);

		assert.equal(plan.plan, 'free');
		assert.deepEqual(plan.entitlements, {
			ownDashboards: 3,
			shareLinks: true,
			proTiles: false,
			publish: false
		});
		assert.equal(plan.subscription, null);
	});

	it('is Pro with any number of dashboards while a subscription is active or trialing', () => {
		for (const status of ['active', 'trialing'] as const) {
			const plan = planFor([record({ status })], NOW);

			assert.equal(plan.plan, 'pro');
			assert.deepEqual(plan.entitlements, PLAN_ENTITLEMENTS.pro);
		}
	});

	it('keeps Pro while a failed renewal is retried, and until a cancelled period ends', () => {
		assert.equal(planFor([record({ status: 'past_due' })], NOW).plan, 'pro');
		assert.equal(planFor([record({ cancelAtPeriodEnd: true })], NOW).plan, 'pro');
	});

	it('ends Pro when the provider cancels, or a day after an unrenewed period ends', () => {
		assert.equal(planFor([record({ status: 'canceled' })], NOW).plan, 'free');
		assert.equal(planFor([record({ status: 'incomplete' })], NOW).plan, 'free');
		assert.equal(planFor([record({ currentPeriodEnd: days(-0.5) })], NOW).plan, 'pro');
		assert.equal(planFor([record({ currentPeriodEnd: days(-2) })], NOW).plan, 'free');
	});

	it('shows the live subscription over a newer cancelled one', () => {
		const cancelled = record({ id: 'sub_2', status: 'canceled' });
		const live = record({ id: 'sub_1' });

		assert.equal(planFor([cancelled, live], NOW).subscription?.id, 'sub_1');
		assert.equal(planFor([cancelled], NOW).subscription?.id, 'sub_2');
	});
});
