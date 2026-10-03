import { expect, type Page, test } from '@playwright/test';
import { z } from 'zod';

import { signInWithLink, testEmail } from '../e2e/fixtures.ts';

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
	{ name: 'wall', path: '/d/wall' },
	{ name: 'drivers', path: '/d/drivers' },
	{ name: 'story', path: '/d/story' },
	{ name: 'editing', path: '/d/battle?edit=1' },
	{ name: 'library', path: '/library' },
	{ name: 'preview', path: '/library/tv-wall' },
	{ name: 'welcome', path: '/welcome' },
	{ name: 'account', path: '/account' }
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

async function shoot(page: Page, file: string): Promise<void> {
	// Heavy tiles below the first screen wait to be scrolled to; a print draws them all at once.
	await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
	// Let charts finish their entry animation and fonts settle.
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(800);

	await page.screenshot({
		path: file,
		fullPage: true,
		animations: 'disabled',
		// Full-page shots would print the pinned pit board mid-page; show it at the end.
		style: 'body { position: relative; } [data-pit-board] { position: absolute; bottom: 0; }'
	});
}

/** A real Pro account: the fake provider's checkout, paid, with its page in the theme asked for. */
async function goPro(page: Page, file: string, theme: (typeof THEMES)[number]): Promise<void> {
	const origin = new URL(page.url()).origin;

	const checkout = await page.request.post('/api/billing/checkout', {
		headers: { origin },
		data: { interval: 'year' }
	});

	await page.emulateMedia({ colorScheme: theme });
	await page.goto(z.object({ url: z.url() }).parse(await checkout.json()).url);
	await shoot(page, file);
	await page.getByRole('button', { name: 'Pay' }).click();
	await expect(page).toHaveURL(/\/account/);
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

						await shoot(page, `shots/output/${viewport.name}/${screen.name}-${plan}-${theme}.png`);
					});
				}
			}
		}

		// Signed in, on a real plan rather than the preview.
		for (const plan of PLANS) {
			for (const theme of THEMES) {
				test(`account signed in ${plan} ${theme}`, async ({ page }) => {
					const output = `shots/output/${viewport.name}`;

					await page.route('https://media.formula1.com/**', (route) => route.abort());
					await page.addInitScript(() => window.localStorage.setItem('pitwall-welcomed', 'true'));
					await page.goto('/account?lap=30');
					await signInWithLink(page, testEmail('shots'));

					if (plan === 'pro') {
						await goPro(page, `${output}/checkout-${theme}.png`, theme);
					}

					await page.goto('/account?lap=30');
					await expect(page.getByRole('region', { name: 'Plan' })).toContainText(
						plan === 'pro' ? 'Renews' : 'Go Pro'
					);

					if (theme === 'light') {
						await switchToLightTheme(page);
					}

					// Phones keep the account in the footer; wider screens show its menu open.
					const menu = page.getByTestId('account-menu').filter({ visible: true });

					if ((await menu.count()) > 0) {
						await menu.click();
					}

					await shoot(page, `${output}/account-signed-in-${plan}-${theme}.png`);
				});
			}
		}
	});
}
