import { alertSettingsSchema } from '@f1-live/shared/alerts';
import type { User } from 'better-auth';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { Accounts } from '../accounts.js';
import { isPushEndpointAllowed } from './sender.js';
import {
	forgetDevice,
	listDevices,
	readAlertSettings,
	removeDevice,
	saveDevice,
	writeAlertSettings
} from './store.js';
import { HttpError } from '../http-error.js';

const base64url = z
	.string()
	.min(8)
	.max(256)
	.regex(/^[\w-]+=*$/);

/** What `PushSubscription.toJSON()` gives; the endpoint is the push service's own https address. */
const subscribeBody = z.object({
	subscription: z.object({
		endpoint: z.url({ protocol: /^https$/ }).max(1024),
		keys: z.object({ p256dh: base64url, auth: base64url })
	}),
	userAgent: z.string().max(200).optional()
});

/** A test notice goes out at most this often per account, so the key cannot be used to spam. */
const TEST_COOLDOWN_MS = 10_000;

const endpointBody = z.object({ endpoint: z.string().min(1).max(1024) });

/**
 * Alert settings and Web Push devices of the signed-in account. Settings are one document for
 * all devices; every browser that wants pushes registers its own subscription.
 */
export function registerAlerts(
	scope: FastifyInstance,
	accounts: Accounts,
	signedIn: (request: FastifyRequest) => Promise<User>
): void {
	const { db, push, alerts } = accounts;
	const lastTest = new Map<string, number>();

	const needPush = () => {
		if (!push) {
			throw new HttpError(503, 'push_unavailable', 'Web Push is not set up on this server');
		}

		return push;
	};

	scope.get('/api/me/alerts', async (request, reply) => {
		const user = await signedIn(request);

		return reply.send({
			settings: await readAlertSettings(db, user.id),
			devices: await listDevices(db, user.id)
		});
	});

	scope.put('/api/me/alerts', async (request, reply) => {
		const user = await signedIn(request);
		const settings = alertSettingsSchema.parse(request.body);

		await writeAlertSettings(db, user.id, settings);
		alerts?.changed();

		return reply.send({ settings });
	});

	scope.post('/api/me/push', async (request, reply) => {
		const user = await signedIn(request);

		needPush();

		const { subscription, userAgent } = subscribeBody.parse(request.body);

		if (!isPushEndpointAllowed(subscription.endpoint, accounts.config.push.extraEndpointHosts)) {
			throw new HttpError(400, 'bad_endpoint', 'That is not a browser push service address');
		}

		await saveDevice(
			db,
			user.id,
			{ endpoint: subscription.endpoint, ...subscription.keys },
			userAgent ?? null
		);
		alerts?.changed();

		return reply.code(201).send({ devices: await listDevices(db, user.id) });
	});

	scope.delete('/api/me/push', async (request, reply) => {
		const user = await signedIn(request);
		const { endpoint } = endpointBody.parse(request.body);

		if (!(await removeDevice(db, user.id, endpoint))) {
			throw new HttpError(404, 'not_found', 'That device is not registered on this account');
		}

		alerts?.changed();

		return reply.send({ devices: await listDevices(db, user.id) });
	});

	// So someone can see it work, and a device that stopped receiving finds out why.
	scope.post('/api/me/push/test', async (request, reply) => {
		const user = await signedIn(request);
		const sender = needPush();
		const last = lastTest.get(user.id) ?? 0;

		if (Date.now() - last < TEST_COOLDOWN_MS) {
			throw new HttpError(429, 'too_soon', 'Wait a few seconds before sending another test');
		}

		lastTest.set(user.id, Date.now());

		for (const [id, at] of lastTest) {
			if (Date.now() - at > TEST_COOLDOWN_MS) {
				lastTest.delete(id);
			}
		}

		const devices = await listDevices(db, user.id);
		const counts = { sent: 0, gone: 0, failed: 0 };

		const rows = await db.query.pushSubscription.findMany({
			where: (table, { eq }) => eq(table.userId, user.id)
		});

		for (const device of rows) {
			const result = await sender.send(device, {
				title: `${accounts.config.brand} alerts are on`,
				body: 'This is a test: a real alert looks like this.',
				tag: `test-${Date.now()}`,
				kind: 'test',
				url: '/alerts'
			});

			counts[result] += 1;

			if (result === 'gone') {
				await forgetDevice(db, device.endpoint);
			}
		}

		return reply.send({ ...counts, devices: devices.length });
	});
}
