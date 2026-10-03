import type { LiveCarData, LivePositions, RaceEvent, RaceSnapshot } from '@f1-live/shared';
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

/** Opt-in streams beside the session, which a viewer without a track map never receives. */
export const CHANNELS = ['positions', 'car_data'] as const;

export type Channel = (typeof CHANNELS)[number];

/** Every car's place on the circuit, up to 4 times a second. */
export interface PositionsMessage extends LivePositions {
	v: typeof PROTOCOL_VERSION;
	type: 'positions';
}

/** Every car's speed, gear, pedals, rpm and DRS, up to 4 times a second. */
export interface CarDataMessage extends LiveCarData {
	v: typeof PROTOCOL_VERSION;
	type: 'car_data';
}

/** The answer to a `subscribe` or `unsubscribe`: what the viewer receives, and what the feed has. */
export interface ChannelsMessage {
	v: typeof PROTOCOL_VERSION;
	type: 'channels';
	subscribed: Channel[];
	/** Whether the feed has sent that channel's data: not without an F1 TV token. */
	live: { [channel in Channel]: boolean };
}

export type ChannelMessage = PositionsMessage | CarDataMessage | ChannelsMessage;

/** What a client may send: ask for a fresh `state`, or opt in to or out of a channel. */
const clientMessageSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('resync') }),
	z.object({ type: z.literal('subscribe'), channel: z.enum(CHANNELS) }),
	z.object({ type: z.literal('unsubscribe'), channel: z.enum(CHANNELS) })
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

/** Reads one message from a client; null when it is not one of these. */
export function parseClientMessage(text: string): ClientMessage | null {
	try {
		const parsed = clientMessageSchema.safeParse(JSON.parse(text));

		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

/** `GET /live?epoch=<epoch>&since=<seq>`: continue from event `since` of that epoch. */
export const resumeQuerySchema = z.object({
	epoch: z.string().min(1).max(64),
	since: z.coerce.number().int().min(0)
});

export type ResumeQuery = z.infer<typeof resumeQuerySchema>;
