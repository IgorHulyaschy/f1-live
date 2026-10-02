import { expect, test } from '@playwright/test';

import { openRace } from './fixtures.ts';

test('free viewers see a locked pit window they can preview', async ({ page }) => {
	await openRace(page);

	const followed = page.getByTestId('followed-driver');
	await expect(followed.getByText('Pit stop prediction is part of Pro')).toBeVisible();

	await followed.getByRole('button', { name: 'Preview Pro' }).click();

	await expect(page).toHaveURL(/plan=pro/);
	await expect(followed.getByText('is part of Pro')).toHaveCount(0);
	await expect(page.getByTestId('pit-window')).toContainText(/Box now, P\d+/);
});

test('the plan keys toggle Pro across pages', async ({ page }) => {
	await openRace(page, '/strategy');

	await expect(page.getByText(/is part of Pro/)).toBeVisible();
	await page.getByRole('radio', { name: 'Pro' }).click();
	await expect(page.getByText(/is part of Pro/)).toHaveCount(0);

	await page.getByRole('radio', { name: 'Free' }).click();
	await expect(page.getByText(/is part of Pro/)).toBeVisible();
});

test('Pro shows where the followed driver would rejoin as a ghost row', async ({ page }) => {
	await openRace(page, '/?plan=pro');

	await expect(page.getByTestId('ghost-row')).toContainText('LEC if boxing now');
});
