import type { Dashboard } from '@f1-live/shared/dashboard';
import { expect, test } from '@playwright/test';

import { openRace } from '../fixtures.ts';
import { replaying } from './replay.ts';

test.describe('a live race', () => {
	// The trimmed 2025 Las Vegas race the server's own tests use, the start and two laps: the race
	// starts about 23 s after the replay does, and the session ends 32 s later.
	replaying('2025-las-vegas-race', 150);

	test('toasts the race’s flags, its start and the followed driver’s stop as they happen', async ({
		page
	}) => {
		test.setTimeout(60_000);

		// At this speed a burst of events lands in one update, and a burst shows its latest few.
		await openRace(page, '/session?driver=22');

		const toast = page
			.locator('[data-sonner-toast]')
			.filter({
				hasText:
					/Race has started|Yellow flag|Track clear|Virtual safety car|Green flag|is in the pits/
			})
			.first();

		await expect(toast).toBeVisible({ timeout: 45_000 });

		// Toasts keep off the transport and the scrubber.
		const replay = page.getByTestId('tile-replay');

		const [over, ...controls] = await Promise.all(
			[toast, replay.getByTestId('live-key'), replay.getByTestId('timeline')].map((box) =>
				box.boundingBox()
			)
		);

		expect(over).not.toBeNull();

		for (const control of controls) {
			if (!over || !control) {
				throw new Error('The toast and the controls are on screen');
			}

			expect(
				over.x + over.width <= control.x ||
					control.x + control.width <= over.x ||
					over.y + over.height <= control.y ||
					control.y + control.height <= over.y
			).toBe(true);
		}
	});

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

	test('shows one live key on a phone, in the bar, over a stack that heads with the transport', async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await openRace(page, '/d/track');

		await expect(page.getByTestId('dashboard-stack')).toBeVisible();
		await expect(page.getByTestId('live-key')).toHaveCount(1);
		await expect(page.getByTestId('live-strip').getByTestId('live-key')).toHaveText('Live');
		await expect(
			page.getByTestId('dashboard-stack').getByRole('button', { name: 'Pause live' })
		).toBeVisible();
	});

	test('keeps the live key, play and the scrubber in place when leaving live and returning', async ({
		page
	}) => {
		await openRace(page, '/session');

		const replay = page.getByTestId('tile-replay');
		const live = replay.getByTestId('live-key');
		const play = replay.getByRole('button', { name: /^(Pause live|Play replay)$/ });

		await expect(live).toHaveText('Live');

		const controls = [
			live,
			play,
			replay.getByRole('button', { name: 'Previous lap' }),
			replay.getByTestId('speed'),
			replay.getByTestId('timeline'),
			page.getByTestId('strip-session')
		];

		const boxes = () => Promise.all(controls.map((control) => control.boundingBox()));
		const atLive = await boxes();

		// Pausing holds the lap; the same key, in the same place, goes back.
		await play.click();
		await expect(live).toHaveText('Go live');
		await expect(play).toHaveAccessibleName('Play replay');
		expect(await boxes()).toEqual(atLive);

		await live.click();
		await expect(live).toHaveText('Live');
		expect(await boxes()).toEqual(atLive);

		// Space pauses live too, with the lit live key still focused, and plays back into it.
		await expect(live).toBeFocused();
		await page.keyboard.press(' ');
		await expect(live).toHaveText('Go live');
		expect(await boxes()).toEqual(atLive);
		await page.keyboard.press(' ');
		await expect(live).toHaveText('Live');
		expect(await boxes()).toEqual(atLive);
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

		// Five seconds behind, the delayed screen has not seen the second lap yet.
		await expect(delayed.getByTestId('lap-counter')).not.toHaveText('Lap 2/50');
		await expect(delayed.getByTestId('lap-counter')).toHaveText('Lap 2/50', { timeout: 10_000 });

		await page.getByRole('button', { name: 'Previous lap' }).click();
		await expect(page.getByTestId('lap-counter')).toHaveText('Lap 1/50');
		await expect(page).toHaveURL(/lap=1/);

		await page.getByRole('button', { name: 'Go live' }).click();
		await expect(page.getByTestId('live-key')).toHaveText('Live');
		await expect(page.getByTestId('lap-counter')).toHaveText('Lap 2/50');
		await expect(page).not.toHaveURL(/lap=/);

		// L goes back to live from the keyboard too.
		await page.keyboard.press('ArrowLeft');
		await expect(page.getByTestId('live-key')).toHaveText('Go live');
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

		await expect(page.getByTestId('live-key')).toHaveText('Live');
		await expect(page.getByTestId('dashboard-quali')).toBeVisible();
		await expect(nav.getByRole('link').first()).toHaveText('Quali');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quali');

		// No race tools: strategy, pit windows and battles are not on the screen at all.
		await expect(page.getByTestId('tile-stints')).toHaveCount(0);
		await expect(page.getByTestId('tile-away')).toHaveCount(0);

		await expect(strip.getByTestId('strip-part')).toHaveText('Q1', { timeout: 30_000 });
		await expect(strip.getByTestId('strip-time')).toContainText(/Q1 left\s*1?\d:\d\d/);

		// At the end of the replay six of the 22 have no time and would go out.
		await expect(page.getByTestId('drop-zone')).toContainText('STR', { timeout: 30_000 });
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
		await expect(elsewhere).toHaveAccessibleName(/^Watch live.*Azerbaijan Qualifying$/);
		await elsewhere.click();

		await expect(page).toHaveURL(/session=11373/);
		await expect(page.getByTestId('live-key')).toHaveText('Live');
		await expect(page.getByTestId('dashboard-quali')).toBeVisible();
	});
});
