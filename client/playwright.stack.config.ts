import { defineConfig, devices } from '@playwright/test';

/**
 * The production build behind Caddy, as `docker compose up` runs it (docs/deploy.md). It starts
 * nothing itself: bring the stack up first. `STACK_URL` points it elsewhere, and `STACK_REPLAY=1`
 * adds the live check for `docker compose --profile replay up`.
 */

const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
	testDir: './e2e/stack',
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		...devices['Desktop Chrome'],
		viewport: { width: 1440, height: 900 },
		baseURL: process.env.STACK_URL ?? 'http://localhost:8080',
		trace: 'retain-on-failure',
		launchOptions: executablePath ? { executablePath } : {}
	}
});
