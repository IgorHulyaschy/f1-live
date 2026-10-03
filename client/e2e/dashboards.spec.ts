import { expect, test } from '@playwright/test';

import { openRace } from './fixtures.ts';

test('presets open as tabs and render their tiles in a grid', async ({ page }) => {
	await openRace(page, '/d/wall');

	await expect(page.getByTestId('dashboard-grid')).toBeVisible();
	await expect(page.getByTestId('tile-timing')).toBeVisible();
	await expect(page.getByTestId('tile-track-map')).toBeVisible();
	await expect(page.getByTestId('chart-gap')).toBeVisible();
});

test('a new dashboard keeps its tiles after a reload', async ({ page }) => {
	await openRace(page, '/?lap=25');

	await page.getByRole('button', { name: 'New dashboard' }).click();
	await expect(page).toHaveURL(/\/d\/board-.*edit=1/);
	await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Race engineer');

	await page.getByRole('button', { name: 'Add tile' }).click();
	await page.getByRole('button', { name: /^Pit stops/ }).click();
	await page.getByRole('button', { name: 'Add tile' }).click();
	await page.getByRole('button', { name: /^Gaps/ }).click();
	await page.getByRole('button', { name: 'Done' }).click();

	await page.reload();
	await expect(page.getByRole('link', { name: 'Race engineer' })).toBeVisible();
	await expect(page.getByTestId('pit-stops')).toBeVisible();
	await expect(page.getByTestId('battle-summary')).toBeVisible();
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 25/50');
});

test('removing a tile from a preset can be reset', async ({ page }) => {
	await openRace(page, '/?edit=1');

	await page.getByRole('button', { name: 'Remove Race control' }).click();
	await expect(page.getByTestId('tile-race-control')).toHaveCount(0);

	await page.getByRole('button', { name: 'Reset' }).click();
	await expect(page.getByTestId('tile-race-control')).toBeVisible();
});

test('a dashboard exports and imports as a file', async ({ page }) => {
	await openRace(page, '/d/battle?edit=1');

	const download = page.waitForEvent('download');

	await page.getByRole('button', { name: 'Export' }).click();

	const file = await (await download).path();

	await page.getByLabel('Import dashboard file').setInputFiles(file);
	await expect(page).toHaveURL(/\/d\/board-/);
	await expect(page.getByRole('link', { name: 'Battle' })).toHaveCount(2);
	await expect(page.getByTestId('chart-battle')).toBeVisible();
});

test('phones stack the tiles in reading order', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await openRace(page, '/analysis');

	await expect(page.getByTestId('dashboard-stack')).toBeVisible();

	const kinds = await page
		.getByTestId('dashboard-stack')
		.locator(':scope > [data-testid^="tile-"]')
		.evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('data-testid')));

	expect(kinds).toEqual([
		'tile-lap-strip',
		'tile-replay',
		'tile-compare',
		'tile-chart',
		'tile-pace',
		'tile-fastest-laps'
	]);
});

test('a popped-out tile follows the lap of the window that opened it', async ({ context }) => {
	const main = await context.newPage();

	await openRace(main, '/analysis?lap=20');

	const tile = await context.newPage();

	await openRace(tile, '/tile/analysis/analysis-3?lap=20');
	await expect(tile.getByTestId('chart-lapTime')).toBeVisible();

	await main.getByRole('button', { name: 'Next lap' }).click();
	await expect(main.getByTestId('lap-counter')).toHaveText('Lap 21/50');
	await expect(tile.getByTestId('lap-counter')).toHaveText('Lap 21/50');
});

test('tiles can be arranged from the keyboard', async ({ page }) => {
	await openRace(page, '/?edit=1');

	await page.getByRole('button', { name: 'Arrange Race control' }).focus();
	await page.keyboard.press('ArrowUp');
	await expect(page.getByRole('button', { name: 'Arrange Race control' })).toBeFocused();

	// Tiles glide to their new place, so wait for the order to settle.
	await expect
		.poll(() =>
			page.locator('[data-tile-id]').evaluateAll((tiles) =>
				tiles
					.map((tile) => ({
						id: tile.getAttribute('data-testid'),
						top: tile.getBoundingClientRect().top
					}))
					.filter((tile) => tile.id === 'tile-focus' || tile.id === 'tile-race-control')
					.toSorted((a, b) => a.top - b.top)
					.map((tile) => tile.id)
			)
		)
		.toEqual(['tile-race-control', 'tile-focus']);
});

test('opening another window does not move the windows already open', async ({ context }) => {
	const main = await context.newPage();

	await openRace(main, '/?lap=30');

	const stale = await context.newPage();

	await openRace(stale, '/?lap=5');
	await main.waitForTimeout(300);
	await expect(main.getByTestId('lap-counter')).toHaveText('Lap 30/50');
});

test('play in one window is mirrored, and pause from the other stops it', async ({ context }) => {
	const main = await context.newPage();

	await openRace(main, '/?lap=10');

	const other = await context.newPage();

	await openRace(other, '/?lap=10');

	await main.getByRole('button', { name: 'Play replay' }).click();
	await expect(other.getByRole('button', { name: 'Pause replay' })).toBeVisible();
	await expect(other.getByTestId('lap-counter')).toHaveText('Lap 11/50');

	await other.getByRole('button', { name: 'Pause replay' }).click();
	await expect(main.getByRole('button', { name: 'Play replay' })).toBeVisible();

	const stopped = await main.getByTestId('lap-counter').textContent();

	await main.waitForTimeout(2000);
	await expect(main.getByTestId('lap-counter')).toHaveText(stopped ?? '');
	await expect(other.getByTestId('lap-counter')).toHaveText(stopped ?? '');
});
