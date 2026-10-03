import type { RaceSnapshot } from '@f1-live/shared';

export type ClockReading = {
	remainingMs: number;
	/** Counting down; false while the clock is held, as for a red flag or between parts. */
	running: boolean;
};

/**
 * The session clock at `timeMs`, from the last time the feed set it before then; null when the
 * feed never did, as in sessions saved before the clock was kept.
 */
export function clockAt(snapshot: RaceSnapshot, timeMs: number): ClockReading | null {
	const at = new Date(timeMs).toISOString();
	const mark = (snapshot.clockLog ?? []).findLast((entry) => entry.at <= at);

	if (!mark) {
		return null;
	}

	const elapsed = mark.running ? timeMs - Date.parse(mark.at) : 0;

	return { remainingMs: Math.max(0, mark.remainingMs - elapsed), running: mark.running };
}

/** 522000 → "8:42", 3723000 → "1:02:03": a countdown, to the second. */
export function formatCountdown(ms: number): string {
	const total = Math.ceil(ms / 1000);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = String(total % 60).padStart(2, '0');

	return hours > 0
		? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
		: `${minutes}:${seconds}`;
}
