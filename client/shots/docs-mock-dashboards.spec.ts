import { expect, type Page, test } from '@playwright/test';

import { fromMenu } from '../e2e/fixtures.ts';
import { docShot, openDocs, settle } from './docs.ts';

/**
 * The dashboard tour: a ready-made dashboard, edit mode, Add tile, a dashboard of your own,
 * three screen sizes, Share and the library. Mock replay at lap 30; docs/tour/dashboards/.
 */

const AREA = 'dashboards';

const NOW = '2026-05-10T12:00:00Z';

/** Opens a dashboard of the mock replay and waits until the race and its first chart are drawn. */
async function openAt30(
	page: Page,
	route: string,
	options: { theme?: 'dark' | 'light'; lap?: boolean } = {}
): Promise<void> {
	await openDocs(page, route, { theme: options.theme, now: NOW });
	await expect(page.getByTestId('app-menu')).toBeVisible();

	// Pages beside a session show the lap; the library does not.
	if (options.lap ?? true) {
		await expect(page.getByTestId('lap-counter').first()).toHaveText('Lap 30/50');
	}

	await parkPointer(page);
}

/** A tile or chart answers the pointer with a tooltip; park it where nothing does. */
async function parkPointer(page: Page): Promise<void> {
	await page.mouse.move(2, 2);
}

/** The box around every tile of the dashboard, with the bar of the top row above it. */
async function gridBox(
	page: Page
): Promise<{ x: number; y: number; width: number; height: number }> {
	const box = await page.getByTestId('dashboard-grid').boundingBox();

	if (!box) {
		throw new Error('The dashboard grid is not on screen');
	}

	return { x: 0, y: 0, width: 1440, height: box.y + box.height };
}

test('a ready-made dashboard, Battle at lap 30', async ({ page }) => {
	await openAt30(page, '/d/battle?lap=30');
	await expect(page.getByTestId('chart-battle')).toBeVisible();
	await parkPointer(page);
	await docShot(page, AREA, 'battle-lap-30', undefined, 0, true);
});

test('the same dashboard in the light theme', async ({ page }) => {
	await openAt30(page, '/d/battle?lap=30', { theme: 'light' });
	await expect(page.getByTestId('chart-battle')).toBeVisible();
	await docShot(page, AREA, 'battle-lap-30-light', undefined, 0, true);
});

test('edit mode: a bar on every tile and resize handles', async ({ page }) => {
	// Tall, so the picture ends under a whole tile instead of through its rows.
	await page.setViewportSize({ width: 1440, height: 1500 });
	await openAt30(page, '/d/battle?lap=30&edit=1');
	await expect(page.getByTestId('dashboard-edit')).toBeVisible();
	await expect(page.getByRole('button', { name: /^Arrange / }).first()).toBeVisible();

	// A tile shows its resize handles under the pointer.
	const chart = page.locator('.react-grid-item').filter({
		has: page.getByRole('button', { name: /^Arrange Chart/ })
	});

	await chart.locator('.react-resizable-handle-se').hover();
	await docShot(page, AREA, 'edit-mode', await gridBox(page), 8, true);
});

test('Add tile: tiles in groups', async ({ page }) => {
	// The list scrolls in 60% of the height; a tall screen shows several groups at once.
	await page.setViewportSize({ width: 1440, height: 1500 });
	await openAt30(page, '/d/battle?lap=30&edit=1');
	await page.getByRole('button', { name: 'Add tile' }).click();

	const dialog = page.getByRole('dialog', { name: 'Add tile' });

	await expect(dialog.getByRole('heading', { name: 'Add tile' })).toBeVisible();

	// The dialog opens with a zoom; measure it where it stays.
	await settle(page);

	const box = await dialog.boundingBox();
	const list = dialog.locator('li');

	if (!box) {
		throw new Error('The dialog is not on screen');
	}

	// Cut the picture under the last row that is shown whole, so no text is cut in half.
	const scroller = await dialog.locator('div.overflow-y-auto').boundingBox();

	const rows = await list.evaluateAll((items) =>
		items.map((item) => {
			const { top, bottom } = item.getBoundingClientRect();

			return { top, bottom };
		})
	);

	const limit = (scroller?.y ?? 0) + (scroller?.height ?? 0);
	const last = Math.max(...rows.filter((row) => row.bottom <= limit).map((row) => row.bottom));

	await docShot(page, AREA, 'add-tile', {
		x: box.x - 24,
		y: box.y - 24,
		width: box.width + 48,
		height: last - box.y + 24 + 2
	});
});

test('a dashboard of your own: a copy of a ready-made one, changed', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 2000 });
	await openAt30(page, '/d/battle?lap=30');
	await fromMenu(page, 'Duplicate');
	await expect(page).toHaveURL(/\/d\/board-/);
	await expect(page.getByTestId('dashboard-edit')).toBeVisible();

	// Take a tile out, put another in, and name it.
	await page.getByRole('button', { name: 'Remove Box now' }).click();
	await page.getByRole('button', { name: 'Add tile' }).click();
	await page
		.getByRole('dialog', { name: 'Add tile' })
		.getByRole('button', { name: /^Weather/ })
		.click();

	const name = page.getByRole('textbox', { name: 'Dashboard name' });

	await name.fill('Race engineer');
	await name.blur();
	await expect(page.getByTestId('weather')).toBeVisible();
	await expect(page.getByTestId('save-status')).toHaveText('Saved in this browser');
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.locator('.react-grid-item').first().locator('.react-resizable-handle-se').hover();
	await docShot(page, AREA, 'own-dashboard', await gridBox(page), 8, true);
});

test('Share copies a link that carries the whole layout', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await openAt30(page, '/d/battle?lap=30');
	await fromMenu(page, 'Copy share link');

	const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'Link copied' });

	await expect(toast).toBeVisible();
	await docShot(page, AREA, 'share-link-copied', toast, 80);
});

test('the shared link, opened in another browser, is a preview', async ({
	page,
	browser,
	baseURL
}) => {
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	await openAt30(page, '/d/battle?lap=30');
	await fromMenu(page, 'Copy share link');

	const link = await page.evaluate(() => navigator.clipboard.readText());

	const other = await browser.newContext({
		baseURL,
		viewport: { width: 1440, height: 900 },
		reducedMotion: 'reduce'
	});

	const viewer = await other.newPage();

	await openDocs(viewer, link.replace(/^https?:\/\/[^/]+/, ''), { now: NOW });
	await expect(viewer.getByTestId('dashboard-preview')).toBeVisible();
	await expect(viewer.getByTestId('chart-battle')).toBeVisible();
	await expect(viewer.getByRole('button', { name: 'Add to my dashboards' })).toBeVisible();
	await docShot(viewer, AREA, 'shared-preview');
	await other.close();
});

test('the library: yours, ready-made and from fans, with layout thumbnails', async ({ page }) => {
	// Tall, so the three sections fit in one picture.
	await page.setViewportSize({ width: 1440, height: 2300 });
	await openAt30(page, '/library?lap=30', { lap: false });

	for (const name of ['Second screen', 'TV wall']) {
		await page
			.getByTestId('library-row')
			.filter({ hasText: name })
			.getByRole('button', { name: `Add ${name}` })
			.click();
		await expect(page).toHaveURL(/\/d\/board-/);
		await page.goto('/library?lap=30');
	}

	await expect(page.getByRole('region', { name: 'Yours' }).getByTestId('library-row')).toHaveCount(
		2
	);
	await expect(
		page.getByRole('region', { name: 'From fans' }).getByTestId('library-row')
	).not.toHaveCount(0);

	// Yours and the first ready-made rows, cut under a whole row.
	const ready = page.getByRole('region', { name: 'Ready-made' }).getByTestId('library-row');
	const third = await ready.nth(2).boundingBox();

	if (!third) {
		throw new Error('The ready-made list is not on screen');
	}

	await docShot(page, AREA, 'library', {
		x: 0,
		y: 0,
		width: 800,
		height: third.y + third.height + 8
	});

	// From fans: the heading, search and tags, and the first rows.
	const fans = page.getByRole('region', { name: 'From fans' });
	const head = await fans.boundingBox();
	const rows = fans.getByTestId('library-row');
	const lastRow = await rows.nth(Math.min(2, (await rows.count()) - 1)).boundingBox();

	if (!head || !lastRow) {
		throw new Error('From fans is not on screen');
	}

	await docShot(
		page,
		AREA,
		'library-from-fans',
		{ x: 0, y: head.y, width: 920, height: lastRow.y + lastRow.height - head.y + 8 },
		8
	);
});

test('the 2560 pit wall fills a big screen', async ({ page }) => {
	await page.setViewportSize({ width: 2560, height: 1440 });
	await openAt30(page, '/d/wall?lap=30');
	await expect(page.getByTestId('dashboard-grid')).toBeVisible();
	await expect(page.getByTestId('tile-timing')).toBeVisible();
	await expect(page.getByTestId('tile-track-map')).toBeVisible();
	await docShot(page, AREA, 'wall-2560');
});

test.describe('phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('tiles stack in one column', async ({ page }) => {
		await openAt30(page, '/d/battle?lap=30');
		await expect(page.getByTestId('dashboard-stack')).toBeVisible();
		await expect(page.getByTestId('pace-now')).toBeVisible();
		await docShot(page, AREA, 'battle-phone');
	});
});
