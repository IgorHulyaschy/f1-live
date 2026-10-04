import { expect, test } from '@playwright/test';

import { PRESETS } from '../../src/features/dashboard/dashboards.ts';
import { openRace } from '../fixtures.ts';

/** A phone, a tablet, laptops, desktops and an ultrawide. */
const SIZES = [
	{ width: 390, height: 844 },
	{ width: 768, height: 1024 },
	{ width: 1280, height: 800 },
	{ width: 1440, height: 900 },
	{ width: 1920, height: 1080 },
	{ width: 2560, height: 1440 },
	{ width: 3440, height: 1440 }
] as const;

/** Where each ready-made dashboard opens; the session layouts open on a session of their kind. */
const PATHS = new Map([
	['live', '/session?session=9858&lap=30'],
	['quali', '/session?session=11373&lap=20'],
	['practice', '/session?session=9852'],
	['analysis', '/analysis?session=9858&lap=30'],
	['strategy', '/strategy?session=9858&lap=30']
]);

/** Below this a tile shows too little to read; Replay is a one-line transport. */
const MIN_WIDTH = 180;

const MIN_HEIGHT = 120;

const MIN_REPLAY_HEIGHT = 80;

for (const size of SIZES) {
	test(`every ready-made dashboard shows all its tiles at a usable size at ${size.width}x${size.height}`, async ({
		page
	}) => {
		test.slow();
		await page.setViewportSize(size);

		for (const preset of PRESETS) {
			// oxlint-disable-next-line no-await-in-loop -- one dashboard at a time on one page.
			await openRace(
				page,
				`${PATHS.get(preset.id) ?? `/d/${preset.id}?session=9858&lap=30`}&plan=pro`
			);

			const tiles = page.locator('[data-tile-id]');

			// oxlint-disable-next-line no-await-in-loop -- as above.
			await expect(tiles, preset.name).toHaveCount(preset.tiles.length);

			// oxlint-disable-next-line no-await-in-loop -- as above.
			const boxes = await tiles.evaluateAll((elements) =>
				elements.map((element) => {
					const rect = element.getBoundingClientRect();

					return {
						kind: element.getAttribute('data-testid'),
						left: rect.left,
						right: rect.right,
						width: rect.width,
						height: rect.height
					};
				})
			);

			for (const box of boxes) {
				expect(box.left, `${preset.name}: ${box.kind}`).toBeGreaterThanOrEqual(0);
				expect(box.right, `${preset.name}: ${box.kind}`).toBeLessThanOrEqual(size.width);
				expect(box.width, `${preset.name}: ${box.kind}`).toBeGreaterThanOrEqual(MIN_WIDTH);
				expect(box.height, `${preset.name}: ${box.kind}`).toBeGreaterThanOrEqual(
					box.kind === 'tile-replay' ? MIN_REPLAY_HEIGHT : MIN_HEIGHT
				);
			}

			// oxlint-disable-next-line no-await-in-loop -- as above.
			const sideScroll = await page.evaluate(
				() => document.documentElement.scrollWidth - window.innerWidth
			);

			expect(sideScroll, preset.name).toBeLessThanOrEqual(0);
		}
	});
}

test('the Race layout fills a laptop screen under a slim bar, with no tile cut by the fold', async ({
	page
}) => {
	await openRace(page, '/session?session=9858&lap=30');

	const bar = await page.getByRole('banner').boundingBox();
	const tiles = await page.getByTestId('dashboard-grid').locator('[data-tile-id]').all();
	const boxes = await Promise.all(tiles.map((tile) => tile.boundingBox()));
	// Focus, Race control and Stints sit just below the fold; the tiles above it end inside it.
	const firstScreen = boxes.flatMap((box) => (box && box.y < 900 ? [box.y + box.height] : []));

	expect(bar?.height).toBeLessThanOrEqual(48);
	expect(firstScreen.length).toBeGreaterThanOrEqual(5);
	expect(Math.max(...firstScreen)).toBeLessThanOrEqual(900);
	expect(Math.max(...firstScreen)).toBeGreaterThanOrEqual(0.9 * 900);
});
