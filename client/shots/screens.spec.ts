import { expect, type Page, test } from '@playwright/test';

/**
 * Audit screenshots: every page at every viewport, free and Pro, dark and light.
 * Output goes to shots/output/<viewport>/<page>-<plan>-<theme>.png and is not committed.
 */

const VIEWPORTS = [
	{ name: 'android', width: 360, height: 800 },
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'tablet', width: 834, height: 1194 },
	{ name: 'laptop', width: 1280, height: 800 },
	{ name: 'desktop', width: 1920, height: 1080 },
	{ name: 'qhd', width: 2560, height: 1440 }
] as const;

const PAGES = [
	{ name: 'live', path: '/' },
	{ name: 'analysis', path: '/analysis' },
	{ name: 'strategy', path: '/strategy' },
	{ name: 'battle', path: '/d/battle' },
	{ name: 'track', path: '/d/track' },
	{ name: 'wall', path: '/d/wall' },
	{ name: 'drivers', path: '/d/drivers' },
	{ name: 'editing', path: '/d/battle?edit=1' },
	{ name: 'library', path: '/library' },
	{ name: 'preview', path: '/library/tv-wall' },
	{ name: 'welcome', path: '/welcome' }
] as const;

const PLANS = ['free', 'pro'] as const;

const THEMES = ['dark', 'light'] as const;

async function switchToLightTheme(page: Page): Promise<void> {
	// The header key is hidden on phones, where the footer carries the switch instead.
	await page
		.getByRole('button', { name: /^(Switch to light theme|Light theme)$/ })
		.filter({ visible: true })
		.click();
	await expect(page.locator('html')).not.toHaveClass(/dark/);
	// Clicking the footer key scrolls; the sticky header would otherwise land mid-shot.
	await page.evaluate(() => window.scrollTo(0, 0));
}

for (const viewport of VIEWPORTS) {
	test.describe(viewport.name, () => {
		test.use({ viewport: { width: viewport.width, height: viewport.height } });

		for (const screen of PAGES) {
			for (const plan of PLANS) {
				for (const theme of THEMES) {
					test(`${screen.name} ${plan} ${theme}`, async ({ page }) => {
						// formula1.com pictures are not reachable from CI; shots show the drawn fallbacks.
						await page.route('https://media.formula1.com/**', (route) => route.abort());
						await page.addInitScript(() => window.localStorage.setItem('pitwall-welcomed', 'true'));
						await page.goto(
							`${screen.path}${screen.path.includes('?') ? '&' : '?'}lap=30&plan=${plan}`
						);
						// Phones keep the lap on the pit board, not in the top bar, so wait for the race, not its view.
						await expect(page.getByTestId('lap-counter')).toBeAttached();

						if (theme === 'light') {
							await switchToLightTheme(page);
						}

						// Let charts finish their entry animation and fonts settle.
						await page.evaluate(() => document.fonts.ready);
						await page.waitForTimeout(800);

						await page.screenshot({
							path: `shots/output/${viewport.name}/${screen.name}-${plan}-${theme}.png`,
							fullPage: true,
							animations: 'disabled',
							// Full-page shots would print the pinned pit board mid-page; show it at the end.
							style:
								'body { position: relative; } [data-pit-board] { position: absolute; bottom: 0; }'
						});
					});
				}
			}
		}
	});
}
