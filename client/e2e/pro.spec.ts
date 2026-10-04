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

test('Preview Pro in the menu turns Pro on and off', async ({ page }) => {
	await openRace(page, '/strategy');

	await expect(page.getByText(/is part of Pro/).first()).toBeVisible();

	const preview = page.getByRole('menuitemcheckbox', { name: 'Preview Pro' });

	await page.getByTestId('app-menu').click();
	await preview.click();
	await expect(page.getByText(/is part of Pro/)).toHaveCount(0);

	await page.getByTestId('app-menu').click();
	await expect(preview).toBeChecked();
	await preview.click();
	await expect(page.getByText(/is part of Pro/).first()).toBeVisible();
});

test('Pro shows where the followed driver would rejoin as a ghost row', async ({ page }) => {
	await openRace(page, '/session?plan=pro');

	await expect(page.getByTestId('ghost-row')).toContainText('LEC if boxing now');
});
