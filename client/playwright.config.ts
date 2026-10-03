import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/** The server for sign-in, sync and the fake checkout, on a port of its own. */
export const ACCOUNTS_PORT = 3114;

/** Lets sandboxes with a preinstalled browser skip `playwright install`. */
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
			name: 'e2e',
			testDir: './e2e',
			// Real-data and live specs run from playwright.real.config.ts, the stack's from
			// playwright.stack.config.ts.
			testIgnore: ['real/**', 'live/**', 'stack/**'],
			use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
		},
		{
			name: 'shots',
			testDir: './shots',
			// Real-data shots run from playwright.real.config.ts.
			testIgnore: 'real.spec.ts',
			// Shots are an audit artefact, not a gate: they always write fresh files.
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: [
		{
			// Relay mode reads no live feed; accounts live in memory and start empty on every run.
			command: 'npx tsx src/index.ts',
			cwd: fileURLToPath(new URL('../server', import.meta.url)),
			url: `http://127.0.0.1:${ACCOUNTS_PORT}/health`,
			reuseExistingServer: !process.env.CI,
			env: {
				NODE_ENV: 'test',
				MODE: 'relay',
				RELAY_SECRET: 'e2e-only-relay-secret',
				HOST: '127.0.0.1',
				PORT: String(ACCOUNTS_PORT),
				CORS_ORIGINS: `http://localhost:${PORT}`,
				IMPORT_ON_FINISH: 'false',
				LOG_LEVEL: 'warn',
				ACCOUNTS_DB: 'memory',
				DATABASE_URL: '',
				SMTP_URL: '',
				PAYMENTS_PROVIDER: 'fake',
				APP_URL: `http://localhost:${PORT}`
			}
		},
		{
			command: `vite --port ${PORT} --strictPort`,
			url: `http://localhost:${PORT}`,
			reuseExistingServer: !process.env.CI,
			env: {
				VITE_DATA_SOURCE: 'mock',
				ACCOUNTS_SERVER_URL: `http://127.0.0.1:${ACCOUNTS_PORT}`
			}
		}
	]
});
