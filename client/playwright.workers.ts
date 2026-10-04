/**
 * Browser workers per Playwright suite. Locally two, so suites that run side by side do not
 * overload the laptop; on GitHub Actions Playwright's default. `PW_WORKERS` overrides both.
 */
export const WORKERS: number | undefined = process.env.PW_WORKERS
	? Number(process.env.PW_WORKERS)
	: process.env.GITHUB_ACTIONS
		? undefined
		: 2;
