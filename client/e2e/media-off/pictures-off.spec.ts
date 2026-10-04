import { expect, type Page, test } from '@playwright/test';

// The app built with VITE_F1_MEDIA=off: plates only, and nothing asks the media host.

async function open(page: Page, path: string): Promise<void> {
	await page.addInitScript(() => {
		window.localStorage.setItem('pitwall-welcomed', 'true');
		window.localStorage.setItem('pitwall-spoiler-free', 'false');
	});
	await page.goto(path);
}

test('every face is a plate and no request reaches the media host', async ({ page }) => {
	const requests: string[] = [];

	page.on('request', (request) => {
		if (request.url().includes('formula1.com')) {
			requests.push(request.url());
		}
	});

	for (const path of [
		'/standings?season=2025',
		'/h2h?a=lando-norris&b=oscar-piastri&from=2025.1&to=2025.24',
		'/drivers/lando-norris',
		'/'
	]) {
		// oxlint-disable-next-line no-await-in-loop -- one page at a time.
		await open(page, path);
		// oxlint-disable-next-line no-await-in-loop
		await expect(page.locator('.plate').first()).toBeVisible({ timeout: 15_000 });
		// oxlint-disable-next-line no-await-in-loop
		await expect(page.locator('.plate img')).toHaveCount(0);
	}

	expect(requests).toEqual([]);
});
