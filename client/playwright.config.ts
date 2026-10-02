import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

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
			use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
		},
		{
			name: 'shots',
			testDir: './shots',
			// Shots are an audit artefact, not a gate: they always write fresh files.
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		command: `vite --port ${PORT} --strictPort`,
		url: `http://localhost:${PORT}`,
		reuseExistingServer: !process.env.CI,
		env: { VITE_DATA_SOURCE: 'mock' }
	}
});
