/**
 * Windows agree on one order of play and pause. Each play or pause starts a new epoch: a counter
 * and the window that sent it. Steps carry the epoch of the play they belong to.
 */
export type PlaybackEpoch = { count: number; sender: string };

export const INITIAL_EPOCH: PlaybackEpoch = { count: 0, sender: '' };

function isOlder(a: PlaybackEpoch, b: PlaybackEpoch): boolean {
	return a.count < b.count || (a.count === b.count && a.sender < b.sender);
}

/** The epoch of a play or pause sent now, newer than any this window has seen. */
export function nextEpoch(last: PlaybackEpoch, sender: string): PlaybackEpoch {
	return { count: last.count + 1, sender };
}

export type PlaybackMessage = { epoch?: PlaybackEpoch; playing?: boolean; tick?: true };

export type PlaybackDecision = { apply: boolean; last: PlaybackEpoch };

/**
 * Whether to apply a received message, and the last epoch seen afterwards. A play or pause from
 * an older epoch is dropped. A step is applied only while this window follows playback, and only
 * from the epoch it follows.
 */
export function receivePlayback(
	last: PlaybackEpoch,
	message: PlaybackMessage,
	following: boolean
): PlaybackDecision {
	const { epoch } = message;

	if (message.tick) {
		return { apply: following && epoch !== undefined && !isOlder(epoch, last), last };
	}

	if (message.playing === undefined || epoch === undefined) {
		return { apply: true, last };
	}

	return isOlder(epoch, last) ? { apply: false, last } : { apply: true, last: epoch };
}
