import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { Dashboard } from '@f1-live/shared/dashboard';
import { z } from 'zod';

import { testConfig } from '../live/test-harness.js';
import { createServer, type LiveServer } from '../main.js';

// Development rules (printed links, fake payments) hold only for an app on this machine.
const APP = 'http://localhost:5199';

let server: LiveServer;

before(async () => {
	// Relay mode serves viewers without reading the live feed.
	server = await createServer(
		testConfig({
			MODE: 'relay',
			RELAY_SECRET: 'unit-test-relay-secret',
			ACCOUNTS_DB: 'memory',
			APP_URL: APP
		})
	);
});

after(async () => {
	await server.close();
});

/** A browser request from the app: its origin, its cookie, a JSON body. */
async function call(
	method: 'GET' | 'POST' | 'PUT' | 'DELETE',
	url: string,
	options: { cookie?: string; body?: object; origin?: string } = {}
) {
	const headers = new Headers({ origin: options.origin ?? APP });

	if (options.cookie !== undefined) {
		headers.set('cookie', options.cookie);
	}

	if (options.body !== undefined) {
		headers.set('content-type', 'application/json');
	}

	const response = await server.app.inject({
		method,
		url,
		headers: Object.fromEntries(headers),
		payload: options.body === undefined ? undefined : JSON.stringify(options.body)
	});

	const setCookie = response.headers['set-cookie'];

	return {
		status: response.statusCode,
		body: response.body,
		json: () => z.json().parse(JSON.parse(response.body)),
		cookies: setCookie === undefined ? [] : [setCookie].flat()
	};
}

/** Signs in the way a person does: ask for a link, then open it. Returns the cookie header. */
async function signIn(email: string): Promise<string> {
	const sent = await call('POST', '/api/auth/sign-in/magic-link', {
		body: { email, callbackURL: `${APP}/` }
	});

	assert.equal(sent.status, 200, sent.body);

	const { link } = z
		.object({ link: z.url() })
		.parse((await call('GET', `/api/dev/mailbox?to=${encodeURIComponent(email)}`)).json());

	const opened = await call('GET', link.replace(/^https?:\/\/[^/]+/, ''));

	assert.equal(opened.status, 302, opened.body);

	return opened.cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

const meSchema = z.object({
	user: z.object({ id: z.string(), email: z.string() }),
	plan: z.enum(['free', 'pro']),
	entitlements: z.object({ ownDashboards: z.number().nullable() }),
	billing: z.object({ portal: z.boolean() })
});

function board(id: string): Dashboard {
	return {
		id,
		name: `Board ${id}`,
		tiles: [{ id: `${id}-0`, kind: 'timing' }],
		layout: [{ i: `${id}-0`, x: 0, y: 0, w: 12, h: 10 }]
	};
}

const put = (cookie: string, id: string) =>
	call('PUT', `/api/me/dashboards/${id}`, {
		cookie,
		body: { dashboard: board(id), baseVersion: 0, updatedAt: new Date().toISOString() }
	});

describe('accounts API', () => {
	it('signs in with an emailed link and starts on Free', async () => {
		const cookie = await signIn('first@example.test');
		const me = meSchema.parse((await call('GET', '/api/me', { cookie })).json());

		assert.equal(me.user.email, 'first@example.test');
		assert.equal(me.plan, 'free');
		assert.equal(me.entitlements.ownDashboards, 3);
		const anonymous = await call('GET', '/api/me');

		assert.equal(anonymous.status, 200);
		assert.equal(anonymous.json(), null);
		assert.equal((await call('GET', '/api/me/dashboards')).status, 401);
	});

	it('holds the Free limit against direct API calls, then lifts it after a fake checkout', async () => {
		const cookie = await signIn('buyer@example.test');

		for (const id of ['board-1', 'board-2', 'board-3']) {
			assert.equal((await put(cookie, id)).status, 200);
		}

		const blocked = await put(cookie, 'board-4');

		assert.equal(blocked.status, 403);
		assert.deepEqual(blocked.json(), {
			error: 'dashboard_limit',
			message: 'Free keeps 3 dashboards of your own',
			limit: 3
		});

		const checkout = await call('POST', '/api/billing/checkout', {
			cookie,
			body: { interval: 'month' }
		});

		const { url } = z.object({ url: z.url() }).parse(checkout.json());
		const path = new URL(url).pathname;

		assert.match((await call('GET', path)).body, /Pay/);

		const paid = await call('POST', `${path}/pay`);

		assert.equal(paid.status, 303);
		assert.equal((await call('GET', path)).status, 404, 'a paid checkout closes');

		const me = meSchema.parse((await call('GET', '/api/me', { cookie })).json());

		assert.equal(me.plan, 'pro');
		assert.equal(me.entitlements.ownDashboards, null);
		assert.equal(me.billing.portal, true);
		assert.equal((await put(cookie, 'board-4')).status, 200);
		assert.equal((await put(cookie, 'board-5')).status, 200);

		const again = await call('POST', '/api/billing/checkout', {
			cookie,
			body: { interval: 'year' }
		});

		assert.equal(again.status, 409);
	});

	it('cancels through the billing page at the period end, or at once', async () => {
		const cookie = await signIn('canceller@example.test');

		const checkout = z
			.object({ url: z.url() })
			.parse(
				(await call('POST', '/api/billing/checkout', { cookie, body: { interval: 'year' } })).json()
			);

		await call('POST', `${new URL(checkout.url).pathname}/pay`);

		const portal = z
			.object({ url: z.url() })
			.parse((await call('POST', '/api/billing/portal', { cookie })).json());

		const portalPath = new URL(portal.url).pathname;
		const page = (await call('GET', portalPath)).body;
		const action = (name: string) => page.match(new RegExp(`action="([^"]+/${name})"`))?.[1] ?? '';

		assert.equal((await call('POST', action('cancel-at-period-end'))).status, 303);
		assert.equal(meSchema.parse((await call('GET', '/api/me', { cookie })).json()).plan, 'pro');

		const later = (await call('GET', portalPath)).body;
		const cancelNow = later.match(/action="([^"]+\/cancel-now)"/)?.[1] ?? '';

		assert.equal((await call('POST', cancelNow)).status, 303);
		assert.equal(meSchema.parse((await call('GET', '/api/me', { cookie })).json()).plan, 'free');
	});

	it('refuses writes from an untrusted origin and webhooks without a valid signature', async () => {
		const cookie = await signIn('origin@example.test');

		const foreign = await call('PUT', '/api/me/dashboards/board-x', {
			cookie,
			origin: 'https://evil.example',
			body: { dashboard: board('board-x'), baseVersion: 0, updatedAt: new Date().toISOString() }
		});

		assert.equal(foreign.status, 403);

		const forged = await server.app.inject({
			method: 'POST',
			url: '/api/billing/webhook',
			headers: { 'content-type': 'application/json', 'fake-signature': 't=1,v1=00' },
			payload: JSON.stringify({ id: 'evt', type: 'customer.subscription.deleted' })
		});

		assert.equal(forged.statusCode, 400);
	});

	it('merges spoiler settings from two devices and exports them', async () => {
		const cookie = await signIn('watcher@example.test');

		const first = await call('PUT', '/api/me/viewer', {
			cookie,
			body: { protect: true, protectUpdatedAt: null, revealed: ['9858'] }
		});

		assert.equal(first.status, 200, first.body);

		const second = await call('PUT', '/api/me/viewer', {
			cookie,
			body: { protect: false, protectUpdatedAt: '2026-10-03T09:00:00.000Z', revealed: ['11373'] }
		});

		assert.deepEqual(second.json(), {
			protect: false,
			protectUpdatedAt: '2026-10-03T09:00:00.000Z',
			revealed: ['9858', '11373']
		});
		assert.match((await call('GET', '/api/me/export', { cookie })).body, /11373/);
		assert.equal(
			(await call('PUT', '/api/me/viewer', { body: { protect: true, revealed: [] } })).status,
			401
		);
	});

	it('exports the account, then deletes it and everything under it', async () => {
		const cookie = await signIn('leaver@example.test');

		await put(cookie, 'board-1');

		const exported = await call('GET', '/api/me/export', { cookie });

		assert.equal(exported.status, 200);
		assert.match(exported.body, /board-1/);

		const wrong = await call('DELETE', '/api/me', { cookie, body: { confirm: 'someone@else' } });

		assert.equal(wrong.status, 400);

		const deleted = await call('DELETE', '/api/me', {
			cookie,
			body: { confirm: 'Leaver@example.test' }
		});

		assert.equal(deleted.status, 200, deleted.body);
		assert.ok(deleted.cookies.some((value) => /Max-Age=0/i.test(value)));
		assert.equal((await call('GET', '/api/me', { cookie })).json(), null);

		const fresh = await signIn('leaver@example.test');

		const documents = z
			.object({ documents: z.array(z.object({ id: z.string() })) })
			.parse((await call('GET', '/api/me/dashboards', { cookie: fresh })).json());

		assert.deepEqual(documents.documents, []);
	});
});

describe('the development mailbox', () => {
	const BRIDGE_IP = '172.18.0.4';

	/** A relay on a loopback app that asked for a link for one address; returns the mailbox answer. */
	async function mailboxStatus(extra: Record<string, string>): Promise<number> {
		const relay = await createServer(
			testConfig({
				MODE: 'relay',
				RELAY_SECRET: 'unit-test-relay-secret',
				ACCOUNTS_DB: 'memory',
				APP_URL: APP,
				...extra
			})
		);

		try {
			await relay.app.inject({
				method: 'POST',
				url: '/api/auth/sign-in/magic-link',
				headers: { origin: APP, 'content-type': 'application/json' },
				payload: JSON.stringify({ email: 'bridge@example.test', callbackURL: `${APP}/` })
			});

			const response = await relay.app.inject({
				method: 'GET',
				url: '/api/dev/mailbox?to=bridge@example.test',
				remoteAddress: BRIDGE_IP
			});

			return response.statusCode;
		} finally {
			await relay.close();
		}
	}

	it('answers only this machine, unless a stack that publishes on loopback opts in', async () => {
		assert.equal(await mailboxStatus({}), 404);
		assert.equal(await mailboxStatus({ DEV_MAILBOX_ANY_IP: 'true' }), 200);
	});
});
