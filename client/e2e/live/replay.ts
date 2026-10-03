import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

import { test } from '@playwright/test';

import { FIXTURE_DATA_DIR, LIVE_PORT } from '../../playwright.real.config.ts';

const server = fileURLToPath(new URL('../../../server', import.meta.url));

function fixture(name: string): string {
	return fileURLToPath(new URL(`../../../server/src/sources/f1/fixtures/${name}`, import.meta.url));
}

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

/** Replays a saved session through the live path on the live port, as a running session would. */
export function replaying(name: string, speed: number): void {
	let replay: ChildProcess | null = null;

	test.beforeAll(async () => {
		replay = spawn(
			'npx',
			['tsx', 'src/cli/replay-live.ts', '--dir', fixture(name), '--speed', String(speed)],
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

	// The next replay takes the same port, so wait for this one to let it go.
	test.afterAll(async () => {
		if (replay && replay.exitCode === null) {
			replay.kill();
			await once(replay, 'exit');
		}
	});
}
