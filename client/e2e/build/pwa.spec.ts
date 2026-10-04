import { expect, type Page, test } from '@playwright/test';

import { seriousViolations } from '../fixtures.ts';
import { serveTestPictures } from '../pictures';

/**
 * The production build, with the `console` analytics provider so the consent flow runs. These
 * cover what the dev server does not have: the generated site files and the service worker.
 */

async function openApp(page: Page, path: string): Promise<void> {
	await serveTestPictures(page);
	await page.addInitScript(() => window.localStorage.setItem('pitwall-welcomed', 'true'));
	await page.goto(path);
	await expect(page.getByTestId('lap-counter')).toBeVisible();
}

test('serves the manifest, its icons, robots.txt and the sitemap', async ({ request }) => {
	const manifest = await request.get('/manifest.webmanifest');

	expect(manifest.headers()['content-type']).toContain('manifest');

	const body: { name: string; icons: { src: string }[] } = await manifest.json();

	expect(body.name).toBe('Pitwall');

	for (const icon of body.icons) {
		const response = await request.get(icon.src);

		expect(response.headers()['content-type'], icon.src).toBe('image/png');
	}

	expect(await (await request.get('/robots.txt')).text()).toContain(
		'Sitemap: https://pitwall.example/sitemap.xml'
	);
	expect(await (await request.get('/sitemap.xml')).text()).toContain(
		'<loc>https://pitwall.example/legal/terms</loc>'
	);
	expect((await request.get('/og-image.png')).headers()['content-type']).toBe('image/png');
});

test('asks about usage counting once, and counts only after a yes', async ({ page }) => {
	const counted: string[] = [];

	page.on('console', (message) => {
		if (message.text().startsWith('[analytics]')) {
			counted.push(message.text());
		}
	});

	await openApp(page, '/session');

	const banner = page.getByTestId('consent-banner');

	await expect(banner).toBeVisible();
	await expect(banner.getByRole('button', { name: 'Allow' })).toBeVisible();
	expect(await seriousViolations(page)).toEqual([]);
	await banner.getByRole('button', { name: 'Decline' }).click();
	await expect(banner).toHaveCount(0);

	await page.reload();
	await expect(page.getByTestId('lap-counter')).toBeVisible();
	await expect(banner).toHaveCount(0);
	expect(counted).toEqual([]);

	await page
		.getByRole('navigation', { name: 'Site' })
		.getByRole('link', { name: 'Cookies' })
		.click();
	await page.getByTestId('consent-settings').getByRole('radio', { name: 'Allow' }).click();
	await expect.poll(() => counted).toEqual(['[analytics] page /legal/cookies']);
});

test('opens offline from the kept shell', async ({ page, context }) => {
	await page.addInitScript(() => window.localStorage.setItem('pitwall-consent', '"denied"'));
	await openApp(page, '/session');
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await expect
		.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
		.toBe(true);

	await context.setOffline(true);
	await page.goto('/analysis');
	await expect(page.getByTestId('lap-counter')).toBeVisible();
	await expect(page.getByRole('heading', { level: 1, name: 'Analysis' })).toBeVisible();
	await context.setOffline(false);
});
