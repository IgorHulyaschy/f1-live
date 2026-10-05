import { expect, type Page, test } from '@playwright/test';

import { docShot, openDocs, type Theme } from './docs.ts';

/**
 * The race watching pictures of docs/tour/racewatch: Fights, Pace now and the Duel on the Race
 * layout, and the charts that read as differences, on the 2025 Las Vegas race (session 9858).
 * Real data of the committed fixture. The live key beside play shows only on a session that is
 * running, so it is pictured by docs-live-live.spec.ts and not here.
 */

const RACE = '/session?session=9858';

/** The Monday after Las Vegas. */
const AFTER_VEGAS = '2025-11-24T12:00:00Z';

/** Russell on fresh tyres closing on Leclerc after his stop on lap 17. */
const FIGHT_LAP = 22;

/** Leclerc right behind Piastri. */
const DUEL_LAP = 38;

async function openRaceWatching(page: Page, lap: number, theme: Theme = 'dark') {
	await openDocs(page, `${RACE}&lap=${lap}`, { theme, now: AFTER_VEGAS });
	await expect(page.getByTestId('lap-counter')).toHaveText(`Lap ${lap}/50`);
	await expect(page.getByTestId('timing-row-VER')).toBeVisible();
	await expect(page.getByTestId('fights').getByTestId('fight-row').first()).toBeVisible({
		timeout: 20_000
	});
}

/** The Battle tab: the Duel, Race pace and Pace now side by side. */
async function openBattle(page: Page, lap: number, pair = '') {
	await openDocs(page, `/d/battle?session=9858&lap=${lap}${pair}&plan=pro`, { now: AFTER_VEGAS });
	await expect(page.getByTestId('lap-counter')).toHaveText(`Lap ${lap}/50`);
	await expect(
		page
			.getByTestId('pace-now')
			.getByTestId(/^pace-row-/)
			.first()
	).toBeVisible({ timeout: 20_000 });
	await expect(page.getByTestId('duel-verdict')).toBeVisible();
	// The duel chart draws its last lap label once the bars are in.
	await expect(
		page.getByTestId('duel-chart').locator('text', { hasText: new RegExp(`^L${lap}$`) })
	).toBeVisible();
}

test('the Race layout leads with the map, the tower and the fights', async ({ page }) => {
	await openRaceWatching(page, FIGHT_LAP);
	await expect(page.getByTestId('fights')).toContainText('Stopped 4 laps ago');
	await page.mouse.move(2, 2);
	await docShot(page, 'racewatch', 'race-layout');
});

test('the Race layout, light', async ({ page }) => {
	await openRaceWatching(page, FIGHT_LAP, 'light');
	await page.mouse.move(2, 2);
	await docShot(page, 'racewatch', 'race-layout-light');
});

test('Fights ranks the pairs racing now and the ones coming', async ({ page }) => {
	await openRaceWatching(page, FIGHT_LAP);

	const fights = page.getByTestId('fights');

	await expect(fights).toContainText(/\d+ now, \d+ coming/);
	await expect(fights).toContainText('in 2 to 3 laps');
	await docShot(page, 'racewatch', 'fights', page.getByTestId('tile-fights'), 8);
});

test('Pace now ranks the whole field', async ({ page }) => {
	await openBattle(page, FIGHT_LAP);
	await expect(page.getByTestId('pace-now')).toContainText('Fastest');
	await page.mouse.move(2, 2);
	await docShot(page, 'racewatch', 'pace-now', page.getByTestId('tile-pace-now'), 8);
});

test('the Duel with two drivers picked', async ({ page }) => {
	await openBattle(page, DUEL_LAP, '&duel=PIA,LEC');
	await expect(page.getByTestId('duel-verdict')).toContainText(/LEC .*faster.*behind/);

	// Away from the rows, so no hover colours a row.
	await page.mouse.move(2, 2);
	await docShot(page, 'racewatch', 'duel', page.getByTestId('tile-duel'), 8);
});

test('the lap time chart reads as seconds off the quickest car', async ({ page }) => {
	await openDocs(page, `/analysis?session=9858&lap=${DUEL_LAP}&duel=PIA,LEC`, {
		now: AFTER_VEGAS
	});
	await expect(page.getByTestId('lap-counter')).toHaveText(`Lap ${DUEL_LAP}/50`);

	const chart = page.getByTestId('chart-lapTime');

	await expect(chart).toBeVisible();
	await expect(chart).toContainText('VSC');
	await page.mouse.move(2, 2);
	await docShot(
		page,
		'racewatch',
		'delta-chart-lap-times',
		page.getByTestId('tile-chart'),
		8,
		true
	);
});

test('the battle chart names the cars at the line ends', async ({ page }) => {
	await openDocs(page, '/d/battle?session=9858&lap=30&driver=16', { now: AFTER_VEGAS });
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 30/50');
	await expect(page.getByTestId('chart-battle')).toBeVisible({ timeout: 20_000 });
	await page.mouse.move(2, 2);
	await docShot(page, 'racewatch', 'delta-chart-battle', page.getByTestId('tile-chart'), 8, true);
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('Fights come first on a phone', async ({ page }) => {
		await openDocs(page, `${RACE}&lap=${FIGHT_LAP}`, { now: AFTER_VEGAS });
		await expect(page.getByTestId('lap-counter')).toHaveText(`Lap ${FIGHT_LAP}/50`);
		await expect(page.getByTestId('fights').getByTestId('fight-row').first()).toBeVisible({
			timeout: 20_000
		});
		await docShot(page, 'racewatch', 'fights-phone');
	});
});
