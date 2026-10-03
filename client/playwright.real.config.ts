import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

/**
 * The app on real data. `real` reads the committed fixture (e2e/real/data: the 2025 Las Vegas
 * race and qualifying, 2026 Baku qualifying) through the server; `live` replays a trimmed race and
 * qualifying session through the live path, started by its own spec, and `shots-live` shoots the
 * qualifying one.
 */

export const SAVED_PORT = 3111;

export const LIVE_PORT = 3112;

const REAL_APP_PORT = 4174;

const LIVE_APP_PORT = 4175;

const executablePath = process.env.PW_CHROMIUM_PATH;

const server = fileURLToPath(new URL('../server', import.meta.url));

export const FIXTURE_DATA_DIR = fileURLToPath(new URL('./e2e/real/data', import.meta.url));

function app(port: number, serverPort: number) {
	return {
		command: `vite --port ${port} --strictPort`,
		url: `http://localhost:${port}`,
		reuseExistingServer: !process.env.CI,
		env: {
			VITE_DATA_SOURCE: 'api',
			VITE_API_URL: `http://127.0.0.1:${serverPort}`,
			VITE_WS_URL: `ws://127.0.0.1:${serverPort}/live`,
			// The same server, with no accounts: sign-in reads as unavailable.
			ACCOUNTS_SERVER_URL: `http://127.0.0.1:${serverPort}`
		}
	};
}

export default defineConfig({
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		trace: 'retain-on-failure',
		launchOptions: executablePath ? { executablePath } : {}
	},
	projects: [
		{
			name: 'real',
			testDir: './e2e/real',
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 1440, height: 900 },
				baseURL: `http://localhost:${REAL_APP_PORT}`
			}
		},
		{
			name: 'live',
			testDir: './e2e/live',
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 1440, height: 900 },
				baseURL: `http://localhost:${LIVE_APP_PORT}`
			}
		},
		{
			name: 'shots-real',
			testDir: './shots',
			testMatch: 'real.spec.ts',
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${REAL_APP_PORT}` }
		},
		{
			name: 'shots-live',
			testDir: './shots',
			testMatch: 'live.spec.ts',
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${LIVE_APP_PORT}` }
		}
	],
	webServer: [
		{
			// Relay mode serves saved sessions and an empty live socket without reading the feed.
			command: 'npx tsx src/index.ts',
			cwd: server,
			url: `http://127.0.0.1:${SAVED_PORT}/health`,
			reuseExistingServer: !process.env.CI,
			env: {
				MODE: 'relay',
				RELAY_SECRET: 'e2e-only-relay-secret',
				HOST: '127.0.0.1',
				PORT: String(SAVED_PORT),
				DATA_DIR: FIXTURE_DATA_DIR,
				CORS_ORIGINS: `http://localhost:${REAL_APP_PORT}`,
				LOG_LEVEL: 'warn'
			}
		},
		app(REAL_APP_PORT, SAVED_PORT),
		app(LIVE_APP_PORT, LIVE_PORT)
	]
});
