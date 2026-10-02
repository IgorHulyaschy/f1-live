import { Topic } from './types/constants.js';
import type { LiveEvent } from './types/live-events.types.js';
import type { DriverListEvent, SessionEvent } from './types/sync-events.types.js';

/** SignalR record separator between JSON frames. */
export const FRAME_DELIMITER = '\x1e';

const MessageType = {
	INVOCATION: 1,
	COMPLETION: 3,
	PING: 6
} as const;

export type SnapshotFrame = {
	sessionInfo?: SessionEvent;
	driverList?: DriverListEvent;
};

export type FeedFrame =
	| { kind: 'handshake' }
	| { kind: 'ping' }
	| { kind: 'snapshot'; snapshot: SnapshotFrame }
	| { kind: 'live'; event: LiveEvent }
	| { kind: 'ignored' };

type RawFrame = {
	type?: number;
	target?: string;
	arguments?: LiveEvent | string;
	result?: {
		[Topic.SESSION_INFO]?: SessionEvent;
		[Topic.DRIVER_LIST]?: DriverListEvent;
	};
};

/**
 * Parses one SignalR frame from the live timing hub. This is the trust boundary for the
 * feed: payload shapes are the hub's undocumented contract and are not validated further.
 */
export function parseFeedFrame(text: string): FeedFrame {
	if (text === '{}') {
		return { kind: 'handshake' };
	}

	const raw: RawFrame = JSON.parse(text);

	if (raw.type === MessageType.PING) {
		return { kind: 'ping' };
	}

	if (raw.type === MessageType.COMPLETION && raw.result) {
		return {
			kind: 'snapshot',
			snapshot: {
				sessionInfo: raw.result[Topic.SESSION_INFO],
				driverList: raw.result[Topic.DRIVER_LIST]
			}
		};
	}

	if (
		raw.type === MessageType.INVOCATION &&
		raw.target === 'feed' &&
		Array.isArray(raw.arguments) &&
		isHandledTopic(raw.arguments[0])
	) {
		return { kind: 'live', event: raw.arguments };
	}

	return { kind: 'ignored' };
}

const HANDLED_TOPICS: ReadonlySet<string> = new Set(Object.values(Topic));

function isHandledTopic(topic: string): boolean {
	return HANDLED_TOPICS.has(topic);
}
