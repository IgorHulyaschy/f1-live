import assert from 'node:assert/strict';

import type { Dashboard } from '@f1-live/shared/dashboard';
import { z } from 'zod';

import { testConfig } from '../live/test-harness.js';
import { createServer, type LiveServer, type ServerOptions } from '../main.js';

// Development rules (printed links, fake payments) hold only for an app on this machine.
export const APP = 'http://localhost:5199';

export type Call = ReturnType<typeof callerOf>;

/** A relay-mode server with in-memory accounts: it serves viewers without reading the live feed. */
export function startAccountsServer(
	env: Record<string, string> = {},
	options: ServerOptions = {}
): Promise<LiveServer> {
	return createServer(
		testConfig({
			MODE: 'relay',
			RELAY_SECRET: 'unit-test-relay-secret',
			ACCOUNTS_DB: 'memory',
			APP_URL: APP,
			...env
		}),
		options
	);
}

/** A browser request from the app: its origin, its cookie, a JSON body. */
export function callerOf(server: LiveServer) {
	return async (
		method: 'GET' | 'POST' | 'PUT' | 'DELETE',
		url: string,
		options: { cookie?: string; body?: object; origin?: string; device?: string } = {}
	) => {
		const headers = new Headers({ origin: options.origin ?? APP });

		if (options.cookie !== undefined) {
			headers.set('cookie', options.cookie);
		}

		if (options.device !== undefined) {
			headers.set('x-pitwall-device', options.device);
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
	};
}

/** Signs in the way a person does: ask for a link, then open it. Returns the cookie header. */
export function signInWith(call: Call) {
	return async (email: string): Promise<string> => {
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
	};
}

export function board(id: string, name = `Board ${id}`): Dashboard {
	return {
		id,
		name,
		tiles: [{ id: `${id}-0`, kind: 'timing' }],
		layout: [{ i: `${id}-0`, x: 0, y: 0, w: 12, h: 10 }]
	};
}

/** Buys Pro through the fake provider, as the account page does. */
export async function goPro(call: Call, cookie: string): Promise<void> {
	const checkout = await call('POST', '/api/billing/checkout', {
		cookie,
		body: { interval: 'month' }
	});

	const { url } = z.object({ url: z.url() }).parse(checkout.json());
	const paid = await call('POST', `${new URL(url).pathname}/pay`);

	assert.equal(paid.status, 303);
}
