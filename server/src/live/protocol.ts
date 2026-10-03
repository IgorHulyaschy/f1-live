import type { RaceEvent, RaceSnapshot } from '@f1-live/shared';
import { z } from 'zod';

/** Bumped when a message changes shape; documented in docs/product/live-protocol.md. */
export const PROTOCOL_VERSION = 1;

/** The full state of the session now. A client replaces everything it holds with it. */
export interface StateMessage {
	v: typeof PROTOCOL_VERSION;
	type: 'state';
	/** Names one run of event numbers; `seq` is only comparable within an epoch. */
	epoch: string;
	/** The session's archive key, or null before any session has been seen. */
	sessionId: string | null;
	/** Number of the last event folded into `snapshot`. */
	seq: number;
	/** Server clock, ms since the Unix epoch. */
	at: number;
	snapshot: RaceSnapshot;
}

/** Events `from`, `from + 1`, ... in order; the last one is number `from + events.length - 1`. */
export interface EventsMessage {
	v: typeof PROTOCOL_VERSION;
	type: 'events';
	epoch: string;
	from: number;
	/** When the server applied the first event, ms since the Unix epoch. */
	at: number;
	events: readonly RaceEvent[];
}

/** Sent on a timer so a quiet feed can be told from a dead connection. */
export interface HeartbeatMessage {
	v: typeof PROTOCOL_VERSION;
	type: 'heartbeat';
	epoch: string;
	seq: number;
	at: number;
}

export type ServerMessage = StateMessage | EventsMessage | HeartbeatMessage;

/** What a client may send: ask for a fresh `state`. */
const clientMessageSchema = z.object({ type: z.literal('resync') });

export function isResyncRequest(text: string): boolean {
	try {
		return clientMessageSchema.safeParse(JSON.parse(text)).success;
	} catch {
		return false;
	}
}

/** `GET /live?epoch=<epoch>&since=<seq>`: continue from event `since` of that epoch. */
export const resumeQuerySchema = z.object({
	epoch: z.string().min(1).max(64),
	since: z.coerce.number().int().min(0)
});

export type ResumeQuery = z.infer<typeof resumeQuerySchema>;
