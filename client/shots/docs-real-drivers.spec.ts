import { expect, type Locator, type Page, test } from '@playwright/test';

import { docShot, openDocs, settle, type Theme } from './docs.ts';

// The pictures of docs/tour/drivers: the Drivers dashboard and the driver, lap and compare views
// of a session, on the saved sessions of the committed fixture. Real faces are off in these runs,
// so the drawn plates show. Needs docs-real.

test.use({ timezoneId: 'UTC', locale: 'en-GB' });

const NOW = '2026-10-03T12:00:00.000Z';

async function open(page: Page, route: string, theme: Theme = 'dark'): Promise<void> {
	await openDocs(page, route, { theme, now: NOW });
	await expect(page.getByTestId('lap-counter')).toBeAttached();
}

const sheet = (page: Page) => page.getByTestId('drill-sheet');

/**
 * The sheet from its top to just above `below`, a heading of a part that scrolls on past the
 * bottom of the screen: the picture ends between two parts and not in the middle of a chart.
 */
async function sheetAbove(page: Page, name: string, below: Locator, gap = 14): Promise<void> {
	await settle(page);

	const box = await sheet(page).boundingBox();
	const next = await below.boundingBox();

	if (!box || !next) {
		throw new Error('The sheet is not on screen');
	}

	await docShot(page, 'drivers', name, {
		x: box.x,
		y: 0,
		width: box.width,
		height: Math.floor(next.y - gap)
	});
}

/** The whole dashboard under the bar, which a 900 px screen would cut. */
async function dashboard(page: Page, name: string): Promise<void> {
	await settle(page);
	await page.evaluate(() => window.scrollTo(0, 0));

	const main = await page.getByRole('main').boundingBox();
	const viewport = page.viewportSize();

	if (!main || !viewport) {
		throw new Error('The dashboard is not on screen');
	}

	await docShot(page, 'drivers', name, {
		x: 0,
		y: 0,
		width: viewport.width,
		height: Math.min(viewport.height, Math.ceil(main.y + main.height))
	});
}

test.describe('the Drivers dashboard', () => {
	test.use({ viewport: { width: 1440, height: 1000 } });

	test('the Drivers dashboard of a race', async ({ page }) => {
		await open(page, '/d/drivers?session=9858&lap=30');
		await expect(page.getByTestId('grid-wall')).toBeVisible();
		await expect(page.getByTestId('driver-card')).toBeVisible();
		await dashboard(page, 'dashboard-race-lap-30');
	});

	test('the Drivers dashboard in the light theme', async ({ page }) => {
		await open(page, '/d/drivers?session=9858&lap=30', 'light');
		await expect(page.getByTestId('grid-wall')).toBeVisible();
		await dashboard(page, 'dashboard-race-lap-30-light');
	});
});

test('a driver’s session in the sheet beside the dashboard', async ({ page }) => {
	await open(page, '/session?session=9858&car=4&lap=30');
	await expect(sheet(page).getByTestId('driver-view')).toBeVisible();
	await expect(sheet(page).getByText('Stints', { exact: true })).toBeVisible();
	await sheetAbove(
		page,
		'driver-sheet-race',
		sheet(page).getByText('Position', { exact: true }).last()
	);
});

test('a lap with its traces against another driver', async ({ page }) => {
	await open(page, '/session?session=11373&car=63&carLap=26&vs=16');
	await expect(sheet(page).getByTestId('lap-facts')).toBeVisible();
	await expect(sheet(page).getByTestId('telemetry-charts')).toBeVisible();
	await sheetAbove(page, 'lap-traces-vs', sheet(page).getByText('RPM', { exact: true }), 2);
});

test('two drivers compared', async ({ page }) => {
	await open(page, '/session?session=9858&car=1&vs=63&lap=30');
	await expect(sheet(page).getByText('Lap by lap')).toBeVisible();
	await sheetAbove(page, 'compare-race', sheet(page).getByText('Best laps traced'));
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('a driver’s lap fills the phone', async ({ page }) => {
		await open(page, '/session?session=11373&car=63&carLap=26&vs=16');
		await expect(sheet(page).getByTestId('telemetry-charts')).toBeVisible();
		await sheetAbove(
			page,
			'lap-traces-phone',
			sheet(page)
				.getByText(/^Throttle/i)
				.first()
		);
	});
});
