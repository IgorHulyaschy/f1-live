import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import webpush from 'web-push';

import { loadConfig } from '../../config.js';
import { isPushEndpointAllowed, resolveVapidKeys, WebPushSender } from './sender.js';

const target = { endpoint: 'https://push.example/abc', p256dh: 'key', auth: 'secret' };

const payload = {
	title: 'NOR is in the pits',
	body: 'Stop 1',
	tag: 'pit:1',
	kind: 'pit_stop',
	url: '/'
};

describe('the Web Push sender', () => {
	const sender = new WebPushSender(
		{ publicKey: 'pub', privateKey: 'priv' },
		'mailto:push@example.com'
	);

	it('signs with the server’s keys and identity, and lets an old notice expire', async (context) => {
		const send = context.mock.method(webpush, 'sendNotification', async () => ({
			statusCode: 201,
			body: '',
			headers: {}
		}));

		assert.equal(await sender.send(target, payload), 'sent');

		const [subscription, body, options] = send.mock.calls[0]?.arguments ?? [];

		assert.deepEqual(subscription, {
			endpoint: target.endpoint,
			keys: { p256dh: 'key', auth: 'secret' }
		});
		assert.deepEqual(JSON.parse(String(body)), payload);
		assert.deepEqual(options?.vapidDetails, {
			subject: 'mailto:push@example.com',
			publicKey: 'pub',
			privateKey: 'priv'
		});
		assert.equal(options?.TTL, 120);
	});

	it('says a subscription is gone when the push service does, and failed for anything else', async (context) => {
		const answers = [404, 410, 500, 429];

		context.mock.method(webpush, 'sendNotification', async () => {
			throw new webpush.WebPushError('rejected', answers.shift() ?? 0, {}, '', target.endpoint);
		});

		assert.equal(await sender.send(target, payload), 'gone');
		assert.equal(await sender.send(target, payload), 'gone');
		assert.equal(await sender.send(target, payload), 'failed');
		assert.equal(await sender.send(target, payload), 'failed');

		context.mock.method(webpush, 'sendNotification', async () => {
			throw new Error('socket hang up');
		});
		assert.equal(await sender.send(target, payload), 'failed');
	});
});

const settings = (env: Record<string, string>) =>
	loadConfig({
		ACCOUNTS_DB: 'pglite',
		DATA_DIR: mkdtempSync(path.join(tmpdir(), 'vapid-')),
		...env
	}).accounts?.push;

describe('the server’s VAPID keys', () => {
	it('are the configured ones when both are set, with the sender identity beside them', () => {
		const push = settings({
			VAPID_PUBLIC_KEY: 'public',
			VAPID_PRIVATE_KEY: 'private',
			VAPID_SUBJECT: 'https://example.com/contact'
		});

		assert.deepEqual(push?.keys, { publicKey: 'public', privateKey: 'private' });
		assert.equal(push?.subject, 'https://example.com/contact');
	});

	it('default to a mailto: identity on the app’s host, and refuse a bad one', () => {
		assert.equal(settings({})?.subject, 'mailto:push@localhost');
		assert.throws(() => settings({ VAPID_SUBJECT: 'not a url' }), /VAPID_SUBJECT/);
		assert.throws(
			() => settings({ VAPID_PUBLIC_KEY: 'only-one' }),
			/VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY/
		);
	});

	it('are made once in development and kept beside the database', async () => {
		const push = settings({});

		assert.ok(push?.generateInto?.file);

		const first = await resolveVapidKeys(push);
		const again = await resolveVapidKeys(push);

		assert.ok(first);
		assert.deepEqual(again, first);
		assert.deepEqual(JSON.parse(readFileSync(push.generateInto?.file ?? '', 'utf8')), first);
	});

	it('are never made in production: push stays off until they are set', async () => {
		const push = loadConfig({
			DATABASE_URL: 'postgres://db.example/accounts',
			NODE_ENV: 'production',
			APP_URL: 'https://app.example.com',
			BETTER_AUTH_SECRET: 'x'.repeat(40),
			SMTP_URL: 'smtp://mail.example.com',
			STRIPE_SECRET_KEY: 'sk',
			STRIPE_WEBHOOK_SECRET: 'wh',
			STRIPE_PRICE_PRO_MONTHLY: 'm',
			STRIPE_PRICE_PRO_YEARLY: 'y'
		}).accounts?.push;

		assert.equal(push?.generateInto, null);
		assert.ok(push);
		assert.equal(await resolveVapidKeys(push), null);
	});
});

describe('which push endpoints are accepted', () => {
	it('takes the browser vendors’ services and the owner’s additions, over https on the default port', () => {
		for (const url of [
			'https://fcm.googleapis.com/fcm/send/abc',
			'https://updates.push.services.mozilla.com/wpush/v2/abc',
			'https://wns2-par02p.notify.windows.com/w/?token=abc',
			'https://web.push.apple.com/abc'
		]) {
			assert.equal(isPushEndpointAllowed(url, []), true, url);
		}

		assert.equal(isPushEndpointAllowed('https://push.vendor.example/a', []), false);
		assert.equal(
			isPushEndpointAllowed('https://push.vendor.example/a', ['push.vendor.example']),
			true
		);
		assert.equal(
			isPushEndpointAllowed('https://eu.push.vendor.example/a', ['*.vendor.example']),
			true
		);
	});

	it('refuses everything that is not one of them', () => {
		for (const url of [
			'http://fcm.googleapis.com/x',
			'https://fcm.googleapis.com.evil.example/x',
			'https://notfcm.googleapis.com/x',
			'https://169.254.169.254/x',
			'https://localhost/x',
			'https://fcm.googleapis.com:444/x',
			'https://a:b@fcm.googleapis.com/x',
			'not a url',
			''
		]) {
			assert.equal(isPushEndpointAllowed(url, []), false, url);
		}
	});
});
