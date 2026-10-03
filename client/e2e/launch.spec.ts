import { expect, type Page, test } from '@playwright/test';

import { openRace, seriousViolations } from './fixtures.ts';

/** Records wake lock requests and releases, which headless Chromium would refuse. */
async function stubWakeLock(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const log: string[] = [];

		const record = (entry: string) => {
			log.push(entry);
			document.documentElement.dataset.wakeLog = log.join(' ');
		};

		Object.defineProperty(navigator, 'wakeLock', {
			value: {
				request: async (type: string) => {
					record(type);

					const lock = {
						released: false,
						release: async () => {
							lock.released = true;
							record('release');
						}
					};

					return lock;
				}
			}
		});
	});
}

/** Chromium's install offer, as the browser sends it when the app is installable. */
async function offerInstall(page: Page): Promise<void> {
	await page.evaluate(() => {
		const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
			prompt: async () => {
				document.body.dataset.installPrompted = 'true';
			},
			userChoice: Promise.resolve({ outcome: 'accepted' })
		});

		window.dispatchEvent(offer);
	});
}

test.describe('legal pages', () => {
	for (const [slug, title] of [
		['terms', 'Terms of service'],
		['privacy', 'Privacy policy'],
		['cookies', 'Cookie notice']
	] as const) {
		test(`/legal/${slug} has its title, date and links`, async ({ page }) => {
			await page.goto(`/legal/${slug}`);

			await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
			await expect(page.getByText('Last updated')).toBeVisible();
			await expect(page).toHaveTitle(`${title} | Pitwall`);
			await expect(page.getByRole('navigation', { name: 'Legal' }).getByRole('link')).toHaveCount(
				3
			);

			const footer = page.getByRole('navigation', { name: 'Site' });

			await expect(footer.getByRole('link', { name: 'Terms' })).toHaveAttribute(
				'href',
				'/legal/terms'
			);
			await expect(footer.getByRole('link', { name: 'Support' })).toHaveAttribute(
				'href',
				/^mailto:/
			);
		});
	}

	test('open from the console footer without loading the race again', async ({ page }) => {
		await openRace(page);

		await page
			.getByRole('navigation', { name: 'Site' })
			.getByRole('link', { name: 'Privacy' })
			.click();

		await expect(page).toHaveURL('/legal/privacy');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy policy');
		await expect(page.getByTestId('consent-settings')).toHaveCount(0);

		await page
			.getByRole('navigation', { name: 'Legal' })
			.getByRole('link', { name: 'Cookies' })
			.click();
		await expect(page.getByTestId('consent-settings')).toContainText('counts nothing');
	});
});

test.describe('page meta', () => {
	test('follows the route: title, description, canonical link and share card', async ({ page }) => {
		await openRace(page, '/analysis?lap=12');

		await expect(page).toHaveTitle('Analysis | Pitwall');
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
			'href',
			'https://pitwall.example/analysis'
		);
		await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
			'content',
			'Analysis | Pitwall'
		);
		await expect(page.locator('meta[name="description"]')).toHaveAttribute(
			'content',
			/^Lap time charts/
		);
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
	});

	test('names a shared dashboard and keeps it out of search', async ({ page }) => {
		await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
		await openRace(page, '/d/battle');
		await page.getByRole('button', { name: 'Copy share link' }).click();

		const link = new URL(await page.evaluate(() => navigator.clipboard.readText()));

		await openRace(page, link.pathname + link.search);
		await expect(page).toHaveTitle('Battle: shared dashboard | Pitwall');
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
	});

	test('the browser bar follows the theme', async ({ page }) => {
		await openRace(page);

		const themeColour = page.locator('meta[name="theme-color"]');

		await expect(themeColour).toHaveAttribute('content', '#0d0c0a');
		await page.getByRole('button', { name: 'Switch to light theme' }).click();
		await expect(themeColour).toHaveAttribute('content', '#f8f7f3');
	});
});

test.describe('error screen', () => {
	test('a missing page says so and links back', async ({ page }) => {
		await page.goto('/no-such-page');

		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
		await expect(page).toHaveTitle('Page not found | Pitwall');
		await page.getByRole('link', { name: 'Live timing' }).click();
		await expect(page.getByTestId('lap-counter')).toBeVisible();
	});

	test('a crash says so, reports it and recovers on reload', async ({ page }) => {
		const reports: string[] = [];

		page.on('console', (message) => {
			if (message.type() === 'error') {
				reports.push(message.text());
			}
		});

		// The legal page module answers with one that throws while rendering.
		await page.route('**/src/legal/legal-page.tsx*', (route) =>
			route.fulfill({
				contentType: 'text/javascript',
				body: "export function legalRoute() { return { Component: () => { throw new Error('Tile exploded'); } }; }"
			})
		);
		await page.goto('/legal/terms');

		await expect(page.getByRole('heading', { level: 1 })).toHaveText('This screen stopped');
		await expect(page.getByTestId('error-screen')).toContainText('support@pitwall.example');
		await expect(page.locator('pre')).toContainText('Error: Tile exploded');
		expect(reports.some((text) => text.startsWith('[render] /legal/terms'))).toBe(true);

		await page.unroute('**/src/legal/legal-page.tsx*');
		await page.getByRole('button', { name: 'Reload' }).click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Terms of service');
	});

	test('a script lost to a new deploy asks for a reload', async ({ page }) => {
		await page.route('**/src/legal/legal-page.tsx*', (route) => route.abort());
		await page.goto('/legal/cookies');

		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Update ready');
		await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
	});
});

test.describe('install and screen wake', () => {
	test('offers the install after a minute, once, and keeps the footer key', async ({ page }) => {
		await page.clock.install();
		await openRace(page);
		await offerInstall(page);

		const banner = page.getByTestId('install-banner');

		await expect(page.getByRole('button', { name: 'Install app' })).toBeVisible();
		await expect(banner).toHaveCount(0);
		await page.clock.runFor(60_000);
		await expect(banner).toBeVisible();
		expect(await seriousViolations(page)).toEqual([]);
		await banner.getByRole('button', { name: 'Not now' }).click();
		await expect(banner).toHaveCount(0);

		await page.getByRole('button', { name: 'Install app' }).click();
		await expect(page.locator('body')).toHaveAttribute('data-install-prompted', 'true');
		await expect(page.getByRole('button', { name: 'Install app' })).toHaveCount(0);

		await page.reload();
		await expect(page.getByTestId('lap-counter')).toBeVisible();
		await offerInstall(page);
		await page.clock.runFor(60_000);
		await expect(page.getByRole('button', { name: 'Install app' })).toBeVisible();
		await expect(banner).toHaveCount(0);
	});

	test('keeps the screen awake while the replay plays, unless switched off', async ({ page }) => {
		await stubWakeLock(page);
		await openRace(page, '/?lap=2');

		const wakeLog = () => page.locator('html').getAttribute('data-wake-log');

		const awake = page.getByRole('switch', { name: 'Screen awake' });

		await expect(awake).toHaveAttribute('aria-checked', 'true');
		expect(await wakeLog()).toBeNull();

		await page.getByRole('button', { name: 'Play replay' }).first().click();
		await expect.poll(wakeLog).toBe('screen');

		await awake.click();
		await expect(awake).toHaveAttribute('aria-checked', 'false');
		await expect.poll(wakeLog).toBe('screen release');

		await page.reload();
		await expect(page.getByRole('switch', { name: 'Screen awake' })).toHaveAttribute(
			'aria-checked',
			'false'
		);
	});
});
