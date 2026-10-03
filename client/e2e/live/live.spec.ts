import type { Dashboard } from '@f1-live/shared/dashboard';
import { expect, test } from '@playwright/test';

import { openRace } from '../fixtures.ts';
import { replaying } from './replay.ts';

test.describe('a live race', () => {
	// The trimmed 2025 Las Vegas race the server's own tests use, the start and two laps: the race
	// starts about 23 s after the replay does, and the session ends 32 s later.
	replaying('2025-las-vegas-race', 150);

	test('without car positions estimates the map from timing, and says why', async ({ page }) => {
		await openRace(page, '/d/track');

		await expect(page.getByTestId('live-key')).toHaveText('Live');

		const map = page.getByTestId('track-map');

		await expect(map.getByText('Estimated', { exact: true })).toBeVisible();
		await expect(map.getByTestId('map-note')).toContainText(
			'live car positions need an F1 TV login'
		);
		await expect(map.getByTestId('map-car-list').getByRole('listitem')).not.toHaveCount(0);
	});

	test('updates the tower, steps back and returns, and runs behind with a delay', async ({
		page,
		browser
	}) => {
		test.setTimeout(90_000);

		await openRace(page, '/session');

		// Opening the app during a live session goes to it.
		await expect(page.getByTestId('live-key')).toHaveText('Live');
		await expect(page.getByTestId('dashboard-live')).toBeVisible();

		const delayedContext = await browser.newContext();
		const delayed = await delayedContext.newPage();

		await openRace(delayed, '/session');

		for (let second = 0; second < 5; second++) {
			await delayed.getByRole('button', { name: 'One second more delay' }).click();
		}

		await expect(delayed.getByTestId('delay')).toHaveText('5.0s');

		// The start: the grid order, then the order on track once the leader completes laps.
		await expect(page.getByTestId('lap-counter')).toHaveText('Lap 2/50', { timeout: 60_000 });
		await expect(page.getByTestId(/^timing-row-/).first()).toHaveAttribute(
			'data-testid',
			'timing-row-VER'
		);
		await expect(page.getByTestId('strip-leader')).toContainText('VER');

		// Five seconds behind, the delayed screen has not seen the second lap yet.
		await expect(delayed.getByTestId('lap-counter')).not.toHaveText('Lap 2/50');
		await expect(delayed.getByTestId('lap-counter')).toHaveText('Lap 2/50', { timeout: 10_000 });

		await page.getByRole('button', { name: 'Previous lap' }).click();
		await expect(page.getByTestId('lap-counter')).toHaveText('Lap 1/50');
		await expect(page).toHaveURL(/lap=1/);

		await page.getByRole('button', { name: 'Back to live' }).click();
		await expect(page.getByTestId('live-key')).toHaveText('Live');
		await expect(page.getByTestId('lap-counter')).toHaveText('Lap 2/50');
		await expect(page).not.toHaveURL(/lap=/);

		// L goes back to live from the keyboard too.
		await page.keyboard.press('ArrowLeft');
		await expect(page.getByTestId('live-key')).toHaveText('Back to live');
		await page.keyboard.press('l');
		await expect(page.getByTestId('live-key')).toHaveText('Live');

		await delayedContext.close();
	});
});

test.describe('a live qualifying session', () => {
	// 2026 Baku qualifying from the pit lane opening to seven minutes into Q1, cut to the decoder's
	// topics, with the speed traps as first published and without the mini-sector segments. Q1
	// starts about 7 s after the replay does; the replay ends 3 s later, with Q1 still running.
	replaying('2026-baku-qualifying', 150);

	/** The viewer's own race dashboard: the order, the pit window and the stints. */
	const raceEngineer: Dashboard = {
		id: 'board-mine',
		name: 'Race engineer',
		tiles: [
			{ id: 'a', kind: 'timing' },
			{ id: 'b', kind: 'box-now' },
			{ id: 'c', kind: 'stints' }
		],
		layout: [
			{ i: 'a', x: 0, y: 0, w: 14, h: 24 },
			{ i: 'b', x: 14, y: 0, w: 10, h: 8 },
			{ i: 'c', x: 14, y: 8, w: 10, h: 16 }
		]
	};

	test('opens on the Quali layout, with the part, the time left and the drop zone', async ({
		page
	}) => {
		test.setTimeout(60_000);

		await openRace(page, '/session');

		const nav = page.getByRole('navigation', { name: 'Main' });
		const strip = page.getByTestId('live-strip');

		await expect(strip.getByTestId('live-key')).toHaveText('Live');
		await expect(page.getByTestId('dashboard-quali')).toBeVisible();
		await expect(nav.getByRole('link').first()).toHaveText('Quali');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quali');

		// No race tools: strategy, pit windows and battles are not on the screen at all.
		await expect(page.getByTestId('tile-stints')).toHaveCount(0);
		await expect(page.getByTestId('tile-away')).toHaveCount(0);

		await expect(strip.getByTestId('strip-part')).toHaveText('Q1', { timeout: 30_000 });
		await expect(strip.getByTestId('strip-time')).toContainText(/Q1 left\s*1?\d:\d\d/);

		// At the end of the replay six of the 22 have no time and would go out.
		const dropZone = strip.getByTestId('strip-drop-zone');

		await expect(dropZone).toContainText('Q1 drop zone');
		await expect(dropZone).toContainText('STR', { timeout: 30_000 });
		await expect(page.getByTestId(/^timing-row-/).first()).toHaveAttribute(
			'data-testid',
			'timing-row-HAD'
		);
		await expect(page.locator('[data-drop-zone]')).toHaveCount(6);
		await expect(page.getByTestId('drop-zone').getByRole('row')).toHaveCount(7);
	});

	test('leaves a dashboard of the viewer’s own as it is, and offers the Quali layout', async ({
		page
	}) => {
		// Only on the first load: a reload must find what the page itself saved.
		await page.addInitScript(
			(saved) => {
				if (window.localStorage.getItem('pitwall-dashboards') === null) {
					window.localStorage.setItem('pitwall-dashboards', saved);
				}
			},
			JSON.stringify([raceEngineer])
		);
		await openRace(page, '/d/board-mine');

		const offer = page.getByTestId('session-offer');

		await expect(offer).toContainText('Race engineer has tiles for other sessions');
		await expect(page.getByTestId('tile-timing')).toBeVisible();
		await expect(page.getByTestId('tile-away')).toHaveCount(2);
		await expect(page.getByTestId('tile-away').first()).toContainText('Races only');

		await offer.getByRole('button', { name: 'Switch to the Quali layout' }).click();
		await expect(page).toHaveURL(/\/session(\?|$)/);
		await expect(page.getByTestId('dashboard-quali')).toBeVisible();

		await page.goBack();
		await page
			.getByTestId('session-offer')
			.getByRole('button', { name: 'Don’t ask again' })
			.click();
		await expect(page.getByTestId('session-offer')).toHaveCount(0);

		await page.reload();
		await expect(page.getByTestId('tile-timing')).toBeVisible();
		await expect(page.getByTestId('session-offer')).toHaveCount(0);

		// Only the answer is kept: the tiles and their places are as the viewer left them.
		const saved = await page.evaluate(() => window.localStorage.getItem('pitwall-dashboards'));

		expect(JSON.parse(saved ?? '[]')).toEqual([{ ...raceEngineer, sessionOffer: false }]);
	});

	test('points a viewer on another session to the live one', async ({ page }) => {
		await openRace(page, '/session?session=9858');

		const elsewhere = page.getByTestId('strip-live-elsewhere');

		await expect(page.getByTestId('live-key')).toHaveText('Replay');
		await expect(elsewhere).toContainText('Azerbaijan Qualifying');
		await elsewhere.getByRole('button', { name: 'Watch live' }).click();

		await expect(page).toHaveURL(/session=11373/);
		await expect(page.getByTestId('live-key')).toHaveText('Live');
		await expect(page.getByTestId('dashboard-quali')).toBeVisible();
	});
});
