import type { RaceEvent } from '@f1-live/shared';
import type { WebSocket } from 'ws';

import { CHANNELS, PROTOCOL_VERSION, parseClientMessage } from './protocol.js';
import type {
	Channel,
	ChannelsMessage,
	EventsMessage,
	HeartbeatMessage,
	ResumeQuery
} from './protocol.js';
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
	/** The opt-in channels this viewer asked for. */
	channels: Set<Channel>;
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
	/** Per channel: whether the feed has sent it, and the last message so a new subscriber has one. */
	private readonly channelState = new Map<Channel, { live: boolean; latest: string | null }>(
		CHANNELS.map((channel) => [channel, { live: false, latest: null }])
	);

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
		const viewer: Viewer = { socket, alive: true, channels: new Set() };
		const missed = resume && this.session.resume(resume.epoch, resume.since);

		this.viewers.add(viewer);
		socket.on('pong', () => {
			viewer.alive = true;
		});
		socket.on('message', (data) => {
			viewer.alive = true;

			const message = parseClientMessage(data.toString());

			if (message?.type === 'resync') {
				this.send(viewer, this.stateText());
			} else if (message?.type === 'subscribe') {
				viewer.channels.add(message.channel);
				this.send(viewer, this.channelsText(viewer));

				const latest = this.channelState.get(message.channel)?.latest;

				if (latest) {
					this.send(viewer, latest);
				}
			} else if (message?.type === 'unsubscribe') {
				viewer.channels.delete(message.channel);
				this.send(viewer, this.channelsText(viewer));
			}
		});
		socket.on('close', () => this.viewers.delete(viewer));
		socket.on('error', () => this.drop(viewer, 'error'));

		this.send(viewer, missed ? JSON.stringify(missed) : this.stateText());
	}

	/** Whether any viewer receives `channel`: when none does, nobody needs it decoded. */
	wants(channel: Channel): boolean {
		return [...this.viewers].some((viewer) => viewer.channels.has(channel));
	}

	/** The feed sent data for `channel`; viewers are told so when they subscribe. */
	markLive(channel: Channel) {
		const state = this.channelState.get(channel);

		if (state && !state.live) {
			state.live = true;

			for (const viewer of this.viewers) {
				if (viewer.channels.has(channel)) {
					this.send(viewer, this.channelsText(viewer));
				}
			}
		}
	}

	/** Sends one message to the viewers subscribed to `channel`, and keeps it for the next one. */
	publish(channel: Channel, text: string) {
		const state = this.channelState.get(channel);

		if (state) {
			state.latest = text;
		}

		for (const viewer of this.viewers) {
			if (viewer.channels.has(channel)) {
				this.send(viewer, text);
			}
		}
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

	private channelsText(viewer: Viewer): string {
		const live = (channel: Channel) => this.channelState.get(channel)?.live ?? false;

		const message: ChannelsMessage = {
			v: PROTOCOL_VERSION,
			type: 'channels',
			subscribed: CHANNELS.filter((channel) => viewer.channels.has(channel)),
			live: { positions: live('positions'), car_data: live('car_data') }
		};

		return JSON.stringify(message);
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
