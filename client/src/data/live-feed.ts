import { applyEvent, type RaceEvent, type RaceSnapshot } from '@f1-live/shared';
import { z } from 'zod';

import { isSessionOver } from '../insights/qualifying.ts';
import { type Arrival, recordArrival } from './broadcast-delay.ts';

/** docs/product/live-protocol.md; a change of shape bumps it on both sides. */
const PROTOCOL_VERSION = 1;

type StateMessage = {
	type: 'state';
	epoch: string;
	sessionId: string | null;
	seq: number;
	at: number;
	snapshot: RaceSnapshot;
};

type EventsMessage = {
	type: 'events';
	epoch: string;
	from: number;
	at: number;
	events: readonly RaceEvent[];
};

type HeartbeatMessage = { type: 'heartbeat'; epoch: string; seq: number; at: number };

export type ServerMessage = StateMessage | EventsMessage | HeartbeatMessage;

const envelopeSchema = z.object({
	v: z.literal(PROTOCOL_VERSION),
	type: z.enum(['state', 'events', 'heartbeat']),
	epoch: z.string()
});

/** One WebSocket text frame; null when it is not a message of this protocol version. */
export function parseServerMessage(text: string): ServerMessage | null {
	try {
		const json: unknown = JSON.parse(text);

		// SAFETY: the envelope names the type and version; the server sends the matching body.
		return envelopeSchema.safeParse(json).success ? (json as ServerMessage) : null;
	} catch {
		return null;
	}
}

/** The viewer's copy of the session: the state it was given plus the events folded since. */
export type Replica = {
	epoch: string;
	seq: number;
	sessionId: string | null;
	snapshot: RaceSnapshot;
};

/**
 * One step of the protocol's client rules. `resync` means this copy cannot follow the message
 * and must ask for a fresh state; the copy is unchanged then.
 */
export type ReplicaStep = { replica: Replica | null; resync: boolean };

export function applyServerMessage(replica: Replica | null, message: ServerMessage): ReplicaStep {
	if (message.type === 'state') {
		return {
			replica: {
				epoch: message.epoch,
				seq: message.seq,
				sessionId: message.sessionId,
				snapshot: message.snapshot
			},
			resync: false
		};
	}

	if (!replica || message.epoch !== replica.epoch) {
		return { replica, resync: true };
	}

	if (message.type === 'heartbeat') {
		return { replica, resync: false };
	}

	if (message.from > replica.seq + 1) {
		return { replica, resync: true };
	}

	// Events already in the state this copy was given are skipped.
	const fresh = message.events.slice(replica.seq + 1 - message.from);

	if (fresh.length === 0) {
		return { replica, resync: false };
	}

	return {
		replica: {
			...replica,
			seq: replica.seq + fresh.length,
			snapshot: fresh.reduce(applyEvent, replica.snapshot)
		},
		resync: false
	};
}

/**
 * `connecting` until the first state, `live` while messages arrive, `stale` when the server has
 * gone quiet for longer than its heartbeat, `reconnecting` after a drop.
 */
export type LiveConnection = 'connecting' | 'live' | 'stale' | 'reconnecting';

export type LiveState = {
	connection: LiveConnection;
	replica: Replica | null;
	/** The session's states as they arrived, for a broadcast delay. */
	arrivals: readonly Arrival[];
};

/** What the feed hears from a socket. */
export type SocketHandlers = {
	message: (text: string) => void;
	closed: () => void;
};

/** The parts of a WebSocket the feed uses, so tests can drive it without a server. */
export type SocketLike = {
	send: (data: string) => void;
	close: () => void;
};

function browserSocket(url: string, handlers: SocketHandlers): SocketLike {
	const socket = new WebSocket(url);

	socket.addEventListener('message', (event: MessageEvent<string>) => handlers.message(event.data));
	socket.addEventListener('close', () => handlers.closed());
	socket.addEventListener('error', () => socket.close());

	return socket;
}

export type LiveFeedOptions = {
	createSocket?: (url: string, handlers: SocketHandlers) => SocketLike;
	/** The server's heartbeat; the default WS_PING_SECONDS is 20. */
	heartbeatMs?: number;
	/** Listeners hear about a burst of messages at most this often. */
	notifyMs?: number;
	random?: () => number;
};

const BACKOFF_MS = { initial: 1000, max: 30_000 };

/**
 * Follows `WS /live`: keeps a replica by the protocol's rules, resumes from its sequence number
 * after a drop, and reconnects with exponential backoff and jitter. Listeners are told at most
 * every `notifyMs`, so a feed that sends many small batches does not redraw the screen for each.
 */
export class LiveFeed {
	private readonly url: string;
	private readonly createSocket: (url: string, handlers: SocketHandlers) => SocketLike;
	private readonly heartbeatMs: number;
	private readonly notifyMs: number;
	private readonly random: () => number;
	private readonly listeners = new Set<() => void>();
	private state: LiveState = { connection: 'connecting', replica: null, arrivals: [] };
	private socket: SocketLike | null = null;
	private attempt = 0;
	private stopped = true;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private staleTimer: ReturnType<typeof setTimeout> | null = null;
	private deadTimer: ReturnType<typeof setTimeout> | null = null;
	private notifyTimer: ReturnType<typeof setTimeout> | null = null;
	private lastNotifiedAt = 0;

	constructor(url: string, options: LiveFeedOptions = {}) {
		this.url = url;
		this.createSocket = options.createSocket ?? browserSocket;
		this.heartbeatMs = options.heartbeatMs ?? 20_000;
		this.notifyMs = options.notifyMs ?? 250;
		this.random = options.random ?? Math.random;
	}

	getState = (): LiveState => this.state;

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);

		return () => this.listeners.delete(listener);
	};

	start(): void {
		if (!this.stopped) {
			return;
		}

		this.stopped = false;
		this.connect();
	}

	stop(): void {
		this.stopped = true;
		this.clearTimers();
		this.socket?.close();
		this.socket = null;
	}

	private connect(): void {
		const { replica } = this.state;

		const url = replica
			? `${this.url}?epoch=${encodeURIComponent(replica.epoch)}&since=${replica.seq}`
			: this.url;

		const socket = this.createSocket(url, {
			message: (text) => this.receive(socket, text),
			closed: () => this.dropped(socket)
		});

		this.socket = socket;
		this.watch();
	}

	private receive(socket: SocketLike, text: string): void {
		const message = parseServerMessage(text);

		if (!message || socket !== this.socket) {
			return;
		}

		const { replica, resync } = applyServerMessage(this.state.replica, message);

		if (resync) {
			socket.send(JSON.stringify({ type: 'resync' }));
		}

		this.attempt = 0;
		this.watch();

		const previous = this.state.replica;
		const sameSession = previous?.sessionId === replica?.sessionId;

		const arrivals =
			replica && replica !== previous
				? recordArrival(sameSession ? this.state.arrivals : [], {
						receivedAt: Date.now(),
						snapshot: replica.snapshot
					})
				: this.state.arrivals;

		this.update({ connection: 'live', replica, arrivals }, replica === previous);
	}

	private dropped(socket: SocketLike): void {
		if (socket !== this.socket || this.stopped) {
			return;
		}

		this.socket = null;
		this.clearTimers();

		const delay = Math.min(BACKOFF_MS.initial * 2 ** this.attempt, BACKOFF_MS.max);

		this.attempt += 1;
		this.reconnectTimer = setTimeout(() => this.connect(), delay * (0.5 + this.random() / 2));
		this.update({ ...this.state, connection: 'reconnecting' }, false);
	}

	/** Quiet for a heartbeat and a half reads as stale; for two, the connection is dead. */
	private watch(): void {
		this.clearWatch();
		this.staleTimer = setTimeout(() => {
			this.update({ ...this.state, connection: 'stale' }, false);
		}, this.heartbeatMs * 1.5);
		this.deadTimer = setTimeout(() => this.socket?.close(), this.heartbeatMs * 2);
	}

	private update(next: LiveState, sameReplica: boolean): void {
		if (sameReplica && next.connection === this.state.connection) {
			return;
		}

		const urgent = next.connection !== this.state.connection;

		this.state = next;
		this.schedule(urgent);
	}

	private schedule(urgent: boolean): void {
		if (this.notifyTimer !== null) {
			return;
		}

		const wait = urgent ? 0 : Math.max(0, this.lastNotifiedAt + this.notifyMs - Date.now());

		this.notifyTimer = setTimeout(() => {
			this.notifyTimer = null;
			this.lastNotifiedAt = Date.now();

			for (const listener of this.listeners) {
				listener();
			}
		}, wait);
	}

	private clearWatch(): void {
		if (this.staleTimer !== null) {
			clearTimeout(this.staleTimer);
		}

		if (this.deadTimer !== null) {
			clearTimeout(this.deadTimer);
		}

		this.staleTimer = null;
		this.deadTimer = null;
	}

	private clearTimers(): void {
		this.clearWatch();

		if (this.reconnectTimer !== null) {
			clearTimeout(this.reconnectTimer);
		}

		if (this.notifyTimer !== null) {
			clearTimeout(this.notifyTimer);
		}

		this.reconnectTimer = null;
		this.notifyTimer = null;
	}
}

/** The session the feed is on, if it is still running: ended sessions are saved files. */
export function liveSessionKey(state: LiveState): string | null {
	const replica = state.replica;

	if (!replica?.sessionId) {
		return null;
	}

	return isSessionOver(replica.snapshot.status ?? 'inactive') ? null : replica.sessionId;
}
