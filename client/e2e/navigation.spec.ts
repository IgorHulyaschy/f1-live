import { expect } from '@playwright/test';

import { openRace, test } from './fixtures.ts';

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
	await expect(page.getByTestId(/^timing-row-/)).toHaveCount(20);
	await expect(page.getByTestId('tile-track-map')).toBeVisible();
	await expect(page.getByTestId('tile-away')).toHaveCount(0);
});

test('the bar carries the session only where a session is on screen', async ({ page }) => {
	await openRace(page, '/library');
	await expect(page.getByTestId('live-strip')).toHaveCount(0);
	await expect(page.getByTestId('lap-counter')).toHaveCount(0);
	await expect(page.getByTestId('footer-keys')).not.toContainText('Space');

	await page.goto('/library/example-tv-wall?lap=30');
	await expect(page.getByTestId('live-strip').getByTestId('lap-counter')).toHaveText('Lap 30/50');
	await expect(page.getByTestId('footer-keys')).toContainText('Space');

	await page.goto('/account');
	await expect(page.getByTestId('app-menu')).toBeVisible();
	await expect(page.getByTestId('live-strip')).toHaveCount(0);
});

test('a phone’s bar keeps the finish key clear of Ask', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 800 });
	await openRace(page, '/analysis', { spoilerProtection: true });

	const finish = await page
		.getByTestId('live-strip')
		.getByRole('button', { name: 'Jump to the finish (shows results)' })
		.boundingBox();

	const ask = await page.getByTestId('ask-button').boundingBox();
	const menu = await page.getByTestId('app-menu').boundingBox();

	expect(finish && ask && finish.x + finish.width <= ask.x).toBe(true);
	expect(menu && menu.x + menu.width <= 360).toBe(true);
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
	await openRace(page, '/session?lap=12&driver=1&plan=pro');

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

	await openRace(page, '/session');
	await openRace(page, '/analysis');
	await openRace(page, '/strategy');
	await openRace(page, '/d/story');

	expect(errors).toEqual([]);
});

for (const width of [360, 390]) {
	test(`the bar fits one row at ${width}px, with every dashboard one tap away`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 800 });
		await openRace(page);

		const bar = await page.getByRole('banner').boundingBox();

		expect(bar?.height).toBeLessThanOrEqual(49);

		for (const key of [
			page.getByRole('button', { name: 'Dashboard: Race' }),
			page.getByTestId('strip-session'),
			page.getByTestId('ask-button'),
			page.getByTestId('app-menu')
		]) {
			// oxlint-disable-next-line no-await-in-loop -- four keys, each checked once.
			const box = await key.boundingBox();

			expect(box).not.toBeNull();
			expect(box?.x).toBeGreaterThanOrEqual(0);
			expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
		}

		await page.getByRole('button', { name: 'Dashboard: Race' }).click();
		await page.getByRole('menuitem', { name: 'Strategy' }).click();
		await expect(page).toHaveURL(/\/strategy/);
		await expect(page.getByRole('button', { name: 'Dashboard: Strategy' })).toBeVisible();
	});
}
