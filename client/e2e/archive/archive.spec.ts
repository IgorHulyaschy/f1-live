import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startTestArchive, type TestArchive } from '@f1-live/shared/test-archive';
import { expect, type Locator, test } from '@playwright/test';

import { ARCHIVE_APP_PORT, ARCHIVE_PORT } from '../../playwright.real.config.ts';
import { openRace } from '../fixtures.ts';
import { RACE_KEY, RACE_PATH } from './race.ts';

// The start and first two laps of the 2019 Austrian race, imported without positions; the stand-in
// archive holds them (derive-fixture.ts).

const server = fileURLToPath(new URL('../../../server', import.meta.url));

const here = path.dirname(fileURLToPath(import.meta.url));

const health = `http://127.0.0.1:${ARCHIVE_PORT}/health`;

async function answers(url: string): Promise<boolean> {
	return fetch(url, { signal: AbortSignal.timeout(1000) }).then(
		(response) => response.ok,
		() => false
	);
}

async function picture(map: Locator): Promise<Buffer> {
	return map.locator('canvas').first().screenshot();
}

let archive: TestArchive;

let child: ChildProcess | null = null;

let dataDir: string;

test.beforeAll(async () => {
	if (await answers(health)) {
		throw new Error(`Something already serves ${health}`);
	}

	// The server writes the fetched session into its data folder: a copy, so the fixture stays.
	dataDir = mkdtempSync(path.join(tmpdir(), 'archive-e2e-'));
	cpSync(path.join(here, 'data'), dataDir, { recursive: true });

	const positions = `${RACE_PATH}/Position.z.jsonStream`;

	archive = await startTestArchive(
		new Map([[positions, readFileSync(path.join(here, 'archive', positions))]])
	);
	archive.hold();

	// Node with the tsx loader, leading its own process group, so the whole tree stops together.
	child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
		cwd: server,
		stdio: 'inherit',
		detached: true,
		env: {
			...process.env,
			MODE: 'relay',
			RELAY_SECRET: 'e2e-only-relay-secret',
			HOST: '127.0.0.1',
			PORT: String(ARCHIVE_PORT),
			DATA_DIR: dataDir,
			ARCHIVE_URL: archive.url,
			// The test's few kilobytes never trouble the disk; the floor's own tests are the server's.
			DISK_FLOOR_GB: '0',
			CORS_ORIGINS: `http://localhost:${ARCHIVE_APP_PORT}`,
			LOG_LEVEL: 'warn'
		}
	});

	await expect.poll(() => answers(health), { timeout: 20_000 }).toBe(true);
});

test.afterAll(async () => {
	if (child?.pid !== undefined && child.exitCode === null && child.signalCode === null) {
		process.kill(-child.pid, 'SIGTERM');
		await once(child, 'exit');
	}

	await archive.close();
	rmSync(dataDir, { recursive: true, force: true });
});

test('a 2019 race replays its timing at once, then the map once the archive sent the positions', async ({
	page
}) => {
	await openRace(page, `/d/track?session=${RACE_KEY}&lap=2`);

	const map = page.getByTestId('track-map');

	// The timing replay runs while the archive holds the positions back.
	await expect(page.getByTestId('lap-counter')).toHaveText('Lap 2/71');
	await expect(map.getByTestId('map-fetch')).toContainText(
		'Fetching car positions from the archive'
	);

	archive.release();

	await expect(map.getByText('Replay', { exact: true })).toBeVisible({ timeout: 30_000 });
	await expect(map.getByTestId('map-fetch')).toHaveCount(0);
	await expect(map.getByTestId('map-car-list').getByRole('listitem')).toHaveCount(20);
	expect(archive.requests).toEqual([
		`${RACE_PATH}/Position.z.jsonStream`,
		`${RACE_PATH}/CarData.z.jsonStream`
	]);

	const paused = await picture(map);

	await page.getByRole('button', { name: 'Play replay' }).click();
	await expect.poll(async () => (await picture(map)).equals(paused)).toBe(false);
});
