import { expect, type Page, test } from '@playwright/test';

import { docShot, openDocs } from './docs.ts';

/**
 * The race page pictures of docs/tour/race-page: the tabs that fit one screen (Race, Strategy,
 * Battle, Analysis), a tile's resize grip and collapse key, and full screen, on the 2025 Las Vegas
 * race (session 9858) at lap 30. The Race tab itself is pictured by docs-real-racewatch.spec.ts.
 * Real data of the committed fixture.
 */

const AFTER_VEGAS = '2025-11-24T12:00:00Z';

async function openTab(page: Page, path: string): Promise<void> {
	await openDocs(page, `${path}${path.includes('?') ? '&' : '?'}session=9858&lap=30&plan=pro`, {
		now: AFTER_VEGAS
	});
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 30/50');
	await expect(page.getByTestId('dashboard-grid')).toBeVisible();
}

test('the bar names the tabs, the session and the keys', async ({ page }) => {
	await openTab(page, '/session');
	await expect(page.getByTestId('timing-row-VER')).toBeVisible();
	await page.mouse.move(2, 2);

	const bar = await page.getByTestId('app-bar').boundingBox();

	if (!bar) {
		throw new Error('The bar is not on screen');
	}

	await docShot(page, 'race-page', 'bar-tabs', {
		x: 0,
		y: 0,
		width: bar.width,
		height: Math.round(bar.y + bar.height) + 8
	});
});

test('Strategy on one screen', async ({ page }) => {
	await openTab(page, '/strategy');
	await expect(page.getByTestId('tile-stints')).toBeVisible();
	await page.mouse.move(2, 2);
	await docShot(page, 'race-page', 'tab-strategy');
});

test('Battle on one screen', async ({ page }) => {
	await openTab(page, '/d/battle');
	await expect(page.getByTestId('tile-duel')).toBeVisible();
	await expect(page.getByTestId('chart-battle')).toBeVisible({ timeout: 20_000 });
	await page.mouse.move(2, 2);
	await docShot(page, 'race-page', 'tab-battle', undefined, 0, true);
});

test('Analysis on one screen', async ({ page }) => {
	await openTab(page, '/analysis');
	await expect(page.getByTestId('chart-lapTime')).toBeVisible();
	await page.mouse.move(2, 2);
	await docShot(page, 'race-page', 'tab-analysis', undefined, 0, true);
});

test('a tile shows its resize grip and collapse key on hover', async ({ page }) => {
	await openTab(page, '/session');
	await expect(page.getByTestId('fights').getByTestId('fight-row').first()).toBeVisible({
		timeout: 20_000
	});

	const fights = page.getByTestId('tile-fights');

	await fights.hover();
	await expect(fights.getByTestId('tile-collapse-key')).toBeVisible();
	await docShot(page, 'race-page', 'tile-grip-and-collapse', fights, 12);
});

test('full screen gives the tiles the whole window', async ({ page }) => {
	await openTab(page, '/session');
	await expect(page.getByTestId('timing-row-VER')).toBeVisible();
	await page.keyboard.press('f');
	await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
	await expect(page.getByTestId('app-bar')).toHaveAttribute('data-hidden', '');
	await page.mouse.move(700, 500);
	await docShot(page, 'race-page', 'full-screen');
});
