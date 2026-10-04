import { expect, type Page, test } from '@playwright/test';

import { fromMenu, openRace } from './fixtures.ts';

/** A dashboard saved before tiles always fit the window: it still carries the old Fit switch. */
const OLD_DASHBOARD = {
	id: 'board-old',
	name: 'Old wall',
	fit: true,
	tiles: [
		{ id: 'timing-1', kind: 'timing' },
		{ id: 'track-map-1', kind: 'track-map' }
	],
	layout: [
		{ i: 'timing-1', x: 0, y: 0, w: 12, h: 12 },
		{ i: 'track-map-1', x: 12, y: 0, w: 12, h: 12 }
	]
};

function rootFontSize(page: Page): Promise<number> {
	return page.evaluate(() =>
		Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
	);
}

test('the screen sets the size, Larger text is the one switch, and old settings carry over', async ({
	page
}) => {
	await page.addInitScript(
		(saved) => {
			if (window.localStorage.getItem('pitwall-larger-text') === null) {
				window.localStorage.setItem('pitwall-scale', 'xl');
				window.localStorage.setItem('pitwall-dashboards', saved);
			}
		},
		JSON.stringify([OLD_DASHBOARD])
	);
	await openRace(page, '/d/board-old');

	await expect(page.getByTestId('tile-timing')).toBeVisible();
	await expect(page.getByTestId('tile-track-map')).toBeVisible();
	await expect(page.getByRole('radiogroup', { name: /size/i })).toHaveCount(0);
	await expect(page.getByRole('switch', { name: /fit/i })).toHaveCount(0);

	// The old XL size reads as Larger text, under its new key.
	expect(await rootFontSize(page)).toBe(20);
	expect(await page.evaluate(() => window.localStorage.getItem('pitwall-scale'))).toBeNull();

	await page.getByTestId('app-menu').click();
	await expect(page.getByRole('menuitemcheckbox', { name: 'Larger text' })).toBeChecked();
	await page.getByRole('menuitemcheckbox', { name: 'Larger text' }).click();
	expect(await rootFontSize(page)).toBe(16);

	await page.reload();
	await expect(page.getByTestId('tile-timing')).toBeVisible();
	expect(await rootFontSize(page)).toBe(16);

	// The next save drops the old switch.
	await fromMenu(page, 'Edit');
	await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Old wall, kept');
	await page.getByRole('button', { name: 'Done' }).click();

	const saved = await page.evaluate(() => window.localStorage.getItem('pitwall-dashboards'));

	expect(saved).toContain('Old wall, kept');
	expect(saved).not.toContain('"fit"');
});
