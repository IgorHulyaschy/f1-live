import { expect, test } from '@playwright/test';

import { openRace } from './fixtures.ts';

test('a fan dashboard can be previewed and added from the library', async ({ page }) => {
	await openRace(page, '/library');

	await page.getByRole('link', { name: 'Preview' }).first().click();
	await expect(page.getByTestId('dashboard-preview')).toBeVisible();
	await expect(page.getByText('Preview, by @boxboxbox')).toBeVisible();

	await page.getByRole('button', { name: 'Add to my dashboards' }).click();
	await expect(page).toHaveURL(/\/d\/board-/);
	await expect(page.getByRole('link', { name: 'Second screen' })).toBeVisible();
});

test('a share link opens the same dashboard in another browser', async ({ page, browser }) => {
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	await openRace(page, '/d/battle');

	await page.getByRole('button', { name: 'Copy share link' }).click();

	const link = await page.evaluate(() => navigator.clipboard.readText());
	const other = await browser.newPage();

	await openRace(other, link.replace(/^https?:\/\/[^/]+/, ''));
	await expect(other.getByTestId('dashboard-preview')).toBeVisible();
	await expect(other.getByTestId('chart-battle')).toBeVisible();
	await other.close();
});

test('Free keeps three dashboards of your own and points to Pro', async ({ page }) => {
	const addFromLibrary = async (name: string) => {
		await page.goto('/library');
		await page.getByRole('button', { name }).click();
		await expect(page).toHaveURL(/\/d\/board-/);
	};

	await openRace(page, '/library');
	await addFromLibrary('Add Second screen');
	await addFromLibrary('Add TV wall');
	await addFromLibrary('Add Teammates');

	await page.goto('/library');
	await page.getByRole('button', { name: 'Add Driver wall' }).click();
	await expect(page.getByText('Free keeps 3 dashboards of your own')).toBeVisible();
	await expect(page).toHaveURL(/\/library/);

	// Pro is bought on the account page; e2e/accounts.spec.ts runs the whole way there.
	await page.getByRole('button', { name: 'Go Pro' }).click();
	await expect(page).toHaveURL(/\/account\?.*upgrade=1/);
	await expect(page.getByRole('region', { name: 'Sign in' })).toContainText(
		'Pro belongs to your account'
	);
});

test('first run picks a driver and a starting dashboard', async ({ page }) => {
	await page.route('https://media.formula1.com/**', (route) => route.abort());
	await page.goto('/');
	await page.getByRole('link', { name: 'Set up' }).click();

	await page.getByRole('button', { name: /Norris/ }).click();
	await page.getByRole('button', { name: /Strategy calls/ }).click();
	await page.getByRole('button', { name: 'Start watching' }).click();

	await expect(page).toHaveURL(/\/strategy\?.*driver=4/);
	await page.goto('/');
	await expect(page.getByRole('link', { name: 'Set up' })).toHaveCount(0);
	await expect(page.getByRole('combobox', { name: 'Followed driver' })).toHaveText(/NOR/);
});

test('without a Replay tile the transport moves to the session strip', async ({ page }) => {
	await openRace(page, '/?edit=1');

	await expect(page.getByTestId('header-clock')).toHaveCount(0);
	await page.getByRole('button', { name: 'Remove Replay' }).click();
	await expect(page.getByTestId('header-clock')).toBeVisible();
	await expect(page.getByTestId('lap-counter')).toHaveCount(1);
});
