/**
 * The launch quality budgets, in one run:
 *
 *   npm run budgets
 *
 * 1. A production build on the mock replay, with drawn pictures so no run depends on formula1.com.
 * 2. The initial route's scripts and styles against the size budget below.
 * 3. Lighthouse CI, mobile and desktop, on /, /analysis and /library (lighthouserc.json holds the
 *    score thresholds), then a table of the median run's scores.
 *
 * Reports land in client/.lighthouseci/<form factor>/ and are not committed.
 */
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import { gzipKilobytes, initialAssets } from './initial-assets.ts';

/**
 * Gzip kilobytes the first route may fetch before it can render; about 5% above the build of
 * October 2026 with accounts (295 kB of scripts, 12 kB of styles). Raise it on purpose, never by
 * drift.
 */
const BUDGET = { scripts: 310, styles: 14 };

const CLIENT_DIR = fileURLToPath(new URL('..', import.meta.url));

const OUT_DIR = 'dist-budget';

const FORM_FACTORS = ['mobile', 'desktop'] as const;

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
				await readFile(`${CLIENT_DIR}.lighthouseci/${formFactor}/manifest.json`, 'utf8')
			);

			return manifest.flatMap((entry) =>
				entry.isRepresentativeRun ? [scoreRow(formFactor, entry)] : []
			);
		})
	);

	return ['form     route       perf a11y  b-p  seo', ...rows.flat()].join('\n');
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

const lighthouseOk = FORM_FACTORS.map((formFactor) =>
	run(
		'npx',
		[
			'lhci',
			'autorun',
			'--config=lighthouserc.json',
			`--upload.outputDir=.lighthouseci/${formFactor}`,
			...(formFactor === 'desktop' ? ['--collect.settings.preset=desktop'] : [])
		],
		{ CHROME_PATH: chromePath }
	)
).every(Boolean);

console.warn(`\n${await scoreTable()}`);

if (!bundleOk || !lighthouseOk) {
	console.error('Budgets failed: see the size line and the Lighthouse assertions above.');
	process.exit(1);
}
