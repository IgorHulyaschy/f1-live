import { readFile } from 'node:fs/promises';

import { expect, type Page, test } from '@playwright/test';

import { openRace } from '../fixtures.ts';

// 2026 Bahrain qualifying (11730): the fixture keeps every driver's best lap of each part with its
// telemetry (e2e/real/derive-telemetry.ts). Verstappen took pole with 1:35.130, Hamilton 0.298 s
// behind.

/** Opens the Quali layout on Bahrain and brings its gap tile, the last one, into view. */
async function openGaps(page: Page, plan: 'free' | 'pro' = 'pro') {
	await openRace(page, `/session?session=11730&plan=${plan}`);
	await page.getByTestId('tile-gap-distance').scrollIntoViewIfNeeded();

	const tile = page.getByTestId('gap-distance');

	await expect(tile.getByTestId('gap-car-VER')).toBeVisible();

	return tile;
}

/** A PNG's width and height, from its header. */
async function pngSize(path: string): Promise<[number, number]> {
	const bytes = await readFile(path);

	return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

test('the gap tile puts Q3 on a straight, each car behind pole by its metres', async ({ page }) => {
	const tile = await openGaps(page);

	await expect(tile.getByRole('radio', { name: 'Q3' })).toBeChecked();
	await expect(tile.getByTestId('gap-car-VER')).toContainText('1:35.130');
	// 0.298 s at about 269 km/h over the line, from Hamilton's own telemetry.
	await expect(tile.getByTestId('gap-car-HAM')).toContainText('+0.298');
	await expect(tile.getByTestId('gap-car-HAM')).toContainText('22 m');
	await expect(tile.locator('figcaption li')).toHaveCount(10);
	await expect(tile.getByTestId('gap-note')).toContainText('from its own telemetry');
});

test('the gap tile switches parts, the whole field and sectors', async ({ page }) => {
	const tile = await openGaps(page);

	await tile.getByRole('radio', { name: 'Q1' }).click();
	// Q1 shows the whole field, Hamilton 0.118 s and 8.5 m behind.
	await expect(tile.locator('figcaption li')).toHaveCount(22);
	await expect(tile.getByTestId('gap-car-HAM')).toContainText('+0.118');

	await tile.getByRole('radio', { name: 'Top 10' }).click();
	await expect(tile.locator('figcaption li')).toHaveCount(10);

	await tile.getByRole('radio', { name: 'Sectors' }).click();
	await expect(tile.getByTestId('gap-sectors').getByRole('heading')).toHaveText([
		'Sector 1',
		'Sector 2',
		'Sector 3'
	]);
	await expect(tile.getByTestId('gap-note')).toContainText('the quickest through it');
});

test('Share saves the straight as a picture at both social sizes', async ({ page }) => {
	const tile = await openGaps(page);

	for (const [item, size] of [
		['Post 1080 × 1350', [1080, 1350]],
		['Story 1080 × 1920', [1080, 1920]]
	] as const) {
		await expect(tile.getByTestId('gap-export')).toBeEnabled();
		await tile.getByTestId('gap-export').click();

		const [download] = await Promise.all([
			page.waitForEvent('download'),
			page.getByRole('menuitem', { name: item }).click()
		]);

		expect(download.suggestedFilename()).toMatch(/qualifying-gaps-11730-1080x\d+\.png$/);
		expect(await pngSize(await download.path())).toEqual(size);
		await expect(page.getByRole('menu')).toHaveCount(0);
	}
});

test('free viewers see Share locked', async ({ page }) => {
	const tile = await openGaps(page, 'free');

	await expect(tile.getByTestId('gap-export-locked')).toBeVisible();
	await expect(tile.getByTestId('gap-export')).toHaveCount(0);
});

test('the ghost lap runs the best laps from the line, and scrubs', async ({ page }) => {
	await openRace(page, '/d/track?session=11730&plan=pro');
	await page.getByTestId('tile-ghost-lap').scrollIntoViewIfNeeded();

	const ghost = page.getByTestId('ghost-lap');

	await expect(ghost.getByTestId('ghost-time')).toHaveText('0.0s');
	await ghost.getByRole('button', { name: 'Play the ghost lap' }).click();
	await expect(ghost.getByTestId('ghost-time')).not.toHaveText('0.0s');
	await ghost.getByRole('button', { name: 'Pause the ghost lap' }).click();

	await ghost.getByTestId('ghost-scrub').fill('60000');
	await expect(ghost.getByTestId('ghost-time')).toHaveText('60.0s');
	await expect(ghost.getByTestId('ghost-order').getByRole('listitem')).toHaveCount(10);
});

test('qualifying analysis plots push laps by session time and gaps by part', async ({ page }) => {
	await openRace(page, '/analysis?session=11730');

	const chart = page.getByTestId('chart-lapTime');

	await expect(chart).toContainText('Push laps only');
	await expect(chart.getByTestId('quali-chart')).toBeVisible();
	await expect(chart.getByText('Q2', { exact: true })).toBeVisible();

	await page.getByRole('tab', { name: 'Gap' }).click();
	await expect(page.getByTestId('chart-gap')).toContainText('behind that part’s fastest');
	await expect(page.getByTestId('chart-gap').getByTestId('quali-chart')).toBeVisible();
});

test('the race layout shows the track map without scrolling on a laptop', async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await openRace(page, '/session?session=9858&lap=30');

	const box = await page.getByTestId('tile-track-map').boundingBox();

	expect(box).not.toBeNull();
	expect((box?.y ?? 1000) + (box?.height ?? 0)).toBeLessThan(1000);
});
