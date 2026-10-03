/**
 * The launch quality budgets, in one run:
 *
 *   npm run budgets
 *
 * 1. A production build on the mock replay, with drawn pictures so no run depends on formula1.com.
 * 2. The initial route's scripts and styles against the size budget below.
 * 3. Lighthouse CI, mobile and desktop, on /, /analysis and /library, against that build served
 *    like a static host (serve-dist.ts); lighthouserc.json holds the score thresholds. Then a
 *    table of the median run's scores.
 *
 * Reports land in client/.lighthouseci/<form factor>/ and are not committed.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import { gzipKilobytes, initialAssets } from './initial-assets.ts';
import { serveDist } from './serve-dist.ts';

/**
 * Gzip kilobytes the first route may fetch before it can render; about 5% above the build of
 * October 2026 with accounts (295 kB of scripts, 12 kB of styles). Raise it on purpose, never by
 * drift.
 */
const BUDGET = { scripts: 310, styles: 14 };

const CLIENT_DIR = fileURLToPath(new URL('..', import.meta.url));

const OUT_DIR = 'dist-budget';

const FORM_FACTORS = ['mobile', 'desktop'] as const;

/**
 * Ubuntu 24.04 runners forbid the unprivileged user namespaces Chrome's sandbox needs, so Chrome
 * launched outside Playwright dies on start there. The flags replace the ones in
 * lighthouserc.json, so they repeat them; macOS keeps the config's own.
 */
const LINUX_CHROME_FLAGS =
	'--headless=new --ignore-certificate-errors --no-sandbox --disable-dev-shm-usage';

const ROUTES = ['/', '/analysis', '/library'] as const;

type ManifestEntry = {
	url: string;
	isRepresentativeRun: boolean;
	summary: Record<'performance' | 'accessibility' | 'best-practices' | 'seo', number>;
};

function run(command: string, args: string[], env: Record<string, string> = {}): boolean {
	const result = spawnSync(command, args, {
		cwd: CLIENT_DIR,
		stdio: 'inherit',
		env: { ...process.env, ...env }
	});

	return result.status === 0;
}

/** Like `run`, but leaves this process free to answer the requests of what it runs. */
function runAsync(command: string, args: string[], env: Record<string, string>): Promise<boolean> {
	return new Promise((resolve) => {
		spawn(command, args, { cwd: CLIENT_DIR, stdio: 'inherit', env: { ...process.env, ...env } })
			.on('error', () => resolve(false))
			.on('close', (code) => resolve(code === 0));
	});
}

async function checkBundle(): Promise<boolean> {
	const html = await readFile(`${CLIENT_DIR}${OUT_DIR}/index.html`, 'utf8');
	const { scripts, styles } = initialAssets(html);

	const total = async (paths: string[]) => {
		const sizes = await Promise.all(
			paths.map(async (path) => gzipKilobytes(await readFile(`${CLIENT_DIR}${OUT_DIR}${path}`)))
		);

		return sizes.reduce((sum, size) => sum + size, 0);
	};

	const sizes = { scripts: await total(scripts), styles: await total(styles) };

	console.warn(
		`Initial route: scripts ${sizes.scripts.toFixed(1)} of ${BUDGET.scripts} kB gzip, styles ${sizes.styles.toFixed(1)} of ${BUDGET.styles} kB gzip`
	);

	return sizes.scripts <= BUDGET.scripts && sizes.styles <= BUDGET.styles;
}

function scoreRow(formFactor: string, { url, summary }: ManifestEntry): string {
	const scores = [
		summary.performance,
		summary.accessibility,
		summary['best-practices'],
		summary.seo
	];

	return [
		formFactor.padEnd(8),
		new URL(url).pathname.padEnd(10),
		...scores.map((score) => String(Math.round(score * 100)).padStart(4))
	].join(' ');
}

/** The median run of each route, which is also the run the assertions judge. */
async function scoreTable(): Promise<string> {
	const rows = await Promise.all(
		FORM_FACTORS.map(async (formFactor) => {
			const manifest: ManifestEntry[] = JSON.parse(
				await readFile(`${CLIENT_DIR}.lighthouseci/${formFactor}/manifest.json`, 'utf8').catch(
					() => '[]'
				)
			);

			return manifest.flatMap((entry) =>
				entry.isRepresentativeRun ? [scoreRow(formFactor, entry)] : []
			);
		})
	);

	return ['form     route       perf a11y  b-p  seo', ...rows.flat()].join('\n');
}

async function hasReports(): Promise<boolean> {
	const reads = await Promise.all(
		FORM_FACTORS.map((formFactor) =>
			readFile(`${CLIENT_DIR}.lighthouseci/${formFactor}/manifest.json`).then(
				() => true,
				() => false
			)
		)
	);

	return reads.some(Boolean);
}

const built = run(
	'npx',
	['vite', 'build', '--outDir', OUT_DIR, '--emptyOutDir', '--logLevel', 'warn'],
	{
		VITE_DATA_SOURCE: 'mock',
		VITE_F1_MEDIA: 'off'
	}
);

if (!built) {
	process.exit(1);
}

const bundleOk = await checkBundle();

const chromePath = process.env.CHROME_PATH ?? chromium.executablePath();

const server = await serveDist(`${CLIENT_DIR}${OUT_DIR}`);

const lighthouseOk: boolean[] = [];

try {
	for (const formFactor of FORM_FACTORS) {
		lighthouseOk.push(
			// oxlint-disable-next-line no-await-in-loop -- one form factor at a time keeps timings honest.
			await runAsync(
				'npx',
				[
					'lhci',
					'autorun',
					'--config=lighthouserc.json',
					`--upload.outputDir=.lighthouseci/${formFactor}`,
					...ROUTES.map((route) => `--collect.url=${server.origin}${route}`),
					...(process.platform === 'linux'
						? [`--collect.settings.chromeFlags=${LINUX_CHROME_FLAGS}`]
						: []),
					...(formFactor === 'desktop' ? ['--collect.settings.preset=desktop'] : [])
				],
				{ CHROME_PATH: chromePath }
			)
		);
	}
} finally {
	await server.close();
}

console.warn(`\n${await scoreTable()}`);

if (!lighthouseOk.every(Boolean) && !(await hasReports())) {
	console.error(
		'Lighthouse wrote no report. If the log above shows Chrome dying on launch (for example "No usable sandbox"), the runs never started.'
	);
}

if (!bundleOk || !lighthouseOk.every(Boolean)) {
	console.error('Budgets failed: see the size line and the Lighthouse assertions above.');
	process.exit(1);
}
