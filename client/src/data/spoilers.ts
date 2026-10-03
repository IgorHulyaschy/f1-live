/**
 * The spoiler rule, in one place. Every screen that shows a session or its result asks these:
 * the replay, the session picker, ⌘K, the live strip and the page title, and the calendar,
 * standings and library that list sessions (docs/product/flows.md#spoilers).
 */

/** What the viewer chose: protection on or off, and the sessions whose results they have seen. */
export type SpoilerSettings = { protect: boolean; revealed: readonly string[] };

/** Reveals kept per viewer, newest last: a few seasons of sessions. */
export const MAX_REVEALED = 200;

/** The viewer may see this session's result: protection is off, or they revealed it. */
export function isRevealed(settings: SpoilerSettings, sessionKey: string): boolean {
	return !settings.protect || settings.revealed.includes(sessionKey);
}

/**
 * The result of a session is hidden: it is not being watched live and the viewer has not
 * revealed it. A live session is never hidden, since its latest state is what is happening now.
 */
export function resultsHidden(
	settings: SpoilerSettings,
	sessionKey: string,
	watchedLive: boolean
): boolean {
	return !watchedLive && !isRevealed(settings, sessionKey);
}

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

/** Two devices' reveals together, as an account keeps them: this device's order, then the rest. */
export function mergeRevealed(local: readonly string[], remote: readonly string[]): string[] {
	const merged = [...remote.filter((key) => !local.includes(key)), ...local];

	return merged.slice(-MAX_REVEALED);
}
