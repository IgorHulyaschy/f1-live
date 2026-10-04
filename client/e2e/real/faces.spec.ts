import { expect, type Page, test } from '@playwright/test';

import { breakTestPictures, serveTestPictures } from '../pictures';

// Pictures come from the media host in production; here a local image answers for it, so no test
// reaches formula1.com. Lando Norris raced all of 2025 and 2026, so his id is in both indexes.

async function open(page: Page, path: string): Promise<void> {
	await page.addInitScript(() => {
		window.localStorage.setItem('pitwall-welcomed', 'true');
		window.localStorage.setItem('pitwall-spoiler-free', 'false');
	});
	await page.goto(path);
}

const portrait = (page: Page) => page.getByRole('img', { name: 'Lando Norris' }).first();

test('standings rows carry the driver’s portrait, named for the driver', async ({ page }) => {
	await serveTestPictures(page);
	await open(page, '/standings?season=2025');

	await expect(portrait(page)).toBeAttached({ timeout: 15_000 });
	await expect(portrait(page)).toHaveAttribute('src', /media\.formula1\.com.*2025mclaren/);
	await expect(portrait(page)).toHaveAttribute('srcset', / 2x$/);
	await expect(portrait(page)).toHaveAttribute('loading', 'lazy');
	await expect(page.getByTestId('round-podium')).toBeVisible();
});

test('the teams table shows the logo with an empty alt next to the written name', async ({
	page
}) => {
	await serveTestPictures(page);
	await open(page, '/standings?season=2025&view=teams');

	const logo = page.getByTestId('standings-row').first().locator('img[alt=""]').first();

	await expect(logo).toBeAttached({ timeout: 15_000 });
	await expect(logo).toHaveAttribute('src', /2025.*logo/);
});

test('head to head faces the two drivers', async ({ page }) => {
	await serveTestPictures(page);
	await open(page, '/h2h?a=lando-norris&b=oscar-piastri&from=2025.1&to=2025.24');

	await expect(page.getByTestId('h2h-name-a')).toHaveText('Lando Norris', { timeout: 15_000 });
	await expect(page.getByRole('img', { name: 'Lando Norris' }).first()).toBeAttached();
	await expect(page.getByRole('img', { name: 'Oscar Piastri' }).first()).toBeAttached();
});

test('a driver page opens with the portrait and the season’s car', async ({ page }) => {
	await serveTestPictures(page);
	await open(page, '/drivers/lando-norris');

	const hero = page.getByTestId('driver-hero');

	await expect(hero).toBeVisible({ timeout: 15_000 });
	await expect(hero.getByRole('img', { name: 'Lando Norris' })).toBeAttached();
});

test('the home’s standings show portraits', async ({ page }) => {
	await serveTestPictures(page);
	await open(page, '/');

	await expect(page.getByTestId('home-championship')).toBeVisible({ timeout: 15_000 });
	await expect(page.getByTestId('home-championship').getByRole('img').first()).toBeAttached();
});

test('a picture that fails falls back to the plate without moving the row', async ({ page }) => {
	await breakTestPictures(page);
	await open(page, '/standings?season=2025');

	const row = page.getByTestId('standings-row').first();

	await expect(row).toBeVisible({ timeout: 15_000 });

	const before = await row.boundingBox();

	// Every candidate fails in turn; the plate (race number over the colour rule) stays.
	await page.waitForTimeout(500);
	await expect(row.locator('.plate').first()).toBeVisible();
	expect(await row.boundingBox()).toEqual(before);
});
