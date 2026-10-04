import { expect, type Locator, type Page, test } from '@playwright/test';

import { docShot, openDocs, settle, type Theme } from './docs.ts';

// The pictures of docs/tour/history: the calendar, the standings, a head to head and a driver
// page, from the results index of the committed fixture (2018 to 2026). Needs docs-real.

test.use({ timezoneId: 'UTC', locale: 'en-GB' });

const NOW = '2026-10-03T12:00:00.000Z';

/** Before the season: its first round is "next", at the top of the calendar. */
const BEFORE_SEASON = '2026-03-01T12:00:00.000Z';

async function open(
	page: Page,
	route: string,
	{ theme = 'dark', now = NOW }: { theme?: Theme; now?: string } = {}
): Promise<void> {
	await openDocs(page, route, { theme, now });
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/**
 * The page from the top of the screen down to the end of `until`, so the picture ends between
 * two rows and not in the middle of one; the whole screen when there is none.
 */
async function shot(page: Page, name: string, until?: Locator, gap = 12): Promise<void> {
	await settle(page);
	await page.evaluate(() => window.scrollTo(0, 0));

	const viewport = page.viewportSize();
	const box = until ? await until.boundingBox() : null;

	if (!viewport) {
		throw new Error('No viewport');
	}

	await docShot(page, 'history', name, {
		x: 0,
		y: 0,
		width: viewport.width,
		height: box ? Math.min(viewport.height, Math.ceil(box.y + box.height + gap)) : viewport.height
	});
}

const totals = (page: Page) => page.getByTestId('h2h-totals');

test('the calendar lists the season with its .ics export', async ({ page }) => {
	await open(page, '/calendar?season=2026', { now: BEFORE_SEASON });
	await expect(page.getByTestId('calendar-page')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Season .ics' })).toBeVisible();
	await expect(page.getByTestId('calendar-next')).toBeVisible();
	await shot(page, 'calendar', page.locator('[data-testid^="calendar-round-"]').nth(3), 0);
});

test('the standings after a chosen round', async ({ page }) => {
	await open(page, '/standings?season=2025&round=11');
	await expect(page.getByTestId('standings-row').first()).toContainText('PIA');
	await expect(page.getByTestId('round-podium')).toBeVisible();
	await shot(page, 'standings-round-11', page.getByTestId('standings-row').nth(11), 2);
});

test('the constructors standings of a season', async ({ page }) => {
	await open(page, '/standings?season=2021&view=teams');
	await expect(page.getByTestId('standings-row').first()).toBeVisible();
	await shot(page, 'team-standings-2021', page.getByTestId('standings-row').last(), 24);
});

test('a head to head of two drivers over a range of seasons', async ({ page }) => {
	await open(page, '/h2h?a=lando-norris&b=oscar-piastri&from=2023.1&to=2025.24');
	await expect(page.getByTestId('h2h-name-a')).toHaveText('Lando Norris');
	await expect(page.getByTestId('h2h-totals')).toBeVisible();
	await shot(
		page,
		'head-to-head',
		totals(page).getByRole('listitem').filter({ hasText: 'Poles' }),
		8
	);
});

test.describe('a driver page', () => {
	test.use({ viewport: { width: 1440, height: 1000 } });

	test('a driver page sums up every season', async ({ page }) => {
		await open(page, '/drivers/lando-norris');
		await expect(page.getByTestId('driver-hero')).toBeVisible();
		await expect(page.getByTestId('driver-seasons').getByRole('row')).not.toHaveCount(1);
		await shot(
			page,
			'driver-page',
			page.getByTestId('driver-weekends').getByRole('row').nth(13),
			6
		);
	});
});

test('the standings in the light theme', async ({ page }) => {
	await open(page, '/standings?season=2025&round=11', { theme: 'light' });
	await expect(page.getByTestId('standings-row').first()).toContainText('PIA');
	await expect(page.getByTestId('round-podium')).toBeVisible();
	await shot(page, 'standings-round-11-light', page.getByTestId('standings-row').nth(11), 2);
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('a head to head on a phone', async ({ page }) => {
		await open(page, '/h2h?a=lando-norris&b=oscar-piastri&from=2023.1&to=2025.24');
		await expect(page.getByTestId('h2h-name-a')).toHaveText('Lando Norris');
		await expect(page.getByTestId('h2h-totals')).toBeVisible();
		await shot(page, 'head-to-head-phone', totals(page).getByRole('listitem').nth(2), 6);
	});
});
