import { expect, type Locator, test } from '@playwright/test';

import { openRace } from './fixtures.ts';

// The mock replay has the real Las Vegas outline and no car positions, so every map estimates.

/** The map's pixels, to tell whether the cars moved. */
async function picture(map: Locator): Promise<Buffer> {
	return map.locator('canvas').first().screenshot();
}

test('the Track preset estimates places from timing on a replay without positions', async ({
	page
}) => {
	await openRace(page, '/d/track?lap=30&plan=pro');

	const map = page.getByTestId('track-map');

	await expect(map.getByText('Estimated', { exact: true })).toBeVisible();
	await expect(map.getByTestId('map-note')).toContainText('this session has no car positions');
	const cars = map.getByTestId('map-car-list').getByRole('listitem');

	// 18 cars on the circuit, then the two out of the race.
	await expect(cars).toHaveCount(20);
	await expect(cars.last()).toContainText('Out');

	for (const id of ['battle-map', 'pit-rejoin', 'dominance', 'flag-map', 'speed-map']) {
		await expect(page.getByTestId(id)).toBeVisible();
	}

	await expect(page.getByTestId('battle-ahead')).toBeVisible();
	await expect(page.getByTestId('rejoin-reading')).toContainText(/P\d+/);
	await expect(page.getByTestId('dominance-note')).toContainText('no mini-sector times');
	await expect(page.getByTestId('speed-map-empty')).toContainText('no car data');
});

test('the map follows the replay as it plays and as it is scrubbed', async ({ page }) => {
	await openRace(page, '/d/track?lap=30');

	const map = page.getByTestId('track-map');
	const still = await picture(map);

	await page.getByRole('button', { name: 'Go to lap 10' }).click();
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 10/50');
	expect(await picture(map)).not.toEqual(still);

	const before = await picture(map);

	await page.getByRole('button', { name: 'Play replay' }).click();
	await page.waitForTimeout(400);
	expect(await picture(map)).not.toEqual(before);
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 11/50', { timeout: 6000 });
});

test('with reduced motion the map steps once a second instead of gliding', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	// Real time: no lap ends in the few seconds watched, which would move the picture too.
	await page.addInitScript(() => window.localStorage.setItem('pitwall-replay-speed', '1'));
	await openRace(page, '/d/track?lap=30');

	const map = page.getByTestId('track-map');

	await page.getByRole('button', { name: 'Play replay' }).click();
	await page.waitForTimeout(1100);

	const first = await picture(map);

	await page.waitForTimeout(150);
	expect(await picture(map)).toEqual(first);
	await expect.poll(async () => (await picture(map)).equals(first), { timeout: 3000 }).toBe(false);
});

test('a tap on a car follows it, and the camera can follow the driver', async ({ page }) => {
	await openRace(page, '/d/track?lap=30&driver=1');

	const map = page.getByTestId('track-map');
	const list = map.getByTestId('map-car-list');

	// The list is the map's text alternative; narrow tiles keep it for screen readers and the keyboard.
	await list.getByRole('button', { name: /RUS/ }).press('Enter');
	await expect(page).toHaveURL(/driver=63/);

	const whole = await picture(map);

	await map.getByRole('radio', { name: 'Follow' }).click();
	expect(await picture(map)).not.toEqual(whole);
	await expect(map.locator('figcaption')).toContainText('following RUS');
});

test('free viewers see the Pro map tiles locked, with a preview key', async ({ page }) => {
	await openRace(page, '/d/track?lap=30');

	await expect(page.getByTestId('pit-rejoin')).toContainText('Pit rejoin is part of Pro');
	await expect(page.getByTestId('dominance')).toContainText('Mini-sector dominance is part of Pro');
	await expect(page.getByTestId('speed-map')).toContainText(
		'Speed and gear on the circuit is part of Pro'
	);
	await expect(page.getByTestId('battle-map').locator('canvas')).toBeVisible();
	await expect(page.getByTestId('flag-map').locator('canvas')).toBeVisible();
});

test('the Track group lists every map tile when adding a tile', async ({ page }) => {
	await openRace(page, '/d/battle?edit=1');

	await page.getByRole('button', { name: 'Add tile' }).click();

	const group = page.getByRole('region', { name: 'Track' });

	for (const title of [
		'Track map',
		'Battle map',
		'Pit rejoin',
		'Dominance',
		'Flag map',
		'Speed map'
	]) {
		await expect(group.getByRole('button', { name: new RegExp(`^${title}`) })).toBeVisible();
	}
});
