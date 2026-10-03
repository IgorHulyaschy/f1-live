import type { RaceEvent } from '@f1-live/shared';
import type { WebSocket } from 'ws';

import { PROTOCOL_VERSION, isResyncRequest } from './protocol.js';
import type { EventsMessage, HeartbeatMessage, ResumeQuery } from './protocol.js';
import type { LiveSession, SessionUpdate } from './session.js';

export interface HubOptions {
	/** A viewer whose unsent data would pass this is cut off. */
	maxBufferBytes: number;
	pingMs: number;
	log: (event: string, fields: { [field: string]: string | number }) => void;
	now?: () => number;
}

interface Viewer {
	socket: WebSocket;
	alive: boolean;
}

/**
 * Fans the live session out to WebSocket viewers. Every update is serialised once for all of
 * them, and a viewer that cannot keep up is dropped rather than allowed to hold memory or slow
 * the others.
 */
export class LiveHub {
	private readonly session: LiveSession;
	private readonly options: HubOptions;
	private readonly now: () => number;
	private readonly viewers = new Set<Viewer>();
	private readonly unsubscribe: () => void;
	private readonly timer: NodeJS.Timeout;
	/** Updates of this tick, sent together after the tick's I/O so a burst is one message. */
	private pending: SessionUpdate[] = [];
	private flushScheduled = false;
	private stateCache: { epoch: string; seq: number; text: string } | null = null;
	private slowDrops = 0;

	constructor(session: LiveSession, options: HubOptions) {
		this.session = session;
		this.options = options;
		this.now = options.now ?? Date.now;
		this.unsubscribe = session.subscribe((update) => this.enqueue(update));
		this.timer = setInterval(() => this.keepAlive(), options.pingMs);
		this.timer.unref();
	}

	get size(): number {
		return this.viewers.size;
	}

	get slowDropped(): number {
		return this.slowDrops;
	}

	/** Greets a new viewer with the state, or with the events it missed when `resume` allows it. */
	attach(socket: WebSocket, resume: ResumeQuery | null) {
		const viewer: Viewer = { socket, alive: true };
		const missed = resume && this.session.resume(resume.epoch, resume.since);

		this.viewers.add(viewer);
		socket.on('pong', () => {
			viewer.alive = true;
		});
		socket.on('message', (data) => {
			viewer.alive = true;

			if (isResyncRequest(data.toString())) {
				this.send(viewer, this.stateText());
			}
		});
		socket.on('close', () => this.viewers.delete(viewer));
		socket.on('error', () => this.drop(viewer, 'error'));

		this.send(viewer, missed ? JSON.stringify(missed) : this.stateText());
	}

	close() {
		clearInterval(this.timer);
		this.unsubscribe();

		for (const viewer of this.viewers) {
			viewer.socket.close(1001, 'server stopping');
		}
	}

	private enqueue(update: SessionUpdate) {
		this.pending.push(update);

		if (!this.flushScheduled) {
			this.flushScheduled = true;
			setImmediate(() => this.flush());
		}
	}

	private flush() {
		const updates = this.pending;

		this.pending = [];
		this.flushScheduled = false;

		// A state update already holds every event applied before this flush.
		const texts = updates.some((update) => update.kind === 'state')
			? [this.stateText()]
			: mergeEvents(updates).map((message) => JSON.stringify(message));

		for (const text of texts) {
			for (const viewer of this.viewers) {
				this.send(viewer, text);
			}
		}
	}

	private stateText(): string {
		const { epoch, seq } = this.session.position;

		if (this.stateCache?.epoch !== epoch || this.stateCache.seq !== seq) {
			this.stateCache = { epoch, seq, text: JSON.stringify(this.session.state()) };
		}

		return this.stateCache.text;
	}

	private send(viewer: Viewer, text: string) {
		const { socket } = viewer;

		if (socket.readyState !== socket.OPEN) {
			return;
		}

		if (socket.bufferedAmount + text.length > this.options.maxBufferBytes) {
			this.slowDrops += 1;
			this.drop(viewer, 'slow');

			return;
		}

		socket.send(text, (error) => {
			if (error) {
				this.drop(viewer, 'send-failed');
			}
		});
	}

	private drop(viewer: Viewer, reason: string) {
		if (!this.viewers.delete(viewer)) {
			return;
		}

		this.options.log('viewer-dropped', {
			reason,
			buffered: viewer.socket.bufferedAmount,
			viewers: this.viewers.size
		});
		viewer.socket.terminate();
	}

	private keepAlive() {
		const { epoch, seq } = this.session.position;

		const heartbeat: HeartbeatMessage = {
			v: PROTOCOL_VERSION,
			type: 'heartbeat',
			epoch,
			seq,
			at: this.now()
		};

		const text = JSON.stringify(heartbeat);

		for (const viewer of this.viewers) {
			if (viewer.alive) {
				viewer.alive = false;
				viewer.socket.ping();
				this.send(viewer, text);
			} else {
				this.drop(viewer, 'no-pong');
			}
		}
	}
}

/** Consecutive updates of one epoch become one message. */
function mergeEvents(updates: readonly SessionUpdate[]): EventsMessage[] {
	const groups: {
		epoch: string;
		from: number;
		at: number;
		parts: (readonly RaceEvent[])[];
		count: number;
	}[] = [];

	for (const update of updates) {
		if (update.kind !== 'events') {
			continue;
		}

		const last = groups.at(-1);

		if (last?.epoch === update.epoch && last.from + last.count === update.from) {
			last.parts.push(update.events);
			last.count += update.events.length;
		} else {
			groups.push({
				epoch: update.epoch,
				from: update.from,
				at: update.at,
				parts: [update.events],
				count: update.events.length
			});
		}
	}

	return groups.map(({ epoch, from, at, parts }) => ({
		v: PROTOCOL_VERSION,
		type: 'events',
		epoch,
		from,
		at,
		events: parts.flat()
	}));
}
