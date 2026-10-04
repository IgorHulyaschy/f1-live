import { expect, type Page, test } from '@playwright/test';

import { serveTestPictures } from '../e2e/pictures';

/**
 * Audit screenshots of the launch screens: legal pages, the install offer and the error screens;
 * the consent question and the shell before scripts are in build.spec.ts. Output goes to
 * shots/output/<viewport>/launch-<screen>-<theme>.png and is not committed.
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
		fullPage: true,
		animations: 'disabled'
	});
}

for (const viewport of VIEWPORTS) {
	for (const theme of THEMES) {
		test.describe(`${viewport.name} ${theme}`, () => {
			test.use({ viewport: { width: viewport.width, height: viewport.height } });

			test.beforeEach(async ({ page }) => {
				await serveTestPictures(page);
				await page.addInitScript((saved) => {
					window.localStorage.setItem('pitwall-welcomed', 'true');
					window.localStorage.setItem('pitwall-theme', saved);
				}, theme);
			});

			for (const slug of ['terms', 'privacy', 'cookies'] as const) {
				test(`legal ${slug}`, async ({ page }) => {
					await page.goto(`/legal/${slug}`);
					await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
					await shoot(page, viewport.name, `legal-${slug}`, theme);
				});
			}

			test('not found', async ({ page }) => {
				await page.goto('/no-such-page');
				await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
				await shoot(page, viewport.name, 'not-found', theme);
			});

			test('crash', async ({ page }) => {
				await page.route('**/src/legal/legal-page.tsx*', (route) =>
					route.fulfill({
						contentType: 'text/javascript',
						body: 'export function legalRoute() { return { Component: () => { throw new TypeError("Cannot read properties of undefined (reading \'laps\')"); } }; }'
					})
				);
				await page.goto('/legal/terms');
				await expect(page.getByRole('heading', { level: 1 })).toHaveText('This screen stopped');
				await shoot(page, viewport.name, 'crash', theme);
			});

			test('update ready', async ({ page }) => {
				await page.route('**/src/legal/legal-page.tsx*', (route) => route.abort());
				await page.goto('/legal/terms');
				await expect(page.getByRole('heading', { level: 1 })).toHaveText('Update ready');
				await shoot(page, viewport.name, 'update-ready', theme);
			});

			test('install offer', async ({ page }) => {
				await page.clock.install();
				await page.goto('/session?lap=30');
				await expect(page.getByTestId('lap-counter')).toBeAttached();
				await page.evaluate(() => {
					window.dispatchEvent(
						Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
							prompt: async () => undefined,
							userChoice: Promise.resolve({ outcome: 'dismissed' })
						})
					);
				});
				await page.clock.runFor(60_000);
				await expect(page.getByTestId('install-banner')).toBeVisible();
				await page.screenshot({
					path: `shots/output/${viewport.name}/launch-install-${theme}.png`,
					animations: 'disabled'
				});
			});
		});
	}
}
