import { expect, test } from '@playwright/test';

import { openRace } from './fixtures.ts';

test('arrow keys step laps and number keys switch pages', async ({ page }) => {
	await openRace(page, '/session?lap=20');

	await page.keyboard.press('ArrowRight');
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 21/50');

	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowLeft');
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 19/50');

	// Race day's tabs: Race, Strategy, Battle, Analysis.
	await page.keyboard.press('2');
	await expect(page.getByTestId('stint-timeline')).toBeVisible();
	await expect(page).toHaveURL(/\/strategy\?lap=19/);
});

test('the command palette follows a driver by name', async ({ page }) => {
	await openRace(page);

	await page.keyboard.press('Control+k');
	await page.getByTestId('ask-input').fill('Piastri');
	await page.keyboard.press('Enter');

	await expect(page).toHaveURL(/driver=81/);
	await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('clicking the lap strip jumps to that lap', async ({ page }) => {
	await openRace(page);

	await page.getByRole('button', { name: 'Go to lap 16' }).click();

	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 16/50');
	await expect(page.getByTestId('live-strip').getByTestId('track-status')).toBeVisible();
});

test('the analysis chart switches metric', async ({ page }) => {
	await openRace(page, '/analysis');

	await expect(page.getByTestId('chart-lapTime')).toBeVisible();
	await page.getByRole('tab', { name: 'Positions' }).click();
	await expect(page.getByTestId('chart-position')).toBeVisible();
	await page.getByRole('tab', { name: 'Battle' }).click();
	await expect(page.getByTestId('chart-battle')).toBeVisible();
});

for (const path of ['/session', '/analysis', '/strategy', '/d/story']) {
	test(`phones never scroll sideways on ${path}`, async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 800 });
		await openRace(page, path);

		// The widest tiles load their charts after the page; measure once they are drawn.
		if (path === '/analysis') {
			// It sits below the first screen, which it waits for.
			await page.getByRole('group', { name: 'Telemetry' }).scrollIntoViewIfNeeded();
			await expect(page.getByTestId('telemetry-charts')).toBeVisible({ timeout: 20_000 });
		}

		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);

		expect(overflow).toBe(0);
	});
}

test('race control filters to the followed driver', async ({ page }) => {
	await openRace(page, '/session?driver=23&lap=30');

	const feed = page.getByRole('region', { name: 'Race control' });

	await feed.getByRole('radio', { name: 'Mine' }).click();

	const items = page.getByTestId('race-control').getByRole('listitem');
	await expect(items.first()).toContainText('ALB');
});

test('arrow keys move between chart tabs without changing the lap', async ({ page }) => {
	await openRace(page, '/analysis');

	await page.getByRole('tab', { name: 'Lap times' }).focus();
	await page.keyboard.press('ArrowRight');

	await expect(page.getByRole('tab', { name: 'Gap' })).toBeFocused();
	await expect(page.getByRole('tabpanel')).toHaveAttribute('data-testid', 'chart-gap');
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 30/50');
});
