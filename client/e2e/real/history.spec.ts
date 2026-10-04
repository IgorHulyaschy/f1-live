import { expect, type Page, test } from '@playwright/test';

import { serveTestPictures } from '../pictures';

// The results index of 2018 to 2026 (e2e/real/data/out/results), read from the official timing
// data. Totals are the ones an independent source (the Jolpica API) gives for the same pair.

async function openHistory(
	page: Page,
	path: string,
	{ spoilerProtection = false }: { spoilerProtection?: boolean } = {}
): Promise<void> {
	await serveTestPictures(page);
	await page.addInitScript(() => window.localStorage.setItem('pitwall-welcomed', 'true'));

	if (!spoilerProtection) {
		await page.addInitScript(() => window.localStorage.setItem('pitwall-spoiler-free', 'false'));
	}

	await page.goto(path);
}

const totals = (page: Page) => page.getByTestId('h2h-totals');

test('head to head shows the totals of two teammates and a fact that links to its session', async ({
	page
}) => {
	await openHistory(page, '/h2h?a=lando-norris&b=oscar-piastri&from=2023.1&to=2025.24');

	// The first visit compiles the page and loads three seasons in the dev server.
	await expect(page.getByTestId('h2h-name-a')).toHaveText('Lando Norris', { timeout: 15_000 });
	await expect(totals(page).getByRole('listitem').filter({ hasText: 'Races' })).toContainText('70');
	await expect(totals(page).getByRole('listitem').filter({ hasText: 'Qualifying' })).toContainText(
		'48'
	);
	await expect(totals(page).getByRole('listitem').filter({ hasText: 'Wins' })).toContainText('11');
	await expect(totals(page).getByRole('listitem').filter({ hasText: 'Points' })).toContainText(
		'1002'
	);

	// No session is on screen, so the bar has none; the fact's link opens one.
	await expect(page.getByTestId('live-strip')).toHaveCount(0);

	const link = page.getByTestId('h2h-fact').first().getByRole('link').first();

	await expect(link).toHaveAttribute('href', /session=\d+/);
	await link.click();
	await expect(page).toHaveURL(/session=\d+/);
	await expect(page.getByTestId('lap-counter')).toBeVisible();
});

test('a session the viewer has not seen stays out of the totals until revealed', async ({
	page
}) => {
	// Two days after Las Vegas 2025: Mexico, Brazil and Las Vegas are recent and unseen, Austin is not.
	await page.clock.setFixedTime(new Date('2025-11-24T12:00:00.000Z'));
	await openHistory(page, '/h2h?a=lando-norris&b=oscar-piastri&from=2025.19&to=2025.22', {
		spoilerProtection: true
	});

	const races = totals(page).getByRole('listitem').filter({ hasText: 'Races' });
	const note = page.getByTestId('hidden-note');

	await expect(note).toContainText(/\d+ sessions? hidden/);
	await expect(races).toHaveText('1Races1');

	await note.getByRole('button', { name: 'Reveal to include' }).click();

	await expect(note).toHaveCount(0);
	await expect(races).toHaveText('4Races4');
});

test.describe('in Tokyo', () => {
	test.use({ timezoneId: 'Asia/Tokyo', locale: 'en-GB' });

	test('the calendar shows this weekend’s race in local time', async ({ page }) => {
		await page.clock.setFixedTime(new Date('2026-10-03T12:00:00.000Z'));
		await openHistory(page, '/calendar?season=2026');

		await expect(page.getByTestId('calendar-page')).toBeVisible();

		// The race starts at 07:00 UTC.
		await expect(page.getByTestId('calendar-session-11731')).toContainText('16:00');
		await expect(page.getByTestId('calendar-next')).toBeVisible();
	});
});

test('the calendar fills a wide screen with more weekends side by side', async ({ page }) => {
	const columns = (): Promise<number> =>
		page
			.getByTestId('calendar-page')
			.locator('ol')
			.first()
			.evaluate((list) => getComputedStyle(list).gridTemplateColumns.split(' ').length);

	await openHistory(page, '/calendar?season=2026');
	await expect.poll(columns).toBe(2);

	await page.setViewportSize({ width: 2560, height: 1440 });
	await expect.poll(columns).toBe(4);
});

test('the standings show the championship after a chosen round', async ({ page }) => {
	await openHistory(page, '/standings?season=2025&round=11');

	const rows = page.getByTestId('standings-row');

	// The first visit compiles the page and loads the season in the dev server.
	await expect(rows.nth(0)).toContainText('PIA', { timeout: 15_000 });
	await expect(rows.nth(0)).toContainText('216');
	await expect(rows.nth(1)).toContainText('NOR');
	await expect(rows.nth(1)).toContainText('201');
	await expect(page.getByTestId('live-strip')).toHaveCount(0);

	// At 1440 px the podium sits beside the table instead of leaving the right half empty.
	const table = await rows.nth(0).boundingBox();
	const podium = await page.getByTestId('round-podium').boundingBox();

	expect(podium && table && podium.x >= table.x + table.width).toBe(true);
	expect(podium && table && podium.y < table.y + table.height).toBe(true);
});

test('a driver page sums up every season and links each weekend to its session', async ({
	page
}) => {
	await openHistory(page, '/drivers/lando-norris');

	await expect(page.getByTestId('driver-page').getByRole('heading', { level: 1 })).toHaveText(
		'Lando Norris',
		{ timeout: 15_000 }
	);
	await expect(page.getByTestId('driver-seasons').getByRole('row')).not.toHaveCount(1);
	await expect(page.getByTestId('driver-teammates')).toContainText('Oscar Piastri');
	await expect(page.getByTestId('live-strip')).toHaveCount(0);

	const link = page.getByTestId('driver-weekends').getByRole('link').first();

	await expect(link).toHaveAttribute('href', /session=\d+/);
});
