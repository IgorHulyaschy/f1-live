/**
 * The spoiler rule, in one place. Every screen that shows a session or its result asks these:
 * the replay, the session picker, ⌘K, the live strip and the page title, and the calendar,
 * standings and library that list sessions (docs/product/flows.md#spoilers). `isRevealed` and
 * `resultsHidden` live in shared/src/viewer.ts, so the server's push alerts ask the same question.
 */

import { isRevealed, MAX_REVEALED, type SpoilerSettings } from '@f1-live/shared/viewer';

export { isRevealed, resultsHidden, type SpoilerSettings } from '@f1-live/shared/viewer';

/**
 * Where a session opens, as a replay step: the one a link asks for, else the start while its
 * results are hidden, else `revealedStep` (the end, or wherever the source starts a replay).
 */
export function spoilerSafeStep({
	requested,
	hidden,
	lastStep,
	revealedStep
}: {
	/** The step in the address, unparsed; null when there is none. */
	requested: string | null;
	hidden: boolean;
	lastStep: number;
	revealedStep: number;
}): number {
	const step = Number(requested);

	if (requested !== null && Number.isInteger(step) && step > 0) {
		return Math.min(step, lastStep);
	}

	return hidden ? 1 : revealedStep;
}

/** The reveals with `sessionKey` added as the newest, the oldest dropped past the limit. */
export function withRevealed(revealed: readonly string[], sessionKey: string): string[] {
	return [...revealed.filter((key) => key !== sessionKey), sessionKey].slice(-MAX_REVEALED);
}

/** Results older than this count in standings, driver pages and comparisons without a reveal. */
export const HISTORY_SPOILER_DAYS = 30;

/**
 * Whether a session's result is held back from the history views (standings, driver pages,
 * head-to-head): the viewer has not revealed it and it started within the last
 * `HISTORY_SPOILER_DAYS`. Older results are history, and asking for a reveal of each of hundreds of
 * sessions would make those views unusable.
 */
export function heldFromHistory(
	settings: SpoilerSettings,
	sessionKey: string,
	startsAt: string,
	now: number
): boolean {
	return (
		!isRevealed(settings, sessionKey) &&
		now - Date.parse(startsAt) < HISTORY_SPOILER_DAYS * 24 * 60 * 60 * 1000
	);
}
