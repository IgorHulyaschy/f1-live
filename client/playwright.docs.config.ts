import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

import { PORTS } from './playwright.ports.ts';
import { LIVE_APP_PORT } from './playwright.real.config.ts';
import { WORKERS } from './playwright.workers.ts';
import { prepareDocsData } from './shots/docs-data.ts';

/**
 * Every picture in docs/tour, from one command: `npm run docs:shots`. The specs are
 * `shots/docs-<app>-<area>.spec.ts`, and `npm run docs:shots -- --project=docs-real` runs one app.
 *
 * Three apps, all with the media host switched off so the drawn plates show and no formula1.com
 * picture is stored: the mock replay with accounts (the dashboard, library and account screens),
 * real data behind its own server (everything about a session and its history), and a session
 * replayed through the live path. Real data is the committed fixture of client/e2e/real/data, so
 * the pictures come out the same on every machine; DOCS_DATA_DIR (or DATA_DIR) points at a full
 * import instead, and the pictures then show more laps and seasons. Each picture is cropped and
 * optimised by `scripts/docs-picture.ts`.
 */

const MOCK_APP_PORT = PORTS.mockApp;

const REAL_APP_PORT = PORTS.realApp;

const REAL_SERVER_PORT = PORTS.realServer;

const ACCOUNTS_PORT = PORTS.accountsServer;

const executablePath = process.env.PW_CHROMIUM_PATH;

const server = fileURLToPath(new URL('../server', import.meta.url));

const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } };

function app(port: number, env: Record<string, string>) {
	return {
		command: `vite --port ${port} --strictPort`,
		url: `http://localhost:${port}`,
		reuseExistingServer: !process.env.CI,
		env: { VITE_F1_MEDIA: 'off', ...env }
	};
}

export default defineConfig({
	forbidOnly: Boolean(process.env.CI),
	// A picture is a pure function of the page, so a rerun after a slow-machine timeout is safe.
	retries: 1,
	workers: WORKERS,
	reporter: process.env.CI ? 'github' : 'list',
	// A picture waits for fonts, charts and the track map; the live replay waits for its session.
	timeout: 90_000,
	expect: { timeout: 15_000 },
	use: {
		trace: 'off',
		launchOptions: executablePath ? { executablePath } : {}
	},
	projects: [
		{
			name: 'docs-mock',
			testDir: './shots',
			testMatch: 'docs-mock-*.spec.ts',
			use: { ...desktop, baseURL: `http://localhost:${MOCK_APP_PORT}` }
		},
		{
			name: 'docs-real',
			testDir: './shots',
			testMatch: 'docs-real-*.spec.ts',
			use: { ...desktop, baseURL: `http://localhost:${REAL_APP_PORT}` }
		},
		{
			name: 'docs-live',
			testDir: './shots',
			testMatch: 'docs-live-*.spec.ts',
			use: { ...desktop, baseURL: `http://localhost:${LIVE_APP_PORT}` }
		}
	],
	webServer: [
		{
			// Relay mode reads no live feed; accounts live in memory and start empty on every run.
			command: 'npx tsx src/index.ts',
			cwd: server,
			url: `http://127.0.0.1:${ACCOUNTS_PORT}/health`,
			reuseExistingServer: !process.env.CI,
			env: {
				NODE_ENV: 'test',
				MODE: 'relay',
				RELAY_SECRET: 'docs-only-relay-secret',
				HOST: '127.0.0.1',
				PORT: String(ACCOUNTS_PORT),
				CORS_ORIGINS: `http://localhost:${MOCK_APP_PORT}`,
				IMPORT_ON_FINISH: 'false',
				LOG_LEVEL: 'warn',
				ACCOUNTS_DB: 'memory',
				DATABASE_URL: '',
				SMTP_URL: '',
				PAYMENTS_PROVIDER: 'fake',
				APP_URL: `http://localhost:${MOCK_APP_PORT}`
			}
		},
		app(MOCK_APP_PORT, {
			VITE_DATA_SOURCE: 'mock',
			ACCOUNTS_SERVER_URL: `http://127.0.0.1:${ACCOUNTS_PORT}`
		}),
		{
			// Saved sessions only: no live feed, no downloads, no writes into the data it reads.
			command: 'npx tsx src/index.ts',
			cwd: server,
			url: `http://127.0.0.1:${REAL_SERVER_PORT}/health`,
			reuseExistingServer: !process.env.CI,
			env: {
				MODE: 'relay',
				RELAY_SECRET: 'docs-only-relay-secret',
				HOST: '127.0.0.1',
				PORT: String(REAL_SERVER_PORT),
				DATA_DIR: prepareDocsData(),
				CORS_ORIGINS: `http://localhost:${REAL_APP_PORT}`,
				IMPORT_ON_FINISH: 'false',
				TELEMETRY_ON_DEMAND: 'false',
				LOG_LEVEL: 'warn'
			}
		},
		app(REAL_APP_PORT, {
			VITE_DATA_SOURCE: 'api',
			VITE_API_URL: `http://127.0.0.1:${REAL_SERVER_PORT}`,
			VITE_WS_URL: `ws://127.0.0.1:${REAL_SERVER_PORT}/live`,
			ACCOUNTS_SERVER_URL: `http://127.0.0.1:${REAL_SERVER_PORT}`
		}),
		app(LIVE_APP_PORT, {
			VITE_DATA_SOURCE: 'api',
			VITE_API_URL: `http://127.0.0.1:${PORTS.liveServer}`,
			VITE_WS_URL: `ws://127.0.0.1:${PORTS.liveServer}/live`,
			ACCOUNTS_SERVER_URL: `http://127.0.0.1:${PORTS.liveServer}`
		})
	]
});
