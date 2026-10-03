import { expect, test } from '@playwright/test';

import { openRace } from './fixtures.ts';

test('loads the Las Vegas replay on the live page', async ({ page }) => {
	await openRace(page);

	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Live');
	await expect(page.getByRole('heading', { name: 'Las Vegas GP 2025' })).toBeVisible();
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 30/50');
	await expect(page.getByTestId(/^timing-row-/)).toHaveCount(20);
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

for (const width of [360, 390]) {
	test(`shows every dashboard tab and the new and library keys at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 800 });
		await openRace(page);

		const nav = page.getByRole('navigation', { name: 'Main' });

		const keys = [
			...(await nav.getByRole('link').all()),
			nav.getByRole('button', { name: 'New dashboard' })
		];

		for (const key of keys) {
			const box = await key.boundingBox();

			expect(box).not.toBeNull();
			expect(box?.x).toBeGreaterThanOrEqual(0);
			expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
		}
	});
}
