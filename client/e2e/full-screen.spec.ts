import { expect, type Locator } from '@playwright/test';

import { openRace, test } from './fixtures.ts';

/** A locator's box on screen; fails the test when it is not drawn. */
async function box(locator: Locator) {
	const found = await locator.boundingBox();

	if (!found) {
		throw new Error('expected the element to be on screen');
	}

	return found;
}

const DASHBOARDS = [
	'/session',
	'/strategy',
	'/analysis',
	'/d/battle',
	'/d/track',
	'/d/drivers',
	'/d/wall',
	'/d/story'
];

const DESKTOPS = [
	{ width: 1280, height: 720 },
	{ width: 1512, height: 860 },
	{ width: 1440, height: 900 },
	{ width: 1920, height: 1080 }
];

// A session dashboard is one screen on a laptop or a desktop: what does not fit is on another tab.
for (const size of DESKTOPS) {
	test(`no session dashboard scrolls the page at ${size.width}x${size.height}`, async ({
		page
	}) => {
		await page.setViewportSize(size);

		for (const path of DASHBOARDS) {
			// oxlint-disable-next-line no-await-in-loop -- one page after another, each measured once.
			await openRace(page, path);
			// oxlint-disable-next-line no-await-in-loop -- as above.
			await expect(page.getByTestId('dashboard-grid')).toBeVisible();

			// oxlint-disable-next-line no-await-in-loop -- as above.
			const scroll = await page.evaluate(
				() => document.documentElement.scrollHeight - window.innerHeight
			);

			expect(scroll, `${path} scrolls the page`).toBeLessThanOrEqual(0);
		}
	});
}

test('F and the bar control enter and leave full screen; the bar hides and comes back', async ({
	page
}) => {
	await page.setViewportSize({ width: 1512, height: 860 });
	await openRace(page, '/session');

	const bar = page.getByTestId('app-bar');
	const grid = page.getByTestId('dashboard-grid');
	const before = await box(grid);

	await page.keyboard.press('f');
	await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
	await expect(bar).toHaveAttribute('data-hidden', '');
	await expect.poll(async () => (await box(grid)).height).toBeGreaterThan(before.height);

	// The pointer at the top edge slides the bar back; moving away hides it again.
	await page.mouse.move(400, 300);
	await page.mouse.move(400, 2);
	await expect(bar).not.toHaveAttribute('data-hidden', '');
	await page.mouse.move(400, 400);
	await expect(bar).toHaveAttribute('data-hidden', '');

	// Without a pointer a key shows it.
	await page.keyboard.press('b');
	await expect(bar).not.toHaveAttribute('data-hidden', '');
	await page.keyboard.press('b');
	await expect(bar).toHaveAttribute('data-hidden', '');

	// Tabbing into the hidden bar brings it on screen, so focus is never on a control nobody sees.
	await page.keyboard.press('Tab');
	await expect(bar.locator(':focus')).toHaveCount(1);
	await expect.poll(async () => (await box(bar)).y).toBeGreaterThanOrEqual(0);

	// The bar floats over the tiles: bringing it back must not make the page scroll.
	const scroll = await page.evaluate(() => ({
		overflow: document.documentElement.scrollHeight - window.innerHeight,
		top: window.scrollY
	}));

	expect(scroll).toEqual({ overflow: 0, top: 0 });

	await page.keyboard.press('f');
	await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(false);
	await expect(bar).not.toHaveAttribute('data-hidden', '');

	await page.getByTestId('fullscreen-toggle').click();
	await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
	await page.evaluate(() => document.exitFullscreen());
	await expect(bar).not.toHaveAttribute('data-hidden', '');
});

test('Tab after F brings the bar back without making the page scroll', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await openRace(page, '/session');
	await page.keyboard.press('f');
	await expect(page.getByTestId('app-bar')).toHaveAttribute('data-hidden', '');
	await page.keyboard.press('Tab');
	await expect(page.getByTestId('app-bar').locator(':focus')).toHaveCount(1);

	const scroll = await page.evaluate(() => ({
		overflow: document.documentElement.scrollHeight - window.innerHeight,
		top: window.scrollY
	}));

	expect(scroll).toEqual({ overflow: 0, top: 0 });
});

test('a tile resizes by its edge and collapses to its header, with no edit mode', async ({
	page
}) => {
	await page.setViewportSize({ width: 1512, height: 860 });
	await openRace(page, '/session');

	const fights = page.getByTestId('tile-fights');
	const before = await box(fights);

	// The corner handle appears under the pointer; dragging it changes the tile.
	await fights.hover();
	const handle = fights.locator('.react-resizable-handle-se');

	await expect(handle).toBeVisible();

	const grip = await box(handle);

	await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
	await page.mouse.down();
	await page.mouse.move(grip.x - 120, grip.y - 80, { steps: 6 });
	await page.mouse.up();
	await expect.poll(async () => (await box(fights)).height).toBeLessThan(before.height);

	// Collapsing leaves the header; expanding gives the height back.
	const control = page.getByTestId('tile-race-control');
	const full = await box(control);

	await control.getByTestId('tile-options').click();
	await page.getByTestId('tile-collapse').click();
	await expect.poll(async () => (await box(control)).height).toBeLessThan(full.height / 2);
	await control.getByTestId('tile-options').click();
	await page.getByTestId('tile-collapse').click();
	await expect.poll(async () => (await box(control)).height).toBeGreaterThan(full.height / 2);
});

test('a tile shows its collapse key and resize grip under the pointer and with focus, and the menu names resizing', async ({
	page
}) => {
	await page.setViewportSize({ width: 1512, height: 860 });
	await openRace(page, '/session');

	const fights = page.getByTestId('tile-fights');
	const key = fights.getByTestId('tile-collapse-key');
	const grip = fights.locator('.react-resizable-handle-se');

	await page.mouse.move(2, 2);
	await expect(key).toHaveCSS('opacity', '0');
	await expect(grip).toHaveCSS('opacity', '0');

	await fights.hover();
	await expect(key).toHaveCSS('opacity', '1');
	await expect(grip).toHaveCSS('opacity', '1');

	// The keyboard reaches the key, and focus alone shows it.
	await page.mouse.move(2, 2);
	await key.focus();
	await expect(key).toHaveCSS('opacity', '1');
	await expect(grip).toHaveCSS('opacity', '1');

	const before = await box(fights);

	await key.click();
	await expect.poll(async () => (await box(fights)).height).toBeLessThan(before.height / 2);
	await key.click();
	await expect.poll(async () => (await box(fights)).height).toBeGreaterThan(before.height / 2);

	await fights.getByTestId('tile-options').click();
	await expect(page.getByRole('menu')).toContainText('dragging its bottom right corner');
});
