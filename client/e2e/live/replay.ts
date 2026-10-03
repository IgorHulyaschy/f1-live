import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

import { test } from '@playwright/test';

import { FIXTURE_DATA_DIR, LIVE_APP_PORT, LIVE_PORT } from '../../playwright.real.config.ts';

const server = fileURLToPath(new URL('../../../server', import.meta.url));

function fixture(name: string): string {
	return fileURLToPath(new URL(`../../../server/src/sources/f1/fixtures/${name}`, import.meta.url));
}

async function answers(url: string): Promise<boolean> {
	return fetch(url, { signal: AbortSignal.timeout(1000) }).then(
		(response) => response.ok,
		() => false
	);
}

async function waitUntil(condition: () => Promise<boolean>, what: string): Promise<void> {
	for (let attempt = 0; attempt < 100; attempt++) {
		if (await condition()) {
			return;
		}

		await new Promise((resolve) => setTimeout(resolve, 200));
	}

	throw new Error(what);
}

/** Replays a saved session through the live path on the live port, as a running session would. */
export function replaying(name: string, speed: number): void {
	const health = `http://127.0.0.1:${LIVE_PORT}/health`;
	let replay: ChildProcess | null = null;

	test.beforeAll(async () => {
		// A server already on the port would answer for this replay and serve the wrong session.
		if (await answers(health)) {
			throw new Error(
				`Something already serves ${health}; the ${name} replay cannot take the port`
			);
		}

		// Node with the tsx loader, not npx: no wrapper to outlive the kill. The replay leads its own
		// process group so the whole tree stops together.
		const child = spawn(
			process.execPath,
			[
				'--import',
				'tsx',
				'src/cli/replay-live.ts',
				'--dir',
				fixture(name),
				'--speed',
				String(speed)
			],
			{
				cwd: server,
				stdio: 'inherit',
				detached: true,
				env: {
					...process.env,
					HOST: '127.0.0.1',
					PORT: String(LIVE_PORT),
					DATA_DIR: FIXTURE_DATA_DIR,
					CORS_ORIGINS: `http://localhost:${LIVE_APP_PORT}`,
					LOG_LEVEL: 'warn'
				}
			}
		);

		replay = child;

		const exited = once(child, 'exit').then(([code, signal]) => {
			// After afterAll took the replay away, the exit is the intended one.
			if (replay === child) {
				throw new Error(`The ${name} replay exited early (${signal ?? `code ${code}`})`);
			}

			return null;
		});

		await Promise.race([
			exited,
			waitUntil(() => answers(health), `${health} did not come up for the ${name} replay`)
		]);
	});

	// The next replay takes the same port, so stop this one's whole process group and wait for the
	// port to be free.
	test.afterAll(async () => {
		const child = replay;

		replay = null;

		// Nothing of ours to stop, and the port belongs to someone else.
		if (!child) {
			return;
		}

		if (child.pid !== undefined && child.exitCode === null && child.signalCode === null) {
			process.kill(-child.pid, 'SIGTERM');
			await once(child, 'exit');
		}

		await waitUntil(
			async () => !(await answers(health)),
			`${health} still answers after the replay stopped`
		);
	});
}
