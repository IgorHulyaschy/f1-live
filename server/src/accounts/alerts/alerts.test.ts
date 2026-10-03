import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { type Alert, DEFAULT_ALERT_SETTINGS } from '@f1-live/shared/alerts';
import type { RaceEvent } from '@f1-live/shared';
import type { ViewerSettings } from '@f1-live/shared/viewer';
import { z } from 'zod';

import { decodeDirectly, FIXTURE_DIR, waitUntil } from '../../live/test-harness.js';
import type { LiveServer } from '../../main.js';
import { callerOf, signInWith, startAccountsServer } from '../test-support.js';
import { planPush } from './dispatcher.js';
import type { PushPayload, PushResult, PushSender, PushTarget } from './sender.js';

/** Records what would be sent; an endpoint containing "gone" answers as a dead subscription. */
class RecordingSender implements PushSender {
	readonly publicKey = 'test-public-key';
	readonly sent: { target: PushTarget; payload: PushPayload }[] = [];

	async send(target: PushTarget, payload: PushPayload): Promise<PushResult> {
		this.sent.push({ target, payload });

		return target.endpoint.includes('gone') ? 'gone' : 'sent';
	}

	to(endpoint: string): PushPayload[] {
		return this.sent
			.filter((entry) => entry.target.endpoint === endpoint)
			.map((entry) => entry.payload);
	}
}

const sender = new RecordingSender();

let server: LiveServer;

before(async () => {
	server = await startAccountsServer(
		{ PUSH_ENDPOINT_HOSTS: 'push.example' },
		{ pushSender: sender }
	);
});

after(async () => {
	await server.close();
});

const call = (...args: Parameters<ReturnType<typeof callerOf>>) => callerOf(server)(...args);

const signIn = signInWith(call);

const errorReply = z.object({ error: z.string() });

const KEYS = {
	p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
	auth: 'tBHItJI5svbpez7KI4CCXg'
};

const device = (name: string) => ({
	subscription: { endpoint: `https://push.example/${name}`, keys: KEYS },
	userAgent: 'Test browser'
});

/** An account with alert settings and one registered device. */
async function subscriber(
	name: string,
	settings: Partial<typeof DEFAULT_ALERT_SETTINGS>,
	viewer?: { protect: boolean; revealed: string[] }
) {
	const cookie = await signIn(`${name}@example.test`);

	const saved = await call('PUT', '/api/me/alerts', {
		cookie,
		body: { ...DEFAULT_ALERT_SETTINGS, ...settings }
	});

	assert.equal(saved.status, 200, saved.body);
	assert.equal((await call('POST', '/api/me/push', { cookie, body: device(name) })).status, 201);

	if (viewer) {
		const sent = await call('PUT', '/api/me/viewer', {
			cookie,
			body: { ...viewer, protectUpdatedAt: new Date().toISOString() }
		});

		assert.equal(sent.status, 200);
	}

	return { cookie, endpoint: `https://push.example/${name}` };
}

const NOW = new Date('2026-10-04T12:00:00Z');

const retirement: Alert = {
	kind: 'retirement',
	id: 'retire:9858:44',
	sessionId: '9858',
	lap: 3,
	driverNumber: '44',
	title: 'HAM is out',
	body: 'Power unit'
};

const viewing = (protect: boolean, revealed: string[] = []): ViewerSettings => ({
	protect,
	protectUpdatedAt: null,
	revealed
});

const recipient = (
	change: Partial<typeof DEFAULT_ALERT_SETTINGS> = {},
	viewer: ViewerSettings | null = null
) => ({
	settings: { ...DEFAULT_ALERT_SETTINGS, driver: '44', ...change },
	viewer
});

const at = (time: string) => new Date(`2026-10-04T${time}Z`);

describe('who an alert goes to', () => {
	it('sends what is on, about the followed driver, with their delay', () => {
		assert.deepEqual(planPush(recipient(), retirement, 'started', NOW), { send: true, delayMs: 0 });
		assert.deepEqual(planPush(recipient({ delaySeconds: 30 }), retirement, 'started', NOW), {
			send: true,
			delayMs: 30_000
		});
	});

	it('holds back what is off, and what is about someone else', () => {
		assert.deepEqual(
			planPush(
				recipient({ push: { ...DEFAULT_ALERT_SETTINGS.push, retirement: false } }),
				retirement,
				'started',
				NOW
			),
			{ send: false, reason: 'off' }
		);
		assert.deepEqual(planPush(recipient({ driver: '1' }), retirement, 'started', NOW), {
			send: false,
			reason: 'other-driver'
		});
		assert.deepEqual(planPush(recipient({ driver: null }), retirement, 'started', NOW), {
			send: false,
			reason: 'other-driver'
		});
	});

	it('keeps a finished session’s result from a protected viewer who has not seen it', () => {
		const hidden = recipient({}, viewing(true));

		assert.deepEqual(planPush(hidden, retirement, 'finalised', NOW), {
			send: false,
			reason: 'spoiler'
		});
		assert.equal(planPush(hidden, retirement, 'started', NOW).send, true, 'live is live');
		assert.equal(
			planPush(recipient({}, viewing(true, ['9858'])), retirement, 'finalised', NOW).send,
			true
		);
		assert.equal(planPush(recipient({}, viewing(false)), retirement, 'finalised', NOW).send, true);
	});

	it('holds back what would arrive in quiet hours, counting the delay', () => {
		const quiet = { enabled: true, from: '12:00', to: '13:00', timeZone: 'UTC' };

		assert.deepEqual(planPush(recipient({ quiet }), retirement, 'started', at('12:30:00')), {
			send: false,
			reason: 'quiet-hours'
		});
		assert.equal(planPush(recipient({ quiet }), retirement, 'started', at('11:00:00')).send, true);
		// Sent at 11:59:50 but shown 30 s later, inside the window; or an hour on, after it.
		assert.equal(
			planPush(recipient({ quiet, delaySeconds: 30 }), retirement, 'started', at('11:59:50')).send,
			false
		);
		assert.equal(
			planPush(recipient({ quiet, delaySeconds: 3700 }), retirement, 'started', at('11:59:50'))
				.send,
			true
		);
	});
});

describe('the account’s alert settings and devices', () => {
	it('need an account, and keep valid settings for all its devices', async () => {
		assert.equal((await call('GET', '/api/me/alerts')).status, 401);

		const cookie = await signIn('settings@example.test');

		const empty = z
			.object({ settings: z.null(), devices: z.array(z.unknown()) })
			.parse((await call('GET', '/api/me/alerts', { cookie })).json());

		assert.deepEqual(empty.devices, []);

		const body = { ...DEFAULT_ALERT_SETTINGS, driver: '4', delaySeconds: 20 };

		assert.equal((await call('PUT', '/api/me/alerts', { cookie, body })).status, 200);
		assert.deepEqual((await call('GET', '/api/me/alerts', { cookie })).json(), {
			settings: body,
			devices: []
		});
		assert.equal(
			(await call('PUT', '/api/me/alerts', { cookie, body: { ...body, delaySeconds: 9999 } }))
				.status,
			400
		);
		assert.equal(
			(
				await call('PUT', '/api/me/alerts', {
					cookie,
					body: { ...body, quiet: { ...body.quiet, from: '9pm' } }
				})
			).status,
			400
		);
	});

	it('register a browser, refuse a plain-http endpoint, and remove only the account’s own', async () => {
		const cookie = await signIn('devices@example.test');
		const other = await signIn('devices-other@example.test');

		assert.equal(
			(await call('POST', '/api/me/push', { cookie, body: device('mine') })).status,
			201
		);
		assert.equal(
			(
				await call('POST', '/api/me/push', {
					cookie,
					body: { subscription: { endpoint: 'http://insecure.example/x', keys: KEYS } }
				})
			).status,
			400
		);

		assert.equal(
			(
				await call('DELETE', '/api/me/push', {
					cookie: other,
					body: { endpoint: 'https://push.example/mine' }
				})
			).status,
			404
		);

		const devices = z.object({ devices: z.array(z.object({ endpoint: z.string() })) });

		assert.equal(
			devices.parse((await call('GET', '/api/me/alerts', { cookie })).json()).devices.length,
			1
		);

		const removed = await call('DELETE', '/api/me/push', {
			cookie,
			body: { endpoint: 'https://push.example/mine' }
		});

		assert.deepEqual(devices.parse(removed.json()).devices, []);
	});

	it('refuse an address that is not a browser push service, so the server cannot be pointed inside', async () => {
		const cookie = await signIn('ssrf@example.test');

		const register = (endpoint: string) =>
			call('POST', '/api/me/push', { cookie, body: { subscription: { endpoint, keys: KEYS } } });

		for (const bad of [
			'https://169.254.169.254/latest/meta-data',
			'https://localhost/x',
			'https://127.0.0.1/x',
			'https://fcm.googleapis.com.evil.example/x',
			'https://evil.example/fcm.googleapis.com',
			'https://fcm.googleapis.com:8443/x',
			'https://user:secret@fcm.googleapis.com/x'
		]) {
			// eslint-disable-next-line no-await-in-loop -- one address after another
			const reply = await register(bad);

			assert.equal(reply.status, 400, bad);
			assert.equal(errorReply.parse(reply.json()).error, 'bad_endpoint', bad);
		}

		for (const good of [
			'https://fcm.googleapis.com/fcm/send/abc',
			'https://updates.push.services.mozilla.com/wpush/v2/abc',
			'https://wns2-par02p.notify.windows.com/w/?token=abc',
			'https://web.push.apple.com/abc',
			'https://push.example/own-vendor'
		]) {
			// eslint-disable-next-line no-await-in-loop -- one address after another
			assert.equal((await register(good)).status, 201, good);
		}
	});

	it('keep at most ten devices, dropping the oldest', async () => {
		const cookie = await signIn('many@example.test');

		for (let index = 0; index < 12; index += 1) {
			// eslint-disable-next-line no-await-in-loop -- each registration is newer than the last
			await call('POST', '/api/me/push', { cookie, body: device(`many-${index}`) });
		}

		const listed = z
			.object({ devices: z.array(z.object({ endpoint: z.string() })) })
			.parse((await call('GET', '/api/me/alerts', { cookie })).json());

		assert.equal(listed.devices.length, 10);
		assert.equal(
			listed.devices.some((entry) => entry.endpoint.endsWith('many-0')),
			false
		);
		assert.equal(
			listed.devices.some((entry) => entry.endpoint.endsWith('many-11')),
			true
		);
	});

	it('tell the browser which key to subscribe with, and send a test notice', async () => {
		const config = z
			.object({ push: z.object({ publicKey: z.string() }).nullable() })
			.parse((await call('GET', '/api/config')).json());

		assert.equal(config.push?.publicKey, 'test-public-key');

		const cookie = await signIn('tester@example.test');

		await call('POST', '/api/me/push', { cookie, body: device('tester') });

		const result = await call('POST', '/api/me/push/test', { cookie });

		assert.deepEqual(result.json(), { sent: 1, gone: 0, failed: 0, devices: 1 });
		assert.equal(sender.to('https://push.example/tester')[0]?.kind, 'test');
		assert.equal(
			(await call('POST', '/api/me/push/test', { cookie })).status,
			429,
			'not again at once'
		);
	});

	it('are in the account export', async () => {
		const cookie = await signIn('exporter@example.test');

		await call('PUT', '/api/me/alerts', {
			cookie,
			body: { ...DEFAULT_ALERT_SETTINGS, driver: '81' }
		});
		await call('POST', '/api/me/push', { cookie, body: device('exporter') });

		const exported = z
			.object({
				alerts: z.object({
					settings: z.object({ driver: z.string() }),
					devices: z.array(z.object({ endpoint: z.string() }))
				})
			})
			.parse((await call('GET', '/api/me/export', { cookie })).json());

		assert.equal(exported.alerts.settings.driver, '81');
		assert.deepEqual(
			exported.alerts.devices.map((entry) => entry.endpoint),
			['https://push.example/exporter']
		);
	});
});

/** One event at a time, as the feed's batches may be: the session is compared after each. */
async function play(from: RaceEvent[]) {
	for (const event of from) {
		server.session.push([event]);
		// eslint-disable-next-line no-await-in-loop -- the dispatcher reads the session as it is after each
		await new Promise((resolve) => setImmediate(resolve));
	}
}

describe('alerts from the live session, to devices', () => {
	let events: RaceEvent[];

	before(async () => {
		events = await decodeDirectly(FIXTURE_DIR);
	});

	it('sends each account what it asked for, about the driver it follows, and nothing else', async () => {
		// Las Vegas 2025, the first laps: drivers 22 pits, 12 and 23 are penalised, 18 and 5 retire.
		const pitwatcher = await subscriber('pit-watcher', { driver: '22' });
		await subscriber('penalised', {
			driver: '23',
			push: { ...DEFAULT_ALERT_SETTINGS.push, flag: false }
		});
		const watching = await subscriber('delayed', { driver: '22', delaySeconds: 1 });

		await play(events);
		await waitUntil(() => sender.to(pitwatcher.endpoint).length >= 8, 'the pushes to arrive');

		const titles = (name: string) =>
			sender.to(`https://push.example/${name}`).map((payload) => payload.title);

		const pit = titles('pit-watcher');

		assert.ok(pit.includes('Race has started'), pit.join(', '));
		assert.ok(pit.some((title) => title.endsWith('is in the pits')));
		assert.ok(pit.includes('Yellow flag'));
		assert.ok(pit.includes('Virtual safety car'));
		assert.equal(
			pit.some((title) => title.includes('penalty') || title.includes('is out')),
			false,
			'not about 22'
		);

		const hit = titles('penalised');

		assert.ok(hit.includes('Race has started'), 'session starts reach everyone');
		assert.equal(hit.filter((title) => title.includes('penalty')).length, 2, hit.join(', '));
		assert.equal(
			hit.some((title) => title.includes('flag') || title.includes('Safety')),
			false,
			'flags are off'
		);
		assert.equal(
			hit.some((title) => title.includes('is in the pits')),
			false
		);

		// The delayed device had nothing by the time the others had everything.
		assert.ok(sender.to(watching.endpoint).length < pit.length);
		await waitUntil(() => sender.to(watching.endpoint).length === pit.length, 'the delayed pushes');

		const payload = sender.to(pitwatcher.endpoint)[0];

		assert.equal(payload?.url, '/');
		assert.ok(payload?.tag);
	});

	it('gives a result to someone who revealed the session, and not to someone protected from it', async () => {
		const protectedFan = await subscriber(
			'protected-fan',
			{ driver: '1' },
			{ protect: true, revealed: [] }
		);

		const knowing = await subscriber(
			'knowing-fan',
			{ driver: '1' },
			{ protect: true, revealed: ['9858'] }
		);

		const open = await subscriber('open-fan', { driver: '1' }, { protect: false, revealed: [] });

		assert.equal(server.session.current.status, 'ended', 'the fixture ran to its end');

		await play([
			{
				kind: 'retirement',
				at: '2025-11-23T06:30:00.000Z',
				driverNumber: '1',
				reason: 'Stewards decision'
			},
			{
				kind: 'penalty',
				at: '2025-11-23T06:31:00.000Z',
				penalty: {
					driverNumber: '1',
					kind: 'time',
					seconds: 10,
					reason: 'Post-race',
					lap: 50,
					status: 'issued'
				}
			}
		]);

		await waitUntil(() => sender.to(knowing.endpoint).length === 2, 'the revealed viewer’s pushes');
		await waitUntil(() => sender.to(open.endpoint).length === 2, 'the unprotected viewer’s pushes');
		await new Promise((resolve) => setTimeout(resolve, 150));

		assert.deepEqual(
			sender.to(protectedFan.endpoint),
			[],
			'a result is not pushed to protected viewers'
		);
		assert.deepEqual(
			sender.to(knowing.endpoint).map((payload) => payload.kind),
			['retirement', 'penalty']
		);
	});

	it('forgets a device the push service reports as gone', async () => {
		const leaver = await subscriber('gone-device', { driver: null });

		const devices = async () =>
			z
				.object({ devices: z.array(z.unknown()) })
				.parse((await call('GET', '/api/me/alerts', { cookie: leaver.cookie })).json()).devices;

		assert.equal((await devices()).length, 1);

		await play([{ kind: 'track_status', at: '2025-11-23T06:40:00.000Z', status: 'yellow' }]);

		for (let attempt = 0; attempt < 50 && (await devices()).length > 0; attempt += 1) {
			// eslint-disable-next-line no-await-in-loop -- polling for the push to be tried
			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		assert.equal(sender.to(leaver.endpoint).length, 1, 'tried once');
		assert.deepEqual(await devices(), []);
	});
});
