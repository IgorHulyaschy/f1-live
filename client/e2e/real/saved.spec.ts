import { expect, test } from '@playwright/test';

import { openRace } from '../fixtures.ts';

// The fixture is the 2025 Las Vegas weekend and 2026 Baku qualifying, derived from the official
// timing data (e2e/real/derive-fixtures.ts).

test('the race opens at the flag with the McLaren disqualifications', async ({ page }) => {
	await openRace(page, '/?session=9858');

	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 50/50');

	const rows = page.getByTestId(/^timing-row-/);
	await expect(rows.nth(0)).toHaveAttribute('data-testid', 'timing-row-VER');
	await expect(rows.nth(1)).toHaveAttribute('data-testid', 'timing-row-RUS');
	await expect(rows.nth(2)).toHaveAttribute('data-testid', 'timing-row-ANT');

	for (const code of ['NOR', 'PIA']) {
		const row = page.getByTestId(`timing-row-${code}`);

		await expect(row.getByText('DSQ').first()).toBeVisible();
		await expect(row.getByText('DSQ').first()).toHaveAttribute('title', /plank/);
	}

	await expect(rows.nth(18)).toHaveAttribute('data-testid', 'timing-row-NOR');
	await expect(rows.nth(19)).toHaveAttribute('data-testid', 'timing-row-PIA');
	await expect(page.getByTestId('timing-row-STR').getByText('DNF').first()).toBeVisible();
});

test('a replayed lap shows the order on that lap, not the final one', async ({ page }) => {
	await openRace(page, '/?session=9858&lap=10');

	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 10/50');
	await expect(page.getByTestId('timing-row-NOR').getByText('DSQ')).toHaveCount(0);
});

test('stints and pit stops come from the real strategies', async ({ page }) => {
	await openRace(page, '/strategy?session=9858');

	const stints = page.getByTestId('stint-timeline');
	await expect(stints).toBeVisible();
	await expect(stints).toContainText('L50 of 50');

	const stops = page.getByTestId('pit-stops');
	await expect(stops).toContainText(/\d+ so far/);
	await expect(stops.getByRole('listitem').first()).toBeVisible();
});

test('the session picker opens another session and keeps it in the address', async ({ page }) => {
	await openRace(page, '/?session=9858');

	await page.getByRole('button', { name: 'Sessions' }).click();

	const picker = page.getByTestId('session-picker');
	await expect(picker.getByRole('button', { name: /Las Vegas/ })).toBeVisible();
	await expect(picker.getByTestId('session-9851')).toBeDisabled();
	await picker.getByTestId('session-9854').click();

	await expect(page).toHaveURL(/session=9854/);
	await expect(page.getByTestId('session')).toContainText('Qualifying');

	await page.getByRole('button', { name: 'Sessions' }).click();
	await page.getByRole('radio', { name: '2026' }).click();
	await expect(picker.getByRole('button', { name: /Azerbaijan/ })).toBeVisible();
	await picker.getByTestId('session-11373').click();
	await expect(page).toHaveURL(/session=11373/);
});

test('⌘K finds a session by name', async ({ page }) => {
	await openRace(page, '/?session=9858');

	await page.keyboard.press('Control+k');
	await page.getByPlaceholder('Driver, dashboard, session or lap…').fill('Baku qualifying');
	await page.keyboard.press('Enter');

	await expect(page).toHaveURL(/session=11373/);
});

test('qualifying is ordered by best lap, with the knockout lines', async ({ page }) => {
	await openRace(page, '/?session=9854');

	const rows = page.getByTestId(/^timing-row-/);
	await expect(rows.nth(0)).toHaveAttribute('data-testid', 'timing-row-NOR');
	await expect(rows.nth(1)).toHaveAttribute('data-testid', 'timing-row-VER');
	await expect(rows.nth(2)).toHaveAttribute('data-testid', 'timing-row-SAI');
	await expect(rows.nth(0)).toContainText('Fastest');
	await expect(page.getByTestId('cut-line')).toHaveCount(2);
	await expect(page.getByTestId('race-only').first()).toContainText('applies to races');
});

test('a 22-car qualifying session cuts after 16 and shows no DRS', async ({ page }) => {
	await openRace(page, '/?session=11373');

	const rows = page.getByTestId(/^timing-row-/);
	await expect(rows).toHaveCount(22);
	await expect(rows.nth(0)).toHaveAttribute('data-testid', 'timing-row-RUS');

	const line = page.getByTestId('cut-line').last();
	await expect(rows.nth(15)).toHaveAttribute('data-testid', 'timing-row-ANT');
	await expect(line).toBeAttached();
	await expect(page.getByText('DRS', { exact: true })).toHaveCount(0);
});

test('spoiler-free opens at the start and shows results only when asked', async ({ page }) => {
	await page.addInitScript(() => window.localStorage.setItem('pitwall-spoiler-free', 'true'));
	await openRace(page, '/?session=9858');

	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 1/50');
	await expect(page.getByText('DSQ')).toHaveCount(0);

	await page.getByRole('button', { name: 'Show results' }).click();

	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 50/50');
	await expect(page.getByTestId('timing-row-NOR').getByText('DSQ').first()).toBeVisible();
	await expect(page.getByRole('button', { name: 'Show results' })).toHaveCount(0);
});
