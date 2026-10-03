import { z } from 'zod';

/** Reveals kept per viewer, newest last: a few seasons of sessions. */
export const MAX_REVEALED = 200;

/**
 * A viewer's spoiler settings as an account keeps them: protection on or off, when that was last
 * changed (the newer change wins between devices), and the sessions whose results they have seen.
 */
export const viewerSettingsSchema = z.object({
	protect: z.boolean(),
	protectUpdatedAt: z.iso.datetime().nullable(),
	revealed: z.array(z.string().min(1).max(16)).max(MAX_REVEALED)
});

export type ViewerSettings = z.infer<typeof viewerSettingsSchema>;

/** Two devices' reveals together: every session revealed on either, `newer` last. */
export function mergeRevealed(newer: readonly string[], older: readonly string[]): string[] {
	return [...older.filter((key) => !newer.includes(key)), ...newer].slice(-MAX_REVEALED);
}

/** What an account keeps after a device sends its settings; a tie keeps what is stored. */
export function mergeViewerSettings(
	stored: ViewerSettings | null,
	incoming: ViewerSettings
): ViewerSettings {
	if (!stored) {
		return incoming;
	}

	const newer =
		(incoming.protectUpdatedAt ?? '') > (stored.protectUpdatedAt ?? '') ? incoming : stored;

	return {
		protect: newer.protect,
		protectUpdatedAt: newer.protectUpdatedAt,
		revealed: mergeRevealed(incoming.revealed, stored.revealed)
	};
}

/** What the spoiler rule reads: protection on or off, and the sessions whose results were seen. */
export type SpoilerSettings = { protect: boolean; revealed: readonly string[] };

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
