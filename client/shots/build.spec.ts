import { expect, type Page, test } from '@playwright/test';

/**
 * Audit screenshots of the production build (playwright.build.config.ts): the consent question,
 * asked only when an analytics provider is configured, and the shell painted before any script.
 * Output goes to shots/output/<viewport>/launch-<screen>-<theme>.png and is not committed.
 */

const VIEWPORTS = [
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'laptop', width: 1280, height: 800 }
] as const;

const THEMES = ['dark', 'light'] as const;

async function shoot(page: Page, viewport: string, name: string, theme: string): Promise<void> {
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({
		path: `shots/output/${viewport}/launch-${name}-${theme}.png`,
		animations: 'disabled'
	});
}

for (const viewport of VIEWPORTS) {
	for (const theme of THEMES) {
		test.describe(`${viewport.name} ${theme}`, () => {
			test.use({ viewport: { width: viewport.width, height: viewport.height } });

			test.beforeEach(async ({ page }) => {
				await page.route('https://media.formula1.com/**', (route) => route.abort());
				await page.addInitScript((saved) => {
					window.localStorage.setItem('pitwall-welcomed', 'true');
					window.localStorage.setItem('pitwall-theme', saved);
				}, theme);
			});

			test('consent question', async ({ page }) => {
				await page.goto('/session?lap=30');
				await expect(page.getByTestId('consent-banner')).toBeVisible();
				await shoot(page, viewport.name, 'consent', theme);
			});

			test('shell before scripts', async ({ page }) => {
				await page.route('**/assets/*.js', (route) => route.abort());
				await page.goto('/session');
				await expect(page.getByRole('status', { name: 'Loading' })).toBeVisible();
				await shoot(page, viewport.name, 'shell', theme);
			});
		});
	}
}
