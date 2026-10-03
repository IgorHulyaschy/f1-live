import { type ChildProcess, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { FIXTURE_DATA_DIR, LIVE_PORT } from '../../playwright.real.config.ts';
import { openRace } from '../fixtures.ts';

const server = fileURLToPath(new URL('../../../server', import.meta.url));

/** The trimmed 2025 Las Vegas race the server's own tests use: the start and two laps. */
const RACE = fileURLToPath(
	new URL('../../../server/src/sources/f1/fixtures/2025-las-vegas-race', import.meta.url)
);

/** The race starts about 23 s after the replay does, and the session ends 32 s later. */
const SPEED = 150;

let replay: ChildProcess | null = null;

async function waitForServer(url: string): Promise<void> {
	for (let attempt = 0; attempt < 100; attempt++) {
		const ok = await fetch(url).then(
			(response) => response.ok,
			() => false
		);

		if (ok) {
			return;
		}

		await new Promise((resolve) => setTimeout(resolve, 200));
	}

	throw new Error(`${url} did not come up`);
}

test.beforeAll(async () => {
	replay = spawn(
		'npx',
		['tsx', 'src/cli/replay-live.ts', '--dir', RACE, '--speed', String(SPEED)],
		{
			cwd: server,
			stdio: 'ignore',
			env: {
				...process.env,
				HOST: '127.0.0.1',
				PORT: String(LIVE_PORT),
				DATA_DIR: FIXTURE_DATA_DIR,
				CORS_ORIGINS: 'http://localhost:4175',
				LOG_LEVEL: 'warn'
			}
		}
	);
	await waitForServer(`http://127.0.0.1:${LIVE_PORT}/health`);
});

test.afterAll(() => {
	replay?.kill();
});

test('live without car positions estimates the map from timing, and says why', async ({ page }) => {
	await openRace(page, '/d/track');

	await expect(page.getByTestId('live-key')).toHaveText('Live');

	const map = page.getByTestId('track-map');

	await expect(map.getByText('Estimated', { exact: true })).toBeVisible();
	await expect(map.getByTestId('map-note')).toContainText('live car positions need an F1 TV login');
	await expect(map.getByTestId('map-car-list').getByRole('listitem')).not.toHaveCount(0);
});

test('a live race updates the tower, steps back and returns, and runs behind with a delay', async ({
	page,
	browser
}) => {
	test.setTimeout(90_000);

	await openRace(page, '/');

	// Opening the app during a live session goes to it.
	await expect(page.getByTestId('live-key')).toHaveText('Live');
	await expect(page.getByTestId('session')).toContainText('Live');

	const delayedContext = await browser.newContext();
	const delayed = await delayedContext.newPage();

	await openRace(delayed, '/');

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

	await page.getByRole('button', { name: 'Back to live' }).click();
	await expect(page.getByTestId('live-key')).toHaveText('Live');
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 2/50');
	await expect(page).not.toHaveURL(/lap=/);

	await delayedContext.close();
});
