import { expect, type Page, test } from '@playwright/test';

import { docShot, openDocs, type Theme } from './docs.ts';

/**
 * The replay pictures of docs/tour/replay: the 2025 Las Vegas race (session 9858) at lap 30, its
 * Replay tile with the keys and the race barcode, a finished session held back as unseen, the
 * session picker, the home page, and the end of the race. Real data of the committed fixture.
 */

const RACE = '/session?session=9858';

/** The Monday after Las Vegas. */
const AFTER_VEGAS = '2025-11-24T12:00:00Z';

/** A week after Baku 2026, as the home's own test pins it: three recent rounds are unseen. */
const AFTER_BAKU = '2026-10-03T12:00:00Z';

async function openRaceAt(page: Page, lap: number, theme: Theme = 'dark'): Promise<void> {
	await openDocs(page, `${RACE}&lap=${lap}`, { theme, now: AFTER_VEGAS });
	await expect(page.getByTestId('lap-counter')).toHaveText(`Lap ${lap}/50`);
	await expect(page.getByTestId('timing-row-VER')).toBeVisible();
}

test('the race at lap 30, full screen', async ({ page }) => {
	await openRaceAt(page, 30);
	await docShot(page, 'replay', 'race-lap-30');
});

test('the race at lap 30, light', async ({ page }) => {
	await openRaceAt(page, 30, 'light');
	await docShot(page, 'replay', 'race-lap-30-light');
});

test('the Replay tile with its keys and the race barcode', async ({ page }) => {
	await openRaceAt(page, 30);
	await docShot(page, 'replay', 'replay-tile', page.getByRole('region', { name: 'Replay' }), 12);
});

test.describe('at the flag', () => {
	// Tall enough for the whole order down to the disqualified cars.
	test.use({ viewport: { width: 1440, height: 1100 } });

	test('the timing tower at the flag, with retirements and disqualifications', async ({ page }) => {
		await openDocs(page, RACE, { now: AFTER_VEGAS });
		await expect(page.getByTestId('lap-counter')).toHaveText('Lap 50/50');
		await expect(page.getByTestId('timing-row-NOR').getByText('DSQ').first()).toBeVisible();
		await docShot(page, 'replay', 'race-finish', page.getByTestId('tile-timing'), 12);
	});
});

test('a finished session the viewer has not seen is held back', async ({ page }) => {
	await openDocs(page, RACE, { spoilers: true, now: AFTER_VEGAS });
	await expect(page.getByTestId('spoiler-start')).toContainText('Results hidden');
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 1/50');

	const banner = await page.getByTestId('spoiler-start').boundingBox();

	if (!banner) {
		throw new Error('The spoiler banner is not on screen');
	}

	// The bar and the banner, cut under it so no tile below is cut mid-row.
	await docShot(page, 'replay', 'spoiler-hold', {
		x: 0,
		y: 0,
		width: 1440,
		height: Math.round(banner.y + banner.height) + 12
	});
});

test('the session picker: season, meeting, session', async ({ page }) => {
	await openDocs(page, `${RACE}&lap=30`, { now: AFTER_VEGAS });
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 30/50');
	await page.getByRole('button', { name: /^Sessions/ }).click();

	const picker = page.getByTestId('session-picker');

	await expect(picker.getByTestId('session-9858')).toBeVisible();
	await docShot(
		page,
		'replay',
		'session-picker',
		page.getByRole('dialog', { name: 'Sessions' }),
		12
	);
});

test('the home page holds the latest weekend back', async ({ page }) => {
	await openDocs(page, '/', { spoilers: true, now: AFTER_BAKU });
	await expect(page.getByTestId('home-championship')).toBeVisible();
	await expect(page.getByTestId('home-weekend')).toBeVisible();
	await docShot(page, 'replay', 'home');
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('the race at lap 30', async ({ page }) => {
		await openRaceAt(page, 30);
		await docShot(page, 'replay', 'race-lap-30-phone');
	});
});
