import { expect, type Locator, test } from '@playwright/test';

import { openRace } from '../fixtures.ts';

// The fixture keeps the replay positions round the start and laps 10, 30 and 50 of the 2025 Las
// Vegas race and the last minutes of 2026 Baku qualifying (e2e/real/derive-telemetry.ts).

/** The map's pixels, to tell whether the cars moved. */
async function picture(map: Locator): Promise<Buffer> {
	return map.locator('canvas').first().screenshot();
}

test('the race map draws the cars from the replay positions, in their order on the road', async ({
	page
}) => {
	await openRace(page, '/d/track?session=9858&lap=30');

	const map = page.getByTestId('track-map');
	const cars = map.getByTestId('map-car-list').getByRole('listitem');

	await expect(map.getByText('Replay', { exact: true })).toBeVisible();
	// 2025 cars have DRS: its zones come from where the flap opened on the fixture's laps.
	await expect(map.getByTestId('map-note')).toHaveText('Bands: DRS zones');
	// 18 cars on the circuit in their order, then the two out of the race.
	await expect(cars).toHaveCount(20);
	await expect(cars.first()).toContainText('VER');
	await expect(cars.last()).toContainText('Out');
});

test('the map runs between laps on the replay clock and follows scrubbing', async ({ page }) => {
	await openRace(page, '/d/track?session=9858&lap=30');

	const map = page.getByTestId('track-map');

	await expect(map.getByText('Replay', { exact: true })).toBeVisible();

	// Two presses from the default 60× give 10×.
	await page.getByRole('button', { name: /Replay speed/ }).click();
	await page.getByRole('button', { name: /Replay speed/ }).click();
	await expect(page.getByRole('button', { name: /Replay speed/ })).toHaveText('10×');

	const paused = await picture(map);

	await page.getByRole('button', { name: 'Play replay' }).click();
	await page.waitForTimeout(500);

	// The cars move within the lap while the lap counter waits for the leader to cross the line.
	expect(await picture(map)).not.toEqual(paused);
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 30/50');

	await page.getByRole('button', { name: 'Pause replay' }).click();

	const before = await picture(map);

	await page.getByRole('button', { name: 'Go to lap 10' }).click();
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 10/50');
	await expect.poll(async () => (await picture(map)).equals(before)).toBe(false);
});

test('every Track tile reads the race', async ({ page }) => {
	await openRace(page, '/d/track?session=9858&lap=30&plan=pro');

	await expect(page.getByTestId('battle-ahead')).toContainText('PIA');
	await expect(page.getByTestId('battle-behind')).toContainText('SAI');
	await expect(page.getByTestId('rejoin-reading')).toContainText(/Box now\s*P\d+/);
	await expect(page.getByTestId('pit-loss')).toContainText(/measured from \d+ stops/);
	await expect(page.getByTestId('dominance-note')).toContainText('Timed from car positions', {
		timeout: 15_000
	});
	await expect(page.getByTestId('dominance-legend')).toContainText(/\d+ of 22/);
	await expect(page.getByTestId('flag-list')).toContainText('No yellow flags');
	await expect(page.getByTestId('speed-map-legend')).toContainText('Top speed', {
		timeout: 15_000
	});

	await page.getByRole('button', { name: 'Go to lap 2', exact: true }).click();
	await expect(page.getByTestId('flag-list')).toContainText('Double yellow in sector 2');
});

test('every Track tile reads a 2026 qualifying session', async ({ page }) => {
	await openRace(page, '/d/track?session=11373&plan=pro');

	await expect(page.getByTestId('track-map').getByText('Replay', { exact: true })).toBeVisible();
	await expect(page.getByTestId('battle-map').locator('canvas')).toBeVisible();
	await expect(page.getByTestId('pit-rejoin').getByTestId('race-only')).toBeVisible();
	await expect(page.getByTestId('dominance-note')).toContainText('Timed from car positions', {
		timeout: 15_000
	});
	await expect(page.getByTestId('speed-map-legend')).toContainText('Top speed', {
		timeout: 15_000
	});
	await expect(page.getByTestId('flag-list')).toBeVisible();
});

test('a session with no circuit outline says so', async ({ page }) => {
	await openRace(page, '/d/track?session=9854');

	await expect(page.getByTestId('track-map').getByTestId('map-empty')).toContainText(
		'No circuit outline'
	);
});
