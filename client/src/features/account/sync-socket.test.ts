import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { eventsUrl, openSyncSocket, type SyncSocketHandlers } from './sync-socket.ts';

function fakes() {
	const sockets: { handlers: SyncSocketHandlers; closed: boolean; url: string }[] = [];
	const changes: number[] = [];
	const states: boolean[] = [];

	const stop = openSyncSocket({
		url: 'ws://pitwall.test/api/me/events?device=abc',
		onChange: () => changes.push(Date.now()),
		onOpen: (open) => states.push(open),
		random: () => 0,
		createSocket: (url, handlers) => {
			const socket = { handlers, closed: false, url, close: () => (socket.closed = true) };

			sockets.push(socket);

			return socket;
		}
	});

	return { sockets, changes, states, stop };
}

describe('eventsUrl', () => {
	it('uses the page origin without an API base, and the base when there is one', () => {
		const page = { protocol: 'https:', host: 'pitwall.test' };

		assert.equal(eventsUrl('', page, 'dev-1'), 'wss://pitwall.test/api/me/events?device=dev-1');
		assert.equal(
			eventsUrl('http://127.0.0.1:3000', page, 'dev-1'),
			'ws://127.0.0.1:3000/api/me/events?device=dev-1'
		);
	});
});

describe('the sync socket', () => {
	it('pulls when another device changes the account, and ignores everything else', () => {
		const { sockets, changes } = fakes();
		const [socket] = sockets;

		socket?.handlers.open();
		assert.equal(changes.length, 1, 'opening pulls once, for what was missed');

		socket?.handlers.message(JSON.stringify({ type: 'changed', topic: 'dashboards' }));
		socket?.handlers.message(JSON.stringify({ type: 'changed', topic: 'nonsense' }));
		socket?.handlers.message('not json');
		assert.equal(changes.length, 2);
	});

	it('reconnects after a drop with a growing wait, and not after sign-out or stop', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] });

		const { sockets, states, stop } = fakes();

		sockets[0]?.handlers.open();
		sockets[0]?.handlers.closed(1006);
		assert.deepEqual(states, [true, false]);
		assert.equal(sockets.length, 1);

		context.mock.timers.tick(500);
		assert.equal(sockets.length, 2, 'the first retry waits half the initial second at most');

		sockets[1]?.handlers.closed(1006);
		context.mock.timers.tick(999);
		assert.equal(sockets.length, 2, 'the second waits longer');
		context.mock.timers.tick(1);
		assert.equal(sockets.length, 3);

		sockets[2]?.handlers.closed(4401);
		context.mock.timers.tick(60_000);
		assert.equal(sockets.length, 3, 'signed out: no retry');

		stop();
	});

	it('stops for good when asked', (context) => {
		context.mock.timers.enable({ apis: ['setTimeout'] });

		const { sockets, stop } = fakes();

		stop();
		assert.equal(sockets[0]?.closed, true);
		sockets[0]?.handlers.closed(1000);
		context.mock.timers.tick(60_000);
		assert.equal(sockets.length, 1);
	});
});
