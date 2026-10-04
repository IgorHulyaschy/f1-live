import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

import { PORTS } from './playwright.ports.ts';
import { WORKERS } from './playwright.workers.ts';

/**
 * The app on real data. `real` reads the committed fixture (e2e/real/data: the 2025 Las Vegas
 * race and qualifying, 2026 Baku qualifying) through the server; `live` replays a trimmed race and
 * qualifying session through the live path, started by its own spec, and `shots-live` shoots the
 * qualifying one. `archive` opens a 2019 race whose positions its server fetches on demand.
 */

const SAVED_PORT = PORTS.realServer;

export const LIVE_PORT = PORTS.liveServer;

const REAL_APP_PORT = PORTS.realApp;

const MEDIA_OFF_APP_PORT = PORTS.mediaOffApp;

export const LIVE_APP_PORT = PORTS.liveApp;

/** `archive` starts its own server here, on a copy of its fixture and a stand-in archive. */
export const ARCHIVE_PORT = PORTS.archiveServer;

export const ARCHIVE_APP_PORT = PORTS.archiveApp;

const executablePath = process.env.PW_CHROMIUM_PATH;

const server = fileURLToPath(new URL('../server', import.meta.url));

export const FIXTURE_DATA_DIR = fileURLToPath(new URL('./e2e/real/data', import.meta.url));

function app(port: number, serverPort: number, extra: Record<string, string> = {}) {
	return {
		command: `vite --port ${port} --strictPort`,
		url: `http://localhost:${port}`,
		reuseExistingServer: !process.env.CI,
		env: {
			VITE_DATA_SOURCE: 'api',
			VITE_API_URL: `http://127.0.0.1:${serverPort}`,
			VITE_WS_URL: `ws://127.0.0.1:${serverPort}/live`,
			// The same server, with no accounts: sign-in reads as unavailable.
			ACCOUNTS_SERVER_URL: `http://127.0.0.1:${serverPort}`,
			...extra
		}
	};
}

export default defineConfig({
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	workers: WORKERS,
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
			name: 'media-off',
			testDir: './e2e/media-off',
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 1440, height: 900 },
				baseURL: `http://localhost:${MEDIA_OFF_APP_PORT}`
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
			name: 'archive',
			testDir: './e2e/archive',
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 1440, height: 900 },
				baseURL: `http://localhost:${ARCHIVE_APP_PORT}`
			}
		},
		{
			name: 'shots-real',
			testDir: './shots',
			testMatch: 'real.spec.ts',
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${REAL_APP_PORT}` }
		},
		{
			name: 'shots-layout',
			testDir: './shots',
			testMatch: 'layout.spec.ts',
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
				CORS_ORIGINS: `http://localhost:${REAL_APP_PORT},http://localhost:${MEDIA_OFF_APP_PORT}`,
				LOG_LEVEL: 'warn'
			}
		},
		app(REAL_APP_PORT, SAVED_PORT),
		app(LIVE_APP_PORT, LIVE_PORT),
		app(MEDIA_OFF_APP_PORT, SAVED_PORT, { VITE_F1_MEDIA: 'off' }),
		app(ARCHIVE_APP_PORT, ARCHIVE_PORT)
	]
});
