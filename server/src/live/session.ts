import { randomUUID } from 'node:crypto';

import { EMPTY_SNAPSHOT, applyEvent } from '@f1-live/shared';
import type { RaceEvent, RaceSnapshot } from '@f1-live/shared';

import { PROTOCOL_VERSION } from './protocol.js';
import type { EventsMessage, StateMessage } from './protocol.js';

export type SessionUpdate =
	| { kind: 'events'; epoch: string; from: number; events: readonly RaceEvent[]; at: number }
	| { kind: 'state' };

/** Where a copy of the session stands: enough for the other side to know what it is missing. */
export interface Position {
	epoch: string;
	seq: number;
}

export type ReplicateResult = { applied: true } | { applied: false; position: Position };

/**
 * The live session in memory: the snapshot, the numbered events that built it and the last
 * ones kept so a viewer that reconnects can catch up. A different session starts a new epoch,
 * because event numbers of two sessions must never be mixed.
 */
export class LiveSession {
	private readonly maxLogEvents: number;
	private readonly now: () => number;
	private readonly listeners = new Set<(update: SessionUpdate) => void>();
	private currentEpoch: string = randomUUID();
	private snapshot: RaceSnapshot = EMPTY_SNAPSHOT;
	private seq = 0;
	/** Events `seq - log.length + 1` to `seq`. */
	private log: RaceEvent[] = [];

	constructor(maxLogEvents: number, now: () => number = Date.now) {
		this.maxLogEvents = maxLogEvents;
		this.now = now;
	}

	get position(): Position {
		return { epoch: this.currentEpoch, seq: this.seq };
	}

	get sessionId(): string | null {
		return this.snapshot.session.id || null;
	}

	get current(): RaceSnapshot {
		return this.snapshot;
	}

	subscribe(listener: (update: SessionUpdate) => void): () => void {
		this.listeners.add(listener);

		return () => this.listeners.delete(listener);
	}

	/** Applies events from the source. One that opens a different session starts a new epoch. */
	push(events: readonly RaceEvent[]): void {
		let start = 0;

		events.forEach((event, index) => {
			if (event.kind === 'session_info' && this.isOtherSession(event.session.id)) {
				this.append(events.slice(start, index));
				this.reset();
				start = index;
			}
		});

		this.append(events.slice(start));
	}

	/** The full state now. */
	state(): StateMessage {
		return {
			v: PROTOCOL_VERSION,
			type: 'state',
			epoch: this.currentEpoch,
			sessionId: this.sessionId,
			seq: this.seq,
			at: this.now(),
			snapshot: this.snapshot
		};
	}

	/** Events after number `since`, or null when they are not all kept. */
	eventsAfter(since: number): readonly RaceEvent[] | null {
		const firstKept = this.seq - this.log.length + 1;

		if (since > this.seq || since + 1 < firstKept) {
			return null;
		}

		return this.log.slice(since + 1 - firstKept);
	}

	/** What a viewer that has everything up to `since` of `epoch` is missing, if that is known. */
	resume(epoch: string, since: number): EventsMessage | null {
		const events = epoch === this.currentEpoch ? this.eventsAfter(since) : null;

		return (
			events && {
				v: PROTOCOL_VERSION,
				type: 'events',
				epoch,
				from: since + 1,
				at: this.now(),
				events
			}
		);
	}

	/**
	 * Relay side: applies events numbered `from` onwards that the ingest assigned. Overlap with
	 * what is already held is skipped, so a retried batch is harmless; a gap or another epoch is
	 * refused with this copy's position, so the ingest can resend from there.
	 */
	replicate(epoch: string, from: number, events: readonly RaceEvent[]): ReplicateResult {
		if (epoch !== this.currentEpoch || from > this.seq + 1) {
			return { applied: false, position: this.position };
		}

		this.append(events.slice(this.seq + 1 - from));

		return { applied: true };
	}

	/** Relay side: takes the ingest's whole state, e.g. after the relay restarted. */
	adopt(state: StateMessage): void {
		this.currentEpoch = state.epoch;
		this.snapshot = state.snapshot;
		this.seq = state.seq;
		this.log = [];
		this.emit({ kind: 'state' });
	}

	private isOtherSession(id: string): boolean {
		const current = this.sessionId;

		return current !== null && current !== id;
	}

	private reset() {
		this.currentEpoch = randomUUID();
		this.snapshot = EMPTY_SNAPSHOT;
		this.seq = 0;
		this.log = [];
		this.emit({ kind: 'state' });
	}

	private append(events: readonly RaceEvent[]) {
		if (events.length === 0) {
			return;
		}

		const from = this.seq + 1;

		for (const event of events) {
			this.snapshot = applyEvent(this.snapshot, event);
			this.log.push(event);
		}

		this.seq += events.length;

		// Trimmed in steps so a full log does not copy itself on every push.
		if (this.log.length > this.maxLogEvents * 1.25) {
			this.log = this.log.slice(-this.maxLogEvents);
		}

		this.emit({ kind: 'events', epoch: this.currentEpoch, from, events, at: this.now() });
	}

	private emit(update: SessionUpdate) {
		for (const listener of this.listeners) {
			listener(update);
		}
	}
}
