import { expect, test } from '@playwright/test';

import { openRace } from './fixtures.ts';

test('stepping laps updates the counter and the URL', async ({ page }) => {
	await openRace(page, '/?lap=10');

	await page.getByRole('button', { name: 'Next lap' }).click();
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 11/50');
	await expect(page).toHaveURL(/lap=11/);

	await page.getByRole('button', { name: 'Previous lap' }).click();
	await page.getByRole('button', { name: 'Previous lap' }).click();
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 9/50');
});

// The timing feed's order at the flag, before both McLarens were disqualified after the race.
test('the final lap shows the real order at the flag', async ({ page }) => {
	await openRace(page, '/?lap=50');

	const rows = page.getByTestId(/^timing-row-/);
	await expect(rows.nth(0)).toHaveAttribute('data-testid', 'timing-row-VER');
	await expect(rows.nth(1)).toHaveAttribute('data-testid', 'timing-row-NOR');
	await expect(rows.nth(2)).toHaveAttribute('data-testid', 'timing-row-RUS');
});

test('a timing row opens the driver view, a lap opens the lap view, and Back closes them', async ({
	page
}) => {
	await openRace(page, '/?lap=30');

	await page.getByTestId('timing-row-NOR').click();

	const sheet = page.getByTestId('drill-sheet');
	await expect(page).toHaveURL(/car=4/);
	await expect(sheet.getByRole('heading', { level: 2 })).toContainText('NOR');
	await expect(sheet.getByTestId('drill-laps')).toBeVisible();
	await expect(page).toHaveTitle('NOR, Las Vegas 2025 Race | Pitwall');

	await sheet.getByTestId('drill-lap-12').click();
	await expect(page).toHaveURL(/carLap=12/);
	await expect(sheet.getByTestId('lap-view')).toBeVisible();
	await expect(sheet.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Lap 12');

	// The replay keys still work beside the sheet, and Back keeps the lap they moved to.
	await page.keyboard.press('ArrowRight');
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 31/50');

	await page.goBack();
	await expect(sheet.getByTestId('driver-view')).toBeVisible();
	await page.goBack();
	await expect(sheet).toHaveCount(0);
	await expect(page).not.toHaveURL(/car=/);
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 31/50');
});

test('the driver view follows a driver, compares two, and Escape closes it', async ({ page }) => {
	await openRace(page, '/?lap=30&car=4');

	const sheet = page.getByTestId('drill-sheet');
	await sheet.getByRole('button', { name: 'Follow', exact: true }).click();
	await expect(page).toHaveURL(/driver=4/);
	await expect(page.getByTestId('timing-row-NOR')).toHaveAttribute('data-state', 'selected');

	await sheet.getByRole('combobox', { name: 'Compare with another driver' }).click();
	await page.getByRole('option', { name: /PIA/ }).click();
	await expect(page).toHaveURL(/vs=81/);
	await expect(sheet.getByTestId('compare-view')).toBeVisible();

	// Close steps back past every level the sheet opened.
	await sheet.getByRole('button', { name: 'Close' }).click();
	await expect(sheet).toHaveCount(0);
	await expect(page).not.toHaveURL(/car=/);

	await page.getByTestId('timing-row-PIA').click();
	await expect(sheet).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(sheet).toHaveCount(0);
});

test('a race-control message moves the replay to its lap', async ({ page }) => {
	await openRace(page, '/?lap=30');

	const message = page
		.getByTestId('race-control')
		.getByRole('button', { name: /go to L\d+/ })
		.last();

	const label = (await message.getAttribute('aria-label')) ?? '';
	const lap = /go to L(\d+)$/.exec(label)?.[1];

	await message.click();
	await expect(page.getByTestId('lap-counter')).toHaveText(`Lap ${lap}/50`);
});

test('the driver picker follows the chosen driver', async ({ page }) => {
	await openRace(page);

	await page.getByRole('combobox', { name: 'Followed driver' }).click();
	await page.getByRole('option', { name: /PIA/ }).click();

	await expect(page).toHaveURL(/driver=81/);
	await expect(page.getByTestId('battle-summary')).toBeVisible();
});

test('playback advances the replay and stops at the last lap', async ({ page }) => {
	await openRace(page, '/?lap=48');

	await page.getByRole('button', { name: 'Play replay' }).click();

	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 50/50', { timeout: 6000 });
	await expect(page.getByRole('button', { name: 'Play replay' })).toBeDisabled();
});
