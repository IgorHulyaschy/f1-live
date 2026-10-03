import { expect, test } from '@playwright/test';

import { openRace } from './fixtures.ts';

test('a part of the driver view goes on a dashboard, bound to that driver, and stays there', async ({
	page
}) => {
	await openRace(page, '/session?lap=30&car=4');

	await page.getByTestId('drill-sheet').getByTestId('drill-add-stints').click();
	await page.getByRole('menuitem', { name: 'Strategy' }).click();
	await expect(page.getByText('Stints added to Strategy')).toBeVisible();

	await page.goto('/strategy?lap=30');

	const tile = page.getByTestId('drill-tile');

	await expect(tile).toHaveAttribute('data-driver', '4');
	await expect(page.getByRole('region', { name: 'Stints: NOR' })).toBeAttached();

	await page.reload();

	await expect(tile).toHaveAttribute('data-driver', '4');
	await expect(page.getByRole('region', { name: 'Stints: NOR' })).toBeAttached();
});

test('the driver view becomes a dashboard of its own, a tile per part', async ({ page }) => {
	await openRace(page, '/session?lap=30&car=4');

	await page.getByTestId('drill-make-dashboard').click();

	await expect(page).toHaveURL(/\/d\/board-/);
	await expect(page.getByRole('heading', { name: 'Norris’s session' })).toBeVisible();
	await expect(page.getByTestId('drill-tile').first()).toHaveAttribute('data-driver', '4');
	expect(await page.getByTestId('drill-tile').count()).toBeGreaterThanOrEqual(5);
});
