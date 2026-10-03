import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setImmediate as nextTick, setTimeout as sleep } from 'node:timers/promises';

import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';

import type { TopicFrame } from '../sources/f1/decode.js';
import type { JsonObject } from '../sources/f1/live.js';

const SEPARATOR = '\x1e';

const PING_MS = 5000;

/** Unsent bytes at which a fast replay waits for the socket instead of buffering the session. */
const SOCKET_HIGH_WATER = 1024 * 1024;

const YIELD_EVERY = 256;

export interface FakeUpstreamOptions {
	/** Session seconds per real second; `Infinity` sends everything as fast as the socket takes it. */
	speed: number;
	/** Closes the connection once this many frames have been sent, as a hub restart would. */
	dropAfter?: readonly number[];
}

function encode(message: JsonObject): string {
	return `${JSON.stringify(message)}${SEPARATOR}`;
}

/** Frame and snapshot payloads stay as parsed from the archive, so they are written by hand. */
function feedInvocation(frame: TopicFrame): string {
	const timestamp = JSON.stringify(new Date(frame.timestamp).toISOString());

	return `{"type":1,"target":"feed","arguments":[${JSON.stringify(frame.topic)},${JSON.stringify(frame.data)},${timestamp}]}${SEPARATOR}`;
}

/**
 * A stand-in for the live timing hub that plays back a saved session: it speaks the same
 * SignalR dialect (negotiate, handshake, `Subscribe` and `feed` invocations), so the real client
 * runs against it unchanged. A connection that drops resumes at the next unsent frame.
 */
export class FakeUpstream {
	readonly url: string;
	private readonly frames: readonly TopicFrame[];
	private readonly options: FakeUpstreamOptions;
	private readonly server: ReturnType<typeof createServer>;
	private readonly sockets: WebSocketServer;
	private readonly dropAfter: Set<number>;
	private cursor = 0;
	private opened = 0;
	private clock: number;
	private startedAt = 0;
	private finished: () => void = () => undefined;

	/** Settles when the last frame has been sent. */
	readonly done = new Promise<void>((resolve) => {
		this.finished = resolve;
	});

	private constructor(
		frames: readonly TopicFrame[],
		options: FakeUpstreamOptions,
		server: ReturnType<typeof createServer>,
		sockets: WebSocketServer,
		url: string
	) {
		this.frames = frames;
		this.options = options;
		this.dropAfter = new Set(options.dropAfter);
		this.server = server;
		this.sockets = sockets;
		this.url = url;
		this.clock = frames[0]?.timestamp ?? Date.now();
	}

	static async start(
		frames: readonly TopicFrame[],
		options: FakeUpstreamOptions,
		port = 0
	): Promise<FakeUpstream> {
		const server = createServer((request, response) => {
			if (!request.url?.startsWith('/signalrcore/negotiate')) {
				response.writeHead(404).end();
			} else if (request.method === 'OPTIONS') {
				response.writeHead(204, { 'Set-Cookie': 'AWSALBCORS=fake; Path=/' }).end();
			} else {
				response.writeHead(200, { 'Content-Type': 'application/json' });
				response.end(JSON.stringify({ connectionToken: 'fake', connectionId: 'fake' }));
			}
		});

		const sockets = new WebSocketServer({ server, path: '/signalrcore' });

		await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));

		// SAFETY: a server listening on a TCP port reports an AddressInfo.
		const address = server.address() as AddressInfo;

		const upstream = new FakeUpstream(
			frames,
			options,
			server,
			sockets,
			`http://127.0.0.1:${address.port.toString()}/signalrcore`
		);

		sockets.on('connection', (socket) => upstream.serve(socket));

		return upstream;
	}

	/** Session time of the last frame sent, in ms since the Unix epoch. */
	now = (): number => this.clock;

	/** Connections that have subscribed so far. */
	get connections(): number {
		return this.opened;
	}

	/** Frames sent so far. */
	get sent(): number {
		return this.cursor;
	}

	/** Cuts every connection, as a network failure would. */
	dropConnections() {
		for (const socket of this.sockets.clients) {
			socket.terminate();
		}
	}

	async close() {
		this.dropConnections();
		this.sockets.close();
		await new Promise<void>((resolve) => this.server.close(() => resolve()));
	}

	private serve(socket: WebSocket) {
		const ping = setInterval(() => socket.send(encode({ type: 6 })), PING_MS);

		socket.on('close', () => clearInterval(ping));
		socket.on('message', (data) => {
			for (const text of data.toString().split(SEPARATOR).filter(Boolean)) {
				const message = JSON.parse(text);

				if (message.protocol === 'json') {
					socket.send(encode({}));
				} else if (message.target === 'Subscribe') {
					socket.send(this.subscribeCompletion(message.invocationId));
					// Frames wait for the client's answer to this ping, so the client has handled the
					// subscribe result before the session clock moves on.
					socket.send(encode({ type: 6 }));
					socket.once('message', () => {
						this.opened += 1;
						void this.stream(socket);
					});
				}
			}
		});
	}

	/** The topics that exist before the first frame: the session itself. */
	private subscribeCompletion(invocationId: string): string {
		const info = this.frames.find((frame) => frame.topic === 'SessionInfo');
		const result = info ? `{"SessionInfo":${JSON.stringify(info.data)}}` : '{}';

		return `{"type":3,"invocationId":${JSON.stringify(invocationId)},"result":${result}}${SEPARATOR}`;
	}

	private async stream(socket: WebSocket) {
		const { speed } = this.options;

		this.startedAt = this.startedAt || Date.now();

		const origin = this.frames[0]?.timestamp ?? 0;
		let sinceYield = 0;

		while (this.cursor < this.frames.length && socket.readyState === socket.OPEN) {
			if (this.dropAfter.delete(this.cursor)) {
				socket.close(1012, 'restart');

				return;
			}

			const frame = this.frames[this.cursor];

			if (!frame) {
				break;
			}

			if (Number.isFinite(speed)) {
				// oxlint-disable-next-line no-await-in-loop -- frames go out in order, at their pace.
				const waitMs = this.startedAt + (frame.timestamp - origin) / speed - Date.now();

				if (waitMs > 1) {
					// oxlint-disable-next-line no-await-in-loop -- see above.
					await sleep(waitMs);
				}
			} else {
				sinceYield += 1;

				if (sinceYield % YIELD_EVERY === 0) {
					// oxlint-disable-next-line no-await-in-loop -- see above.
					await nextTick();
				}

				while (socket.bufferedAmount > SOCKET_HIGH_WATER && socket.readyState === socket.OPEN) {
					// oxlint-disable-next-line no-await-in-loop -- see above.
					await sleep(2);
				}
			}

			if (socket.readyState !== socket.OPEN) {
				return;
			}

			this.clock = frame.timestamp;
			this.cursor += 1;
			socket.send(feedInvocation(frame));
		}

		if (this.cursor >= this.frames.length) {
			this.finished();
		}
	}
}
