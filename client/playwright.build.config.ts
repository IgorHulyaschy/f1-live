import { defineConfig, devices } from '@playwright/test';

import { PORTS } from './playwright.ports.ts';

/**
 * The production build of the mock replay, with the `console` analytics provider so the consent
 * question is asked: the service worker, the generated site files and the consent flow exist only
 * here, not on the dev server.
 */

const PORT = PORTS.buildApp;

const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'retain-on-failure',
		launchOptions: executablePath ? { executablePath } : {}
	},
	projects: [
		{
			name: 'pwa',
			testDir: './e2e/build',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
		},
		{
			name: 'shots-build',
			testDir: './shots',
			testMatch: 'build.spec.ts',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		command: `vite build --outDir dist-e2e --emptyOutDir --logLevel warn && vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
		url: `http://localhost:${PORT}`,
		reuseExistingServer: !process.env.CI,
		env: {
			VITE_DATA_SOURCE: 'mock',
			VITE_ANALYTICS_PROVIDER: 'console',
			// No accounts server: sign-in reads as unavailable, and /api never reaches a server on
			// the default port that another checkout may be running.
			ACCOUNTS_SERVER_URL: 'http://127.0.0.1:9'
		}
	}
});
