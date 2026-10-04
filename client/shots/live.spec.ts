import { expect, test } from '@playwright/test';

import { replaying } from '../e2e/live/replay.ts';
import { serveTestPictures } from '../e2e/pictures';

/**
 * Audit screenshots of a live session: 2026 Baku qualifying replayed through the live path, on
 * the Quali layout, and a saved race on screen while it runs. Output goes to
 * shots/output/live/<viewport>/<page>-<theme>.png and is not committed.
 */

const VIEWPORTS = [
	{ name: 'android', width: 360, height: 800 },
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'laptop', width: 1440, height: 900 },
	{ name: 'qhd', width: 2560, height: 1440 }
] as const;

/** Each page with what shows once it is ready: the drop zone at the end of the replay. */
const PAGES = [
	{ name: 'quali-live', path: '/session', ready: 'strip-drop-zone', text: 'STR' },
	{
		name: 'race-while-live',
		path: '/session?session=9858',
		ready: 'strip-live-elsewhere',
		text: 'Watch live'
	}
] as const;

const THEMES = ['dark', 'light'] as const;

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
						style:
							'body { position: relative; } [data-pit-board] { position: absolute; bottom: 0; }'
					});
				});
			}
		}
	});
}
