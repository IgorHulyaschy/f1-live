import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { WebSocket } from 'ws';
import { z } from 'zod';

import { waitUntil } from '../live/test-harness.js';
import type { LiveServer } from '../main.js';
import { board, callerOf, signInWith, startAccountsServer } from './test-support.js';

let server: LiveServer;

let address: string;

before(async () => {
	server = await startAccountsServer();
	address = (await server.listen()).replace('http', 'ws');
});

after(async () => {
	await server.close();
});

const call = (...args: Parameters<ReturnType<typeof callerOf>>) => callerOf(server)(...args);

const signIn = (email: string) => signInWith(call)(email);

const changeSchema = z.object({
	type: z.literal('changed'),
	topic: z.enum(['dashboards', 'viewer'])
});

/** A device's channel: the cookie and the id it chose, and every message it hears. */
async function device(cookie: string | null, id: string) {
	const heard: unknown[] = [];

	const socket = new WebSocket(`${address}/api/me/events?device=${id}`, {
		headers: cookie === null ? {} : { cookie }
	});

	socket.on('message', (data) => heard.push(JSON.parse(data.toString())));

	const closed = new Promise<number>((resolve) => socket.on('close', resolve));

	await new Promise((resolve, reject) => {
		socket.once('open', resolve);
		socket.once('error', reject);
	});

	return { socket, heard, closed };
}

const save = (cookie: string, id: string, deviceName: string, baseVersion = 0) =>
	call('PUT', `/api/me/dashboards/${id}`, {
		cookie,
		device: deviceName,
		body: { dashboard: board(id), baseVersion, updatedAt: new Date().toISOString() }
	});

describe('the signed-in device channel', () => {
	it('tells the other devices of an account, not the one that saved, and nobody else', async () => {
		const cookie = await signIn('sync-a@example.test');
		const stranger = await signIn('sync-b@example.test');
		const phone = await device(cookie, 'phone-device-1');
		const laptop = await device(cookie, 'laptop-device-1');
		const other = await device(stranger, 'other-device-1');

		assert.equal((await save(cookie, 'board-1', 'phone-device-1')).status, 200);
		await waitUntil(() => laptop.heard.length === 1, 'the laptop to hear the save');

		assert.deepEqual(changeSchema.parse(laptop.heard[0]), { type: 'changed', topic: 'dashboards' });

		// The phone made the change; the account's own stranger is not told either.
		await new Promise((resolve) => setTimeout(resolve, 100));
		assert.equal(phone.heard.length, 0);
		assert.equal(other.heard.length, 0);

		for (const { socket } of [phone, laptop, other]) {
			socket.close();
		}
	});

	it('tells devices of a deletion and of changed spoiler settings, but not of a stale save', async () => {
		const cookie = await signIn('sync-c@example.test');
		const laptop = await device(cookie, 'laptop-device-2');

		await save(cookie, 'board-1', 'phone-device-2');
		await waitUntil(() => laptop.heard.length === 1, 'the laptop to hear the save');

		// A write that loses to a newer one changes nothing, so nobody hears of it.
		const stale = await call('PUT', '/api/me/dashboards/board-1', {
			cookie,
			device: 'phone-device-2',
			body: { dashboard: board('board-1'), baseVersion: 0, updatedAt: '2000-01-01T00:00:00.000Z' }
		});

		assert.equal(stale.status, 409);

		const removed = await call('DELETE', '/api/me/dashboards/board-1', {
			cookie,
			device: 'phone-device-2',
			body: { baseVersion: 1, updatedAt: new Date().toISOString() }
		});

		assert.equal(removed.status, 200);
		await waitUntil(() => laptop.heard.length === 2, 'the laptop to hear the deletion');

		const settings = await call('PUT', '/api/me/viewer', {
			cookie,
			device: 'phone-device-2',
			body: { protect: true, protectUpdatedAt: new Date().toISOString(), revealed: [] }
		});

		assert.equal(settings.status, 200);
		await waitUntil(() => laptop.heard.length === 3, 'the laptop to hear the settings');
		assert.deepEqual(changeSchema.parse(laptop.heard[2]), { type: 'changed', topic: 'viewer' });

		laptop.socket.close();
	});

	it('closes a connection with no session, and one whose account is deleted', async () => {
		const anonymous = await device(null, 'nobody-device-1');

		assert.equal(await anonymous.closed, 4401);

		const email = 'sync-d@example.test';
		const cookie = await signIn(email);
		const laptop = await device(cookie, 'laptop-device-3');
		const deleted = await call('DELETE', '/api/me', { cookie, body: { confirm: email } });

		assert.equal(deleted.status, 200);
		assert.equal(await laptop.closed, 4401);
	});

	it('refuses a browser page from another origin', async () => {
		const cookie = await signIn('sync-e@example.test');

		await assert.rejects(
			new Promise((resolve, reject) => {
				const socket = new WebSocket(`${address}/api/me/events`, {
					headers: { cookie, origin: 'https://evil.example' }
				});

				socket.once('open', resolve);
				socket.once('error', reject);
			})
		);
	});
});
