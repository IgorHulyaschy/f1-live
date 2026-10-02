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

test('clicking a timing row follows that driver', async ({ page }) => {
	await openRace(page);

	await page.getByTestId('timing-row-NOR').click();

	await expect(page).toHaveURL(/driver=4/);
	await expect(page.getByTestId('timing-row-NOR')).toHaveAttribute('data-state', 'selected');
	await expect(page.getByRole('combobox', { name: 'Followed driver' })).toContainText('NOR');
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
