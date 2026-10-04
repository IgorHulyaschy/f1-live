/**
 * Every port the Playwright configs use, from one number. Worktrees that run e2e side by side set
 * `PW_PORT_BASE` to a different value each (for example 4273, 4373), so no two runs meet on a
 * port; unset, the ports are the original ones: apps on 4173 to 4176, servers on 3111, 3112, 3114.
 */

const DEFAULT_BASE = 4173;

/** The servers sit this far below the apps, so a base moves both blocks together. */
const SERVER_OFFSET = 1062;

function readBase(value: string | undefined): number {
	const base = value === undefined || value === '' ? DEFAULT_BASE : Number(value);

	if (!Number.isInteger(base) || base < SERVER_OFFSET + 1024 || base + 3 > 65_535) {
		throw new Error(`PW_PORT_BASE must be a whole number from 2086 to 65532, got ${value}`);
	}

	return base;
}

const base = readBase(process.env.PW_PORT_BASE);

export const PORTS = {
	/** The app on the mock replay, and the accounts it signs in with. */
	mockApp: base,
	/** The app on the committed real-data fixture, and the server that serves it. */
	realApp: base + 1,
	liveApp: base + 2,
	/** The production build (playwright.build.config.ts). */
	buildApp: base + 3,
	/** The real-data app built with the media host switched off (`VITE_F1_MEDIA=off`). */
	mediaOffApp: base + 4,
	realServer: base - SERVER_OFFSET,
	liveServer: base - SERVER_OFFSET + 1,
	accountsServer: base - SERVER_OFFSET + 3
} as const;
