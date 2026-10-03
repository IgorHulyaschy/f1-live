import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { PLAN_ENTITLEMENTS } from '@f1-live/shared/plans';
import { eq } from 'drizzle-orm';

import { FAKE_SIGNATURE_HEADER, FakeProvider } from '../payments/fake-provider.js';
import { PaymentProviderError } from '../payments/provider.js';
import { deleteAccount, exportAccount } from './account-data.js';
import { applyWebhook } from './billing.js';
import { writeDocument } from './dashboards.js';
import { type OpenDatabase, openDatabase } from './db/database.js';
import { dashboard, session, subscription, user, verification } from './db/schema.js';

const NOW = new Date('2026-10-03T12:00:00.000Z');

const quiet = () => undefined;

let database: OpenDatabase;

before(async () => {
	database = await openDatabase({ kind: 'pglite', dataDir: null });
});

after(async () => {
	await database.close();
});

/** A provider that cannot be reached when it is time to cancel. */
class UnreachableProvider extends FakeProvider {
	override async cancelSubscription(): Promise<void> {
		throw new PaymentProviderError('Provider is down');
	}
}

/** A fake provider whose webhooks land straight in this database, as the route would apply them. */
function fakeProvider(Provider: typeof FakeProvider = FakeProvider): FakeProvider {
	const provider: FakeProvider = new Provider({
		publicUrl: 'http://app.test',
		webhookSecret: 'unit-test-webhook-secret',
		statePath: null,
		now: () => NOW,
		deliver: async (payload, signature) => {
			const notice = await provider.parseWebhook(payload, { [FAKE_SIGNATURE_HEADER]: signature });

			if (notice) {
				await applyWebhook(database.db, provider, notice, quiet);
			}
		}
	});

	return provider;
}

/** A Pro account with a session and two dashboards, paid through the fake checkout. */
async function proAccount(id: string, provider: FakeProvider): Promise<string> {
	const { db } = database;

	await db.insert(user).values({ id, name: 'Fan', email: `${id}@example.test` });
	// An unused sign-in link, stored the way Better Auth's magic link stores it.
	await db.insert(verification).values({
		id: `${id}-link`,
		identifier: `${id}-link-token`,
		value: JSON.stringify({ email: `${id}@example.test`, attempt: 0 }),
		expiresAt: new Date(NOW.getTime() + 300_000)
	});
	await db.insert(session).values({
		id: `${id}-session`,
		token: `${id}-token`,
		userId: id,
		expiresAt: new Date(NOW.getTime() + 86_400_000)
	});

	for (const board of ['board-a', 'board-b']) {
		await writeDocument(
			db,
			id,
			PLAN_ENTITLEMENTS.free,
			{
				id: board,
				dashboard: { id: board, name: board, tiles: [], layout: [] },
				baseVersion: 0,
				updatedAt: NOW
			},
			NOW
		);
	}

	const { url } = await provider.createCheckout({
		userId: id,
		email: `${id}@example.test`,
		interval: 'month',
		customerId: null,
		successUrl: 'http://app.test/account?checkout=success',
		cancelUrl: 'http://app.test/account?checkout=cancelled'
	});

	await provider.pay(url.split('/').at(-1) ?? '');

	const [record] = await db.select().from(subscription).where(eq(subscription.userId, id));

	assert.equal(record?.status, 'active');

	return record.id;
}

async function rowsOf(id: string) {
	const { db } = database;

	return {
		users: (await db.select().from(user).where(eq(user.id, id))).length,
		sessions: (await db.select().from(session).where(eq(session.userId, id))).length,
		dashboards: (await db.select().from(dashboard).where(eq(dashboard.userId, id))).length,
		subscriptions: (await db.select().from(subscription).where(eq(subscription.userId, id))).length,
		signInLinks: (
			await db
				.select()
				.from(verification)
				.where(eq(verification.id, `${id}-link`))
		).length
	};
}

describe('exportAccount', () => {
	it('holds the account, its dashboards and its subscription, and no session tokens', async () => {
		const provider = fakeProvider();

		await proAccount('exported', provider);

		const exported = await exportAccount(database.db, 'exported', NOW);

		assert.equal(exported?.account.email, 'exported@example.test');
		assert.deepEqual(
			exported?.dashboards.map((entry) => entry.id),
			['board-a', 'board-b']
		);
		assert.equal(exported?.subscriptions[0]?.status, 'active');
		assert.equal(exported?.sessions.length, 1);
		assert.doesNotMatch(JSON.stringify(exported), /exported-token/);
	});
});

describe('deleteAccount', () => {
	it('ends the subscription with the provider, then removes everything under the account', async () => {
		const provider = fakeProvider();
		const subscriptionId = await proAccount('leaving', provider);

		assert.deepEqual(await rowsOf('leaving'), {
			users: 1,
			sessions: 1,
			dashboards: 2,
			subscriptions: 1,
			signInLinks: 1
		});

		await deleteAccount(database.db, provider, 'leaving', NOW);

		assert.equal((await provider.getSubscription(subscriptionId)).status, 'canceled');
		assert.deepEqual(await rowsOf('leaving'), {
			users: 0,
			sessions: 0,
			dashboards: 0,
			subscriptions: 0,
			signInLinks: 0
		});
	});

	it('cancels a payment that lands after its account was deleted', async () => {
		const { db } = database;
		const paid: string[] = [];

		const provider: FakeProvider = new FakeProvider({
			publicUrl: 'http://app.test',
			webhookSecret: 'unit-test-webhook-secret',
			statePath: null,
			now: () => NOW,
			deliver: async (payload, signature) => {
				const notice = await provider.parseWebhook(payload, { [FAKE_SIGNATURE_HEADER]: signature });

				if (notice) {
					paid.push(notice.subscriptionId);
					await applyWebhook(db, provider, notice, quiet);
				}
			}
		});

		await db.insert(user).values({ id: 'gone', name: '', email: 'gone@example.test' });

		const { url } = await provider.createCheckout({
			userId: 'gone',
			email: 'gone@example.test',
			interval: 'year',
			customerId: null,
			successUrl: 'http://app.test/account?checkout=success',
			cancelUrl: 'http://app.test/account?checkout=cancelled'
		});

		await deleteAccount(db, provider, 'gone', NOW);
		await provider.pay(url.split('/').at(-1) ?? '');

		assert.equal((await provider.getSubscription(paid[0] ?? '')).status, 'canceled');
		assert.equal((await rowsOf('gone')).subscriptions, 0);
	});

	it('deletes nothing when the provider cannot end the subscription', async () => {
		const provider = fakeProvider(UnreachableProvider);

		await proAccount('stuck', provider);

		await assert.rejects(deleteAccount(database.db, provider, 'stuck', NOW), PaymentProviderError);
		assert.equal((await rowsOf('stuck')).users, 1);
		assert.equal((await rowsOf('stuck')).dashboards, 2);
	});
});
