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
	{ name: 'desktop', width: 1920, height: 1080 }
] as const;

const PAGES = [
	{ name: 'live', path: '/' },
	{ name: 'analysis', path: '/analysis' },
	{ name: 'strategy', path: '/strategy' }
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
						await page.goto(`${screen.path}?lap=30&plan=${plan}`);
						await expect(page.getByTestId('lap-counter')).toBeVisible();

						if (theme === 'light') {
							await switchToLightTheme(page);
						}

						// Let charts finish their entry animation and fonts settle.
						await page.evaluate(() => document.fonts.ready);
						await page.waitForTimeout(800);

						await page.screenshot({
							path: `shots/output/${viewport.name}/${screen.name}-${plan}-${theme}.png`,
							fullPage: true,
							animations: 'disabled'
						});
					});
				}
			}
		}
	});
}
