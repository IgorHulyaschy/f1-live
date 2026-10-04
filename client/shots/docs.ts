import type { Locator, Page } from '@playwright/test';

import { writePicture } from '../scripts/docs-picture.ts';

export type Theme = 'dark' | 'light';

/** A rectangle in page pixels, for the part of a screen a picture is about. */
export interface Region {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface OpenOptions {
	theme?: Theme;
	/** Spoiler protection on: a finished session the viewer has not seen opens held back. */
	spoilers?: boolean;
	/** The date the app believes it is; pins "live", "next" and "latest" for a repeatable home. */
	now?: string;
}

/**
 * Opens a route the way a returning viewer sees it: welcomed, dark unless asked, spoiler
 * protection off unless asked. Formula1.com pictures are switched off in the app itself.
 */
export async function openDocs(
	page: Page,
	route: string,
	options: OpenOptions = {}
): Promise<void> {
	const { theme = 'dark', spoilers = false, now } = options;

	if (now) {
		await page.clock.setFixedTime(new Date(now));
	}

	// Springs that never quite settle (the gap straight) would leave sub-pixel noise between runs.
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.addInitScript(
		([chosen, held]) => {
			window.localStorage.setItem('pitwall-welcomed', 'true');
			window.localStorage.setItem('pitwall-theme', chosen);
			window.localStorage.setItem('pitwall-spoiler-free', held);
		},
		[theme, String(spoilers)] as const
	);
	await page.goto(route);
}

/** Lets fonts, heavy tiles, charts and the map settle, as the audit shots do. */
export async function settle(page: Page): Promise<void> {
	// Heavy tiles below the first screen wait to be scrolled to; a print draws them all at once.
	await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(800);
}

/**
 * Takes the picture docs/tour/<area>/<name>.png. `crop` is a locator (its box, with `margin`
 * pixels around it) or a rectangle; with none, the viewport. A picture is never the whole page:
 * it shows the part the page about it talks about. `tolerant` marks a chart whose lines jitter by
 * a shade between runs, so that noise alone does not rewrite the file.
 */
export async function docShot(
	page: Page,
	area: string,
	name: string,
	crop?: Locator | Region,
	margin = 0,
	tolerant = false
): Promise<void> {
	await settle(page);

	const clip = crop ? await regionOf(page, crop, margin) : undefined;

	const screenshot = await steadyShot(
		() => page.screenshot({ animations: 'disabled', clip, caret: 'hide' }),
		page
	);

	await writePicture(area, name, screenshot, undefined, tolerant);
}

/**
 * A fade driven from script (a tile just added) can still be a shade short of its end on a busy
 * machine, so shoot again until two pictures in a row are the same.
 */
async function steadyShot(
	shoot: () => Promise<Buffer>,
	page: Page,
	attempts = 10
): Promise<Buffer> {
	const first = await shoot();

	await page.waitForTimeout(300);

	const next = await shoot();

	return attempts <= 1 || next.equals(first) ? next : steadyShot(shoot, page, attempts - 1);
}

async function regionOf(page: Page, crop: Locator | Region, margin: number): Promise<Region> {
	const box = 'boundingBox' in crop ? await crop.boundingBox() : crop;

	if (!box) {
		throw new Error('The region to crop to is not on screen');
	}

	const viewport = page.viewportSize();
	const x = Math.max(0, box.x - margin);
	const y = Math.max(0, box.y - margin);

	return {
		x,
		y,
		width: Math.min(viewport?.width ?? Infinity, box.x + box.width + margin) - x,
		height: Math.min(viewport?.height ?? Infinity, box.y + box.height + margin) - y
	};
}
