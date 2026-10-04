import { expect, test } from '@playwright/test';

import { replaying } from '../e2e/live/replay.ts';
import { serveTestPictures } from '../e2e/pictures';

/**
 * Audit screenshots of a live session: 2026 Baku qualifying replayed through the live path, on
 * the Quali layout, a saved race on screen while it runs, and the trimmed 2025 Las Vegas race live
 * on the Race layout. Output goes to shots/output/live/<viewport>/<page>-<theme>.png and is not
 * committed.
 */

const VIEWPORTS = [
	{ name: 'android', width: 360, height: 800 },
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'laptop', width: 1440, height: 900 },
	{ name: 'qhd', width: 2560, height: 1440 }
] as const;

/** Each page with what shows once it is ready: Knockout's drop zone at the end of the replay. */
const PAGES = [
	{ name: 'quali-live', path: '/session', ready: 'drop-zone', text: 'STR' },
	{
		name: 'race-while-live',
		path: '/session?session=9858',
		ready: 'strip-live-elsewhere',
		text: 'Watch live'
	}
] as const;

const THEMES = ['dark', 'light'] as const;

const STYLE = 'body { position: relative; } [data-pit-board] { position: absolute; bottom: 0; }';

test.describe('a live qualifying session', () => {
	replaying('2026-baku-qualifying', 150);

	for (const viewport of VIEWPORTS) {
		test.describe(viewport.name, () => {
			test.use({ viewport: { width: viewport.width, height: viewport.height } });

			for (const screen of PAGES) {
				for (const theme of THEMES) {
					test(`${screen.name} ${theme}`, async ({ page }) => {
						await serveTestPictures(page);
						await page.addInitScript((chosen) => {
							window.localStorage.setItem('pitwall-welcomed', 'true');
							window.localStorage.setItem('pitwall-theme', chosen);
						}, theme);
						await page.goto(screen.path);
						await expect(page.getByTestId(screen.ready)).toContainText(screen.text, {
							timeout: 30_000
						});
						await page.evaluate(() => document.fonts.ready);
						await page.waitForTimeout(800);

						await page.screenshot({
							path: `shots/output/live/${viewport.name}/${screen.name}-${theme}.png`,
							fullPage: true,
							animations: 'disabled',
							style: STYLE
						});
					});
				}
			}
		});
	}
});

/** The Race layout while the race runs: a phone, a laptop and a desktop. */
const RACE_VIEWPORTS = [
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'laptop', width: 1440, height: 900 },
	{ name: 'desktop', width: 1920, height: 1080 }
] as const;

test.describe('a live race', () => {
	// The start and two laps: the race starts about 23 s after the replay does and ends 32 s later,
	// so each theme shoots every size in one test while the race still runs.
	replaying('2025-las-vegas-race', 150);

	for (const theme of THEMES) {
		test(`race-live ${theme}`, async ({ page }) => {
			test.setTimeout(90_000);
			await serveTestPictures(page);
			await page.addInitScript((chosen) => {
				window.localStorage.setItem('pitwall-welcomed', 'true');
				window.localStorage.setItem('pitwall-theme', chosen);
			}, theme);
			await page.goto('/session');
			await expect(page.getByTestId('live-key')).toHaveText('Live', { timeout: 30_000 });
			// Whether a pair is within a second at that moment depends on the replay's timing, so the
			// shot waits for the race to run, not for a fight.
			await expect(page.getByTestId('lap-counter')).toHaveText(/Lap [12]\/50/, { timeout: 45_000 });
			await expect(
				page.getByTestId('fights').getByRole('paragraph').or(page.getByTestId('fight-row')).first()
			).toBeVisible();

			const shoot = async (viewport: (typeof RACE_VIEWPORTS)[number]) => {
				await page.setViewportSize({ width: viewport.width, height: viewport.height });
				// Heavy tiles below the first screen wait to be scrolled to; a print draws them all.
				await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
				await page.evaluate(() => document.fonts.ready);
				await page.waitForTimeout(500);
				await page.screenshot({
					path: `shots/output/live/${viewport.name}/race-live-${theme}.png`,
					fullPage: true,
					animations: 'disabled',
					style: STYLE
				});
			};

			// One size after another, on the one page.
			await RACE_VIEWPORTS.reduce(
				(previous, viewport) => previous.then(() => shoot(viewport)),
				Promise.resolve()
			);
		});
	}
});
