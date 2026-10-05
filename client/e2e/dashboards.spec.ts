import { expect } from '@playwright/test';

import { fromMenu, openRace, test } from './fixtures.ts';

test('presets open as tabs and render their tiles in a grid', async ({ page }) => {
	await openRace(page, '/d/wall');

	await expect(page.getByTestId('dashboard-grid')).toBeVisible();
	await expect(page.getByTestId('tile-timing')).toBeVisible();
	await expect(page.getByTestId('tile-track-map')).toBeVisible();
	await expect(page.getByTestId('chart-gap')).toBeVisible();
});

test('a new dashboard keeps its tiles after a reload', async ({ page }) => {
	await openRace(page, '/session?lap=25');

	await fromMenu(page, 'New dashboard');
	await expect(page).toHaveURL(/\/d\/board-.*edit=1/);
	await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Race engineer');

	await page.getByRole('button', { name: 'Add tile' }).click();
	await page.getByRole('button', { name: /^Pit stops/ }).click();
	await page.getByRole('button', { name: 'Add tile' }).click();
	await page.getByRole('button', { name: /^Gaps/ }).click();
	await page.getByRole('button', { name: 'Done' }).click();
	await expect(page.getByTestId('app-menu')).toBeFocused();

	await page.reload();
	await expect(page.getByRole('link', { name: 'Race engineer' })).toBeVisible();
	await expect(page.getByTestId('pit-stops')).toBeVisible();
	await expect(page.getByTestId('battle-summary')).toBeVisible();
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 25/50');
});

test('removing a tile from a preset can be reset, and the reset undone', async ({ page }) => {
	await openRace(page, '/session?edit=1');

	await page.getByRole('button', { name: 'Remove Race control' }).click();
	await expect(page.getByTestId('tile-race-control')).toHaveCount(0);

	await fromMenu(page, 'Reset');
	await expect(page.getByTestId('tile-race-control')).toBeVisible();

	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(page.getByTestId('tile-race-control')).toHaveCount(0);
});

test('a dashboard exports and imports as a file', async ({ page }) => {
	await openRace(page, '/d/battle?edit=1');

	const download = page.waitForEvent('download');

	await fromMenu(page, 'Export');

	const file = await (await download).path();

	await page.getByLabel('Import dashboard file').setInputFiles(file);
	await expect(page).toHaveURL(/\/d\/board-/);
	await expect(page.getByRole('link', { name: 'Battle' })).toHaveCount(2);
	await expect(page.getByTestId('chart-battle')).toBeVisible();
});

test('phones stack Analysis with the answers before the chart', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await openRace(page, '/analysis');

	await expect(page.getByTestId('dashboard-stack')).toBeVisible();

	const kinds = await page
		.getByTestId('dashboard-stack')
		.locator(':scope > [data-testid^="tile-"]')
		.evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('data-testid')));

	expect(kinds).toEqual([
		'tile-pace',
		'tile-fastest-laps',
		'tile-compare',
		'tile-chart',
		'tile-telemetry'
	]);
	await expect(page.getByRole('button', { name: 'Next lap' })).toBeVisible();
});

test('a popped-out tile follows the lap of the window that opened it', async ({ context }) => {
	const main = await context.newPage();

	await openRace(main, '/analysis?lap=20');

	const tile = await context.newPage();

	await openRace(tile, '/tile/analysis/analysis-1?lap=20');
	await expect(tile.getByTestId('chart-lapTime')).toBeVisible();

	await main.getByRole('button', { name: 'Next lap' }).click();
	await expect(main.getByTestId('lap-counter')).toHaveText('Lap 21/50');
	await expect(tile.getByTestId('lap-counter')).toHaveText('Lap 21/50');
});

test('tiles can be arranged from the keyboard', async ({ page }) => {
	await openRace(page, '/session?edit=1');

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
					.filter((tile) => tile.id === 'tile-fights' || tile.id === 'tile-race-control')
					.toSorted((a, b) => a.top - b.top)
					.map((tile) => tile.id)
			)
		)
		.toEqual(['tile-race-control', 'tile-fights']);
});

test('opening another window does not move the windows already open', async ({ context }) => {
	const main = await context.newPage();

	await openRace(main, '/session?lap=30');

	const stale = await context.newPage();

	await openRace(stale, '/session?lap=5');
	await main.waitForTimeout(300);
	await expect(main.getByTestId('lap-counter')).toHaveText('Lap 30/50');
});

test('play in one window is mirrored, and pause from the other stops it', async ({ context }) => {
	const main = await context.newPage();

	await openRace(main, '/session?lap=10');

	const other = await context.newPage();

	await openRace(other, '/session?lap=10');

	await main.getByRole('button', { name: 'Play replay' }).click();
	await expect(other.getByRole('button', { name: 'Pause replay' })).toBeVisible();
	await expect(other.getByTestId('lap-counter')).not.toHaveText('Lap 10/50', { timeout: 15_000 });

	await other.getByRole('button', { name: 'Pause replay' }).click();
	await expect(main.getByRole('button', { name: 'Play replay' })).toBeVisible();

	const stopped = await main.getByTestId('lap-counter').textContent();

	await main.waitForTimeout(2000);
	await expect(main.getByTestId('lap-counter')).toHaveText(stopped ?? '');
	await expect(other.getByTestId('lap-counter')).toHaveText(stopped ?? '');
});

test('a tile’s header ends in its options, the same on every tile', async ({ context }) => {
	const page = await context.newPage();

	await openRace(page, '/d/wall?lap=20');

	const timing = page.getByTestId('tile-timing');

	await timing.getByTestId('tile-options').click();

	const popup = context.waitForEvent('page');

	await page.getByRole('menuitem', { name: 'Open in a new window' }).click();

	const opened = await popup;

	await expect(opened).toHaveURL(/\/tile\/wall\/[^/?]+\?.*lap=20/);
	// The new window takes focus as it loads; come back to the dashboard as a viewer would.
	await opened.waitForLoadState();
	await page.bringToFront();

	await timing.getByTestId('tile-options').click();
	await page.getByRole('menuitem', { name: 'Edit the dashboard' }).click();

	await expect(page).toHaveURL(/edit=1/);
	await expect(page.getByTestId('tile-options')).toHaveCount(0);
});

test('a window opened while the race plays follows it, and a pause stops both on one lap', async ({
	context
}) => {
	const main = await context.newPage();

	await openRace(main, '/?lap=10');
	await main.getByRole('button', { name: 'Play replay' }).click();
	await expect(main.getByRole('button', { name: 'Pause replay' })).toBeVisible();

	const late = await context.newPage();

	await openRace(late, '/?lap=3');
	await expect(late.getByRole('button', { name: 'Pause replay' })).toBeVisible({
		timeout: 15_000
	});
	await expect(late.getByTestId('lap-counter')).not.toHaveText('Lap 3/50');

	await late.getByRole('button', { name: 'Pause replay' }).click();
	await expect(main.getByRole('button', { name: 'Play replay' })).toBeVisible();

	const stopped = await late.getByTestId('lap-counter').textContent();

	await main.waitForTimeout(2000);
	await expect(late.getByTestId('lap-counter')).toHaveText(stopped ?? '');
	await expect(main.getByTestId('lap-counter')).toHaveText(stopped ?? '');
});
