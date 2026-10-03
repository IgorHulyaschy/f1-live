import { expect, test } from '@playwright/test';

import { openRace, seriousViolations } from './fixtures.ts';

const RACE_ROUTES = [
	'/session',
	// Lap 16 runs under the virtual safety car: the flag banner and yellow badges are up.
	'/session?lap=16',
	'/analysis',
	'/strategy',
	'/d/battle',
	'/d/drivers',
	'/d/wall',
	'/d/battle?edit=1',
	'/library',
	'/library/example-tv-wall',
	'/welcome',
	// The driver, lap and compare views, open beside the dashboard.
	'/session?lap=30&car=4',
	'/session?lap=30&car=4&carLap=12',
	'/session?lap=30&car=4&vs=81'
] as const;

const SITE_ROUTES = ['/legal/terms', '/legal/privacy', '/legal/cookies', '/no-such-page'] as const;

for (const theme of ['dark', 'light'] as const) {
	test.describe(`${theme} theme`, () => {
		test.beforeEach(async ({ page }) => {
			await page.addInitScript(
				(saved) => window.localStorage.setItem('pitwall-theme', saved),
				theme
			);
		});

		for (const path of RACE_ROUTES) {
			test(path, async ({ page }) => {
				await openRace(page, path);

				expect(await seriousViolations(page)).toEqual([]);
			});
		}

		test('a session with its results hidden', async ({ page }) => {
			await openRace(page, '/session', { spoilerProtection: true });
			await expect(page.getByTestId('spoiler-start')).toBeVisible();

			expect(await seriousViolations(page)).toEqual([]);
		});

		for (const path of SITE_ROUTES) {
			test(path, async ({ page }) => {
				await page.goto(path);
				await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

				expect(await seriousViolations(page)).toEqual([]);
			});
		}
	});
}
