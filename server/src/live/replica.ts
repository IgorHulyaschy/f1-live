import { EMPTY_SNAPSHOT, applyEvent } from '@f1-live/shared';
import type { RaceSnapshot } from '@f1-live/shared';
import { z } from 'zod';

import { PROTOCOL_VERSION } from './protocol.js';
import type { ServerMessage } from './protocol.js';

const envelopeSchema = z.object({
	v: z.literal(PROTOCOL_VERSION),
	type: z.enum(['state', 'events', 'heartbeat'])
});

/** Reads one WebSocket text message; null when it is not a message of this protocol version. */
export function parseServerMessage(text: string): ServerMessage | null {
	try {
		const json: unknown = JSON.parse(text);

		// SAFETY: the envelope names the type and version; the server sends the matching body.
		return envelopeSchema.safeParse(json).success ? (json as ServerMessage) : null;
	} catch {
		return null;
	}
}

export type ReplicaStep = 'ok' | 'resync';

/**
 * A viewer's copy of the live session, kept up to date by the rules in
 * docs/product/live-protocol.md. The server's tests and the load tool use it as the reference
 * client.
 */
export class LiveReplica {
	epoch: string | null = null;
	seq = 0;
	snapshot: RaceSnapshot = EMPTY_SNAPSHOT;

	/** `resync` means the copy cannot follow this message: send `{"type":"resync"}`. */
	apply(message: ServerMessage): ReplicaStep {
		switch (message.type) {
			case 'state':
				this.epoch = message.epoch;
				this.seq = message.seq;
				this.snapshot = message.snapshot;

				return 'ok';
			case 'events': {
				if (message.epoch !== this.epoch || message.from > this.seq + 1) {
					return 'resync';
				}

				// Events already in the state this copy was given are skipped.
				for (const event of message.events.slice(this.seq + 1 - message.from)) {
					this.snapshot = applyEvent(this.snapshot, event);
					this.seq += 1;
				}

				return 'ok';
			}

			case 'heartbeat':
				return message.epoch === this.epoch ? 'ok' : 'resync';
		}
	}
}
