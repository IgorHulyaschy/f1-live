import { expect, test } from '@playwright/test';

import { expectFits, FIT_SIZES, openRace } from './fixtures.ts';

test.beforeEach(async ({ page }) => {
	await page.route('https://media.formula1.com/**', (route) => route.abort());
});

test('a first visit lands on the home and catches up in one click', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByTestId('home')).toBeVisible();
	await expect(page.getByTestId('home-championship')).toBeVisible();
	// The latest race is hidden: the table is the one going into it.
	await expect(page.getByText('Before this session')).toBeVisible();
	await expect(page.getByTestId('live-strip')).toHaveCount(0);

	await page.getByTestId('home-session-9858').getByRole('link', { name: 'Catch up' }).click();

	await expect(page).toHaveURL(/\/session\?session=9858$/);
	await expect(page.getByTestId('spoiler-start')).toBeVisible();
	await expect(page.getByTestId('lap-counter')).toBeVisible();
});

test('the home counts down to the next session', async ({ page }) => {
	await page.clock.setFixedTime(new Date('2025-11-22T04:00:00Z'));
	await page.goto('/');

	const next = page.getByTestId('home-next');

	await expect(next).toContainText('Las Vegas Race');
	await expect(page.getByTestId('home-countdown')).toHaveText('1 d 0 h');
});

test('the ask box opens the command menu', async ({ page }) => {
	await page.goto('/');
	await page.getByTestId('home-ask').click();

	await expect(page.getByRole('dialog')).toBeVisible();
	await expect(page.getByRole('combobox')).toBeFocused();
});

test('a returning viewer opens on the start page they chose', async ({ page }) => {
	await page.goto('/');
	await page.getByTestId('home-start-page').selectOption({ label: 'Analysis' });

	await page.goto('/');
	await expect(page).toHaveURL(/\/analysis$/);

	// The wordmark still leads home.
	await page.getByRole('link', { name: 'Pitwall home' }).click();
	await expect(page.getByTestId('home')).toBeVisible();
});

test('links from before the home open the session', async ({ page }) => {
	await openRace(page, '/?lap=12');

	await expect(page).toHaveURL(/\/session\?lap=12$/);
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 12/50');
});

test.describe('fits', () => {
	for (const size of FIT_SIZES) {
		test(`at ${size.width}×${size.height}`, async ({ page }) => {
			await page.setViewportSize(size);

			await page.goto('/');
			await expectFits(page, [page.getByTestId('home-ask')]);

			await openRace(page, '/session?lap=30');
			await expectFits(page, [
				page.getByTestId('live-strip'),
				page.getByRole('button', { name: 'Play replay' })
			]);

			await openRace(page, '/session?lap=30&car=4');
			const sheet = page.getByTestId('drill-sheet');

			await expect(sheet.getByRole('heading').first()).toBeVisible();
			await expectFits(page, [
				sheet.getByRole('heading').first(),
				sheet.getByRole('button', { name: 'Close' })
			]);
		});
	}
});
