import { expect, test } from '@playwright/test';

import { openRace } from './fixtures.ts';

test('a race opens on the Race layout, with the session in the strip', async ({ page }) => {
	await openRace(page);

	const nav = page.getByRole('navigation', { name: 'Main' });

	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Race');
	await expect(nav.getByRole('link').first()).toHaveText('Race');
	await expect(nav.getByRole('link', { name: 'Race', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(page.getByTestId('dashboard-live')).toBeVisible();

	const strip = page.getByTestId('live-strip');

	await expect(strip.getByTestId('live-key')).toHaveText('Replay');
	await expect(strip.getByTestId('strip-session')).toContainText('Las Vegas GP');
	await expect(strip.getByTestId('lap-counter')).toHaveText('Lap 30/50');
	await expect(strip.getByTestId('strip-leader')).toContainText('VER');
	await expect(page.getByTestId(/^timing-row-/)).toHaveCount(20);
	await expect(page.getByTestId('tile-stints')).toBeVisible();
	await expect(page.getByTestId('tile-away')).toHaveCount(0);
});

test('the dashboards a race does not need wait under More', async ({ page }) => {
	await openRace(page);

	await page.getByRole('button', { name: 'More' }).click();
	await page.getByRole('menuitem', { name: 'Pit wall' }).click();
	await expect(page).toHaveURL(/\/d\/wall/);
	await expect(page.getByTestId('dashboard-wall')).toBeVisible();
	await expect(page.getByRole('button', { name: 'More' })).toBeVisible();
});

test('keeps lap, driver and plan when switching pages', async ({ page }) => {
	await openRace(page, '/?lap=12&driver=1&plan=pro');

	await page
		.getByRole('navigation', { name: 'Main' })
		.getByRole('link', { name: 'Analysis' })
		.click();
	await expect(page).toHaveURL(/\/analysis\?/);
	await expect(page.getByTestId('chart-lapTime')).toBeVisible();

	await page
		.getByRole('navigation', { name: 'Main' })
		.getByRole('link', { name: 'Strategy' })
		.click();
	await expect(page.getByTestId('stint-timeline')).toBeVisible();

	const url = new URL(page.url());
	expect(url.searchParams.get('lap')).toBe('12');
	expect(url.searchParams.get('driver')).toBe('1');
	expect(url.searchParams.get('plan')).toBe('pro');
});

test('has no console errors on any page', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') {
			errors.push(message.text());
		}
	});

	await openRace(page, '/');
	await openRace(page, '/analysis');
	await openRace(page, '/strategy');
	await openRace(page, '/d/story');

	expect(errors).toEqual([]);
});
