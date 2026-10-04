import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

import { PORTS } from './playwright.ports.ts';
import { WORKERS } from './playwright.workers.ts';

/**
 * The production build behind Caddy, as `docker compose up` runs it (docs/deploy.md). It starts
 * nothing itself: bring the stack up first. `STACK_URL` points it elsewhere, and `STACK_REPLAY=1`
 * adds the live check for `docker compose --profile replay up`.
 *
 * `STACK_LOCAL=1` replaces Docker with the same two pieces on this machine: the production build
 * under `vite preview` (which proxies /api as Caddy does) and the relay server on the committed
 * real-data fixture, with in-memory accounts and the fake checkout. It runs inside `test:e2e`, so
 * a header or sign-in change that breaks these specs fails before CI does. Only Caddy, Postgres
 * and the images are left to the Docker run.
 */

const LOCAL = process.env.STACK_LOCAL === '1';

const APP_PORT = PORTS.stackApp;

const SERVER_PORT = PORTS.accountsServer;

const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
	testDir: './e2e/stack',
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	workers: WORKERS,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		...devices['Desktop Chrome'],
		viewport: { width: 1440, height: 900 },
		baseURL: LOCAL
			? `http://localhost:${APP_PORT}`
			: (process.env.STACK_URL ?? 'http://localhost:8080'),
		trace: 'retain-on-failure',
		launchOptions: executablePath ? { executablePath } : {}
	},
	webServer: LOCAL
		? [
				{
					command: 'npx tsx src/index.ts',
					cwd: fileURLToPath(new URL('../server', import.meta.url)),
					url: `http://127.0.0.1:${SERVER_PORT}/health`,
					reuseExistingServer: !process.env.CI,
					env: {
						NODE_ENV: 'test',
						MODE: 'relay',
						RELAY_SECRET: 'e2e-only-relay-secret',
						HOST: '127.0.0.1',
						PORT: String(SERVER_PORT),
						DATA_DIR: fileURLToPath(new URL('./e2e/real/data', import.meta.url)),
						CORS_ORIGINS: `http://localhost:${APP_PORT}`,
						IMPORT_ON_FINISH: 'false',
						LOG_LEVEL: 'warn',
						ACCOUNTS_DB: 'memory',
						DATABASE_URL: '',
						SMTP_URL: '',
						PAYMENTS_PROVIDER: 'fake',
						APP_URL: `http://localhost:${APP_PORT}`
					}
				},
				{
					command: `vite build --outDir dist-stack --emptyOutDir --logLevel warn && vite preview --outDir dist-stack --port ${APP_PORT} --strictPort`,
					url: `http://localhost:${APP_PORT}`,
					reuseExistingServer: !process.env.CI,
					env: {
						VITE_DATA_SOURCE: 'api',
						VITE_API_URL: `http://127.0.0.1:${SERVER_PORT}`,
						VITE_WS_URL: `ws://127.0.0.1:${SERVER_PORT}/live`,
						ACCOUNTS_SERVER_URL: `http://127.0.0.1:${SERVER_PORT}`
					}
				}
			]
		: undefined
});
