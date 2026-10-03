import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { EMPTY_SNAPSHOT, type RaceEvent } from '@f1-live/shared';

import {
	applyServerMessage,
	LiveFeed,
	liveSessionKey,
	parseServerMessage,
	type Replica,
	type ServerMessage,
	type SocketHandlers
} from './live-feed.ts';

const AT = '2026-10-03T08:00:00.000Z';

function trackStatus(status: 'green' | 'red'): RaceEvent {
	return { kind: 'track_status', at: AT, status };
}

function state(seq: number, epoch = 'a'): ServerMessage {
	return { type: 'state', epoch, sessionId: '11730', seq, at: 0, snapshot: EMPTY_SNAPSHOT };
}

function events(from: number, list: readonly RaceEvent[], epoch = 'a'): ServerMessage {
	return { type: 'events', epoch, from, at: 0, events: list };
}

function replicaAt(seq: number): Replica {
	const step = applyServerMessage(null, state(seq));

	assert.ok(step.replica);

	return step.replica;
}

describe('applyServerMessage', () => {
	it('replaces everything with a state', () => {
		const step = applyServerMessage(replicaAt(9), state(3, 'b'));

		assert.deepEqual([step.replica?.epoch, step.replica?.seq, step.resync], ['b', 3, false]);
	});

	it('skips events already in the state and applies the rest in order', () => {
		const step = applyServerMessage(
			replicaAt(5),
			events(4, [trackStatus('red'), trackStatus('red'), trackStatus('green'), trackStatus('red')])
		);

		assert.equal(step.replica?.seq, 7);
		assert.equal(step.replica?.snapshot.trackStatus, 'red');
		assert.deepEqual(
			step.replica?.snapshot.trackStatusLog?.map((change) => change.status),
			['green', 'red']
		);
	});

	it('asks for a fresh state after a gap or on another epoch', () => {
		assert.equal(applyServerMessage(replicaAt(5), events(7, [trackStatus('red')])).resync, true);
		assert.equal(
			applyServerMessage(replicaAt(5), events(6, [trackStatus('red')], 'b')).resync,
			true
		);
		assert.equal(
			applyServerMessage(replicaAt(5), { type: 'heartbeat', epoch: 'b', seq: 5, at: 0 }).resync,
			true
		);
		assert.equal(applyServerMessage(null, events(1, [trackStatus('red')])).resync, true);
	});

	it('reads only messages of its protocol version', () => {
		assert.equal(parseServerMessage('{"v":2,"type":"state","epoch":"a"}'), null);
		assert.equal(parseServerMessage('not json'), null);
		assert.equal(
			parseServerMessage('{"v":1,"type":"heartbeat","epoch":"a","seq":1,"at":0}')?.type,
			'heartbeat'
		);
	});
});

type FakeSocket = { url: string; handlers: SocketHandlers; sent: string[]; closed: boolean };

function fakeServer() {
	const sockets: FakeSocket[] = [];

	const createSocket = (url: string, handlers: SocketHandlers) => {
		const socket: FakeSocket = { url, handlers, sent: [], closed: false };

		sockets.push(socket);

		return {
			send: (data: string) => socket.sent.push(data),
			close: () => {
				socket.closed = true;
				handlers.closed();
			}
		};
	};

	const send = (socket: FakeSocket | undefined, message: ServerMessage) =>
		socket?.handlers.message(JSON.stringify({ v: 1, ...message }));

	return { sockets, createSocket, send };
}

describe('LiveFeed', () => {
	it('resumes from its sequence number after a drop, and goes stale when the server is quiet', () => {
		mock.timers.enable({ apis: ['setTimeout', 'Date'] });

		const server = fakeServer();

		const feed = new LiveFeed('ws://pitwall.test/live', {
			createSocket: server.createSocket,
			heartbeatMs: 1000,
			notifyMs: 0,
			random: () => 1
		});

		feed.start();
		server.send(server.sockets[0], state(10));
		server.send(server.sockets[0], events(11, [trackStatus('red')]));
		assert.equal(feed.getState().connection, 'live');
		assert.equal(feed.getState().replica?.seq, 11);

		mock.timers.tick(1500);
		assert.equal(feed.getState().connection, 'stale');

		mock.timers.tick(500);
		assert.equal(server.sockets[0]?.closed, true);
		assert.equal(feed.getState().connection, 'reconnecting');

		mock.timers.tick(1000);
		assert.equal(server.sockets[1]?.url, 'ws://pitwall.test/live?epoch=a&since=11');

		server.send(server.sockets[1], events(11, [trackStatus('red'), trackStatus('green')]));
		assert.equal(feed.getState().replica?.seq, 12);
		assert.equal(feed.getState().replica?.snapshot.trackStatus, 'green');
		assert.equal(liveSessionKey(feed.getState()), '11730');

		feed.stop();
		mock.timers.reset();
	});

	it('subscribes car positions while watched, again after a reconnect, and says when the feed has none', () => {
		mock.timers.enable({ apis: ['setTimeout', 'Date'] });

		const server = fakeServer();

		const feed = new LiveFeed('ws://pitwall.test/live', {
			createSocket: server.createSocket,
			random: () => 1
		});

		const frames: number[] = [];

		feed.start();

		const stop = feed.watchPositions((frame) => frames.push(frame.at));

		assert.deepEqual(server.sockets[0]?.sent, [], 'not before the socket has answered');
		server.send(server.sockets[0], state(10));
		assert.deepEqual(server.sockets[0]?.sent, ['{"type":"subscribe","channel":"positions"}']);

		server.sockets[0]?.handlers.message(
			'{"v":1,"type":"channels","subscribed":["positions"],"live":{"positions":false,"car_data":false}}'
		);
		assert.equal(feed.getPositionsLive(), false);

		const at = 1_763_870_480_250;

		for (const time of [at, at + 300_000, at + 340_000, at + 340_250]) {
			server.sockets[0]?.handlers.message(
				`{"v":1,"type":"positions","at":${time},"cars":{"1":[332,198,1]}}`
			);
		}

		assert.deepEqual(frames, [at, at + 300_000, at + 340_000, at + 340_250]);

		// A map opened later gets the last five and a half minutes, for a screen behind a delay.
		const late: number[] = [];
		const stopLate = feed.watchPositions((frame) => late.push(frame.at));

		assert.deepEqual(late, [at + 300_000, at + 340_000, at + 340_250]);
		stopLate();

		server.sockets[0]?.handlers.closed();
		mock.timers.tick(1000);
		server.send(server.sockets[1], state(10));
		assert.deepEqual(server.sockets[1]?.sent, ['{"type":"subscribe","channel":"positions"}']);

		stop();
		assert.equal(server.sockets[1]?.sent.at(-1), '{"type":"unsubscribe","channel":"positions"}');
		feed.stop();
		mock.timers.reset();
	});

	it('asks for a fresh state when it falls behind', () => {
		const server = fakeServer();
		const feed = new LiveFeed('ws://pitwall.test/live', { createSocket: server.createSocket });

		feed.start();
		server.send(server.sockets[0], state(10));
		server.send(server.sockets[0], events(20, [trackStatus('red')]));

		assert.deepEqual(server.sockets[0]?.sent, ['{"type":"resync"}']);
		assert.equal(feed.getState().replica?.seq, 10);
		feed.stop();
	});
});
