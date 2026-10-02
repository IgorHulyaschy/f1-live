import { expect, test } from '@playwright/test';

import { openRace } from './fixtures.ts';

test('free viewers see a locked pit window they can preview', async ({ page }) => {
	await openRace(page);

	const followed = page.getByTestId('followed-driver');
	await expect(followed.getByText('Pit window prediction is part of Pro')).toBeVisible();

	await followed.getByRole('button', { name: 'Preview Pro' }).click();

	await expect(page).toHaveURL(/plan=pro/);
	await expect(followed.getByText('is part of Pro')).toHaveCount(0);
	await expect(page.getByTestId('pit-window')).toContainText(/Rejoins P\d+/);
});

test('the header switch toggles Pro across pages', async ({ page }) => {
	await openRace(page, '/strategy');

	await expect(page.getByText(/is part of Pro/)).toBeVisible();
	await page.getByRole('switch', { name: 'Pro' }).click();
	await expect(page.getByText(/is part of Pro/)).toHaveCount(0);

	await page.getByRole('switch', { name: 'Pro' }).click();
	await expect(page.getByText(/is part of Pro/)).toBeVisible();
});
