import { expect, type Locator, type Page, test } from '@playwright/test';

import { docShot, openDocs, type Region } from './docs.ts';

// The Track dashboard on the 2025 Las Vegas race at lap 30 (9858) and on 2026 Baku qualifying
// (11373): the maps, the gap straight, the ghost lap, and the telemetry traces from Analysis.

const RACE = '/d/track?session=9858&lap=30&plan=pro';

/** The bar with the session and lap, and the dashboard's first two rows under it. */
const SCREEN: Region = { x: 0, y: 0, width: 1440, height: 892 };

/** Qualifying leaves the pit rejoin slot a line, so its picture stops before the speed map. */

const TOP = 64;

/** Waits until every Track tile has read the race, the way e2e/real/track.spec.ts does. */
async function trackRead(page: Page) {
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 30/50');
	await expect(page.getByTestId('track-map').getByText('Replay', { exact: true })).toBeVisible();
	await expect(
		page.getByTestId('track-map').getByTestId('map-car-list').getByRole('listitem')
	).toHaveCount(20);
	await expect(page.getByTestId('battle-ahead')).toContainText('PIA');
	await expect(page.getByTestId('rejoin-reading')).toContainText(/Box now\s*P\d+/);
	await expect(page.getByTestId('dominance-note')).toContainText(/timed from car positions/, {
		timeout: 15_000
	});
	await expect(page.getByTestId('speed-map-legend')).toContainText('Top speed', {
		timeout: 15_000
	});
	await expect(page.getByTestId('flag-list')).toContainText('No sector flags');
}

/** Scrolls so the tile sits where the first row does, then waits for what it draws. */
async function bring(page: Page, tile: Locator) {
	await tile.scrollIntoViewIfNeeded();

	const box = await tile.boundingBox();

	if (box) {
		await page.evaluate((by) => window.scrollBy(0, by), box.y - TOP);
	}
}

/** The rectangle two tiles share, for a picture of a pair. */
async function around(first: Locator, second: Locator): Promise<Region> {
	const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);

	if (!a || !b) {
		throw new Error('A tile to crop to is not on screen');
	}

	const x = Math.min(a.x, b.x);
	const y = Math.min(a.y, b.y);

	return {
		x,
		y,
		width: Math.max(a.x + a.width, b.x + b.width) - x,
		height: Math.max(a.y + a.height, b.y + b.height) - y
	};
}

test('the Track dashboard on the race, and its tiles one by one', async ({ page }) => {
	await openDocs(page, RACE);
	await trackRead(page);

	await docShot(page, 'track', 'track-dashboard-lap-30', SCREEN);
	await docShot(page, 'track', 'track-map', page.getByTestId('tile-track-map'));
	await docShot(
		page,
		'track',
		'battle-map-and-pit-rejoin',
		await around(page.getByTestId('tile-battle-map'), page.getByTestId('tile-pit-rejoin'))
	);
	await docShot(page, 'track', 'dominance', page.getByTestId('tile-dominance'));
	await docShot(page, 'track', 'speed-map', page.getByTestId('tile-speed-map'));

	const gap = page.getByTestId('tile-gap-distance');

	await bring(page, gap);
	await expect(page.getByTestId('gap-car-VER')).toBeVisible();
	await expect(page.getByTestId('gap-note')).toBeVisible();
	await docShot(page, 'track', 'gap-distance-race', gap);

	const ghost = page.getByTestId('tile-ghost-lap');

	await bring(page, ghost);
	// A third of the way round the lap, where the order has already started to spread.
	await page.getByTestId('ghost-scrub').fill('30000');
	await expect(page.getByTestId('ghost-time')).toHaveText('30.0s');
	await page.getByTestId('ghost-scrub').blur();
	await docShot(page, 'track', 'ghost-lap', ghost);
});

test('telemetry traces set one lap against two others', async ({ page }) => {
	await openDocs(page, '/analysis?session=9858&plan=pro');
	await page.getByRole('group', { name: 'Telemetry' }).scrollIntoViewIfNeeded();

	const telemetry = page.getByTestId('tile-telemetry');

	await expect(page.getByTestId('telemetry-charts')).toBeVisible({ timeout: 20_000 });
	await expect(page.getByTestId('telemetry-slot-A')).toContainText('L50 1:33.365');
	await expect(page.getByTestId('telemetry-slot-B')).toContainText('RUS');
	await bring(page, telemetry);
	await docShot(page, 'track', 'telemetry-traces', telemetry);
});

test('qualifying on the circuit', async ({ page }) => {
	await openDocs(page, '/d/track?session=11373&plan=pro');
	await expect(page.getByTestId('track-map').getByText('Replay', { exact: true })).toBeVisible();
	await expect(page.getByTestId('battle-map').locator('canvas')).toBeVisible();
	await expect(page.getByTestId('tile-away')).toContainText('Pit rejoinRaces only');
	await expect(page.getByTestId('dominance-note')).toContainText(/timed from car positions/, {
		timeout: 15_000
	});
	await expect(page.getByTestId('speed-map-legend')).toContainText('Top speed', {
		timeout: 15_000
	});
	await expect(page.getByTestId('flag-list')).toBeVisible();

	await docShot(page, 'track', 'track-dashboard-qualifying', SCREEN);
});

test('the same dashboard in the light theme', async ({ page }) => {
	await openDocs(page, RACE, { theme: 'light' });
	await trackRead(page);

	await docShot(page, 'track', 'track-dashboard-lap-30-light', SCREEN);
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('the track map leads the stack', async ({ page }) => {
		await openDocs(page, RACE);
		await expect(page.getByTestId('track-map').getByText('Replay', { exact: true })).toBeVisible();
		await expect(
			page.getByTestId('track-map').getByTestId('map-car-list').getByRole('listitem')
		).toHaveCount(20);
		await expect(page.getByTestId('battle-ahead')).toContainText('PIA');

		await docShot(page, 'track', 'track-dashboard-phone', { x: 0, y: 48, width: 390, height: 796 });
	});
});
