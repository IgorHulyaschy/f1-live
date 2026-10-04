import { mkdir, writeFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

/**
 * Layout audit on real data: every ready-made dashboard at seven screen sizes, dark and light. Each
 * shot is the first screen, as a viewer sees it on opening; next to it a JSON file records the
 * height of everything above the tiles, the tiles' share of the window and each tile's size.
 * Output goes to shots/output/layout/<size>/ and is not committed.
 */

const SIZES = [
	{ width: 390, height: 844 },
	{ width: 768, height: 1024 },
	{ width: 1280, height: 800 },
	{ width: 1440, height: 900 },
	{ width: 1920, height: 1080 },
	{ width: 2560, height: 1440 },
	{ width: 3440, height: 1440 }
] as const;

const DASHBOARDS = [
	{ name: 'race', path: '/session?session=9858&lap=30' },
	{ name: 'quali', path: '/session?session=11373&lap=20' },
	{ name: 'practice', path: '/session?session=9852' },
	{ name: 'analysis', path: '/analysis?session=9858&lap=30' },
	{ name: 'strategy', path: '/strategy?session=9858&lap=30' },
	{ name: 'battle', path: '/d/battle?session=9858&lap=30' },
	{ name: 'track', path: '/d/track?session=9858&lap=30' },
	{ name: 'drivers', path: '/d/drivers?session=9858&lap=30' },
	{ name: 'wall', path: '/d/wall?session=9858&lap=30' },
	{ name: 'story', path: '/d/story?session=9858&lap=30' }
] as const;

const THEMES = ['dark', 'light'] as const;

for (const size of SIZES) {
	const folder = `shots/output/layout/${size.width}x${size.height}`;

	test.describe(`${size.width}x${size.height}`, () => {
		test.use({ viewport: size });

		for (const dashboard of DASHBOARDS) {
			for (const theme of THEMES) {
				test(`${dashboard.name} ${theme}`, async ({ page }) => {
					await page.route('https://media.formula1.com/**', (route) => route.abort());
					await page.addInitScript((dark) => {
						window.localStorage.setItem('pitwall-welcomed', 'true');
						window.localStorage.setItem('pitwall-spoiler-free', 'false');
						window.localStorage.setItem('pitwall-theme', dark ? 'dark' : 'light');
					}, theme === 'dark');
					await page.goto(`${dashboard.path}&plan=pro`);
					await expect(page.getByTestId('lap-counter')).toBeAttached();
					await page.evaluate(() => document.fonts.ready);
					await page.waitForTimeout(1200);

					if (theme === 'dark') {
						const metrics = await page.evaluate(() => {
							const grid = document.querySelector(
								'[data-testid=dashboard-grid], [data-testid=dashboard-stack]'
							);

							const box = grid?.getBoundingClientRect();
							const viewport = window.innerHeight;
							const bar = document.querySelector('header')?.getBoundingClientRect();

							const tiles = [...document.querySelectorAll<HTMLElement>('[data-tile-id]')].map(
								(tile) => {
									const rect = tile.getBoundingClientRect();

									return {
										kind: tile.dataset.testid?.replace(/^tile-/, ''),
										width: Math.round(rect.width),
										height: Math.round(rect.height),
										top: Math.round(rect.top),
										inView: rect.bottom <= viewport + 1
									};
								}
							);

							return {
								mode: grid?.getAttribute('data-testid'),
								chrome: Math.round(box?.top ?? 0),
								bar: Math.round(bar?.height ?? 0),
								// The grid ends inside the window; the legal footer below it may still scroll.
								gridFits: box ? box.bottom <= viewport + 1 : false,
								gridHeight: Math.round(box?.height ?? 0),
								tilesShare: box
									? Math.round(((Math.min(box.bottom, viewport) - box.top) / viewport) * 1000) / 10
									: 0,
								pageScroll: document.documentElement.scrollHeight - viewport,
								sideScroll: document.documentElement.scrollWidth - window.innerWidth,
								rootFont: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
								tiles
							};
						});

						await mkdir(folder, { recursive: true });
						await writeFile(
							`${folder}/${dashboard.name}.json`,
							JSON.stringify({ size, dashboard: dashboard.name, ...metrics }, null, 2)
						);
					}

					await page.screenshot({
						path: `${folder}/${dashboard.name}-${theme}.png`,
						animations: 'disabled'
					});
				});
			}
		}
	});
}
