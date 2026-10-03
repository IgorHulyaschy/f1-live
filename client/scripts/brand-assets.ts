/**
 * Draws the favicon, the install icons and the share card from the identity: the two forward-cut
 * bars of the wordmark on carbon, and the race barcode. Run after a rename or an identity change:
 *
 *   npm run brand-assets -w client
 *
 * Writes client/public/favicon.svg, client/public/icons/*.png and client/public/og-image.png.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import { BRAND } from '../src/brand.ts';
import { OG_IMAGE, THEME_COLOURS } from '../src/platform/site.ts';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

const FONTS_DIR = fileURLToPath(
	new URL('../../node_modules/@fontsource-variable/', import.meta.url)
);

/** Hex twins of the dark theme tokens in index.css. */
const INK = {
	carbon: THEME_COLOURS.dark,
	bone: '#eae8e1',
	muted: '#a6a59e',
	rule: '#7c7b74',
	flag: '#facb39',
	fastest: '#b76efe'
} as const;

/**
 * The wordmark's bars in units of its 12 by 16 pixel bar: each is cut forward by half its width
 * (the `cut-forward` utility), with a 2 pixel gap between them.
 */
const BAR = { width: 12, height: 16, cut: 6, gap: 2 } as const;

const MARK_WIDTH = BAR.width * 2 + BAR.gap;

function bars(scale: number, left: number, top: number): string {
	return [0, BAR.width + BAR.gap]
		.map((offset) => {
			const x = left + offset * scale;

			const points = [
				[x + BAR.cut * scale, top],
				[x + BAR.width * scale, top],
				[x + (BAR.width - BAR.cut) * scale, top + BAR.height * scale],
				[x, top + BAR.height * scale]
			];

			return `<polygon points="${points.map((point) => point.join(',')).join(' ')}" fill="${INK.bone}"/>`;
		})
		.join('');
}

/** The mark centred on a carbon square, `fill` being the share of the side the bars span. */
function markSvg(size: number, fill: number): string {
	const scale = (size * fill) / MARK_WIDTH;
	const left = (size - MARK_WIDTH * scale) / 2;
	const top = (size - BAR.height * scale) / 2;

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${INK.carbon}"/>${bars(scale, left, top)}</svg>`;
}

/**
 * A race barcode like the lap strip tile: one bar per lap, its height the pit traffic, yellow
 * where the race was neutralised and a purple cap where the fastest lap fell. Made up, so the
 * card shows no real race.
 */
function barcode(width: number, height: number): string {
	const laps = 57;
	const step = width / laps;
	const neutralised = new Set([7, 8, 9, 33, 34]);
	const fastest = 49;

	return Array.from({ length: laps }, (_, index) => {
		const lap = index + 1;
		const traffic = (Math.sin(lap * 1.7) + Math.sin(lap * 0.37) + 2) / 4;
		const pit = [14, 15, 16, 28, 29, 41, 42].includes(lap) ? 0.55 : 0;
		const bar = Math.round(height * Math.min(0.12 + traffic * 0.45 + pit, 1));
		const colour = neutralised.has(lap) ? INK.flag : INK.bone;
		const x = Math.round(index * step);

		const cap =
			lap === fastest
				? `<rect x="${x}" y="${height - bar - 6}" width="${Math.ceil(step * 0.6)}" height="4" fill="${INK.fastest}"/>`
				: '';

		return `<rect x="${x}" y="${height - bar}" width="${Math.ceil(step * 0.6)}" height="${bar}" fill="${colour}"/>${cap}`;
	}).join('');
}

async function fontFace(family: string, file: string, style: 'normal' | 'italic'): Promise<string> {
	const data = (await readFile(`${FONTS_DIR}${file}`)).toString('base64');

	return `@font-face{font-family:'${family}';font-style:${style};font-weight:200 900;font-stretch:75% 125%;src:url(data:font/woff2;base64,${data}) format('woff2');}`;
}

async function shareCardHtml(): Promise<string> {
	const fonts = await Promise.all([
		fontFace('Hubot Sans', 'hubot-sans/files/hubot-sans-latin-standard-italic.woff2', 'italic'),
		fontFace(
			'Martian Mono',
			'martian-mono/files/martian-mono-latin-standard-normal.woff2',
			'normal'
		)
	]);

	const fields = ['Timing', 'Gaps', 'Tyres', 'Pit windows', 'Pace']
		.map((field) => `<span>${field}</span>`)
		.join('');

	return `<!doctype html><html><head><style>${fonts.join('')}
		* { margin: 0; box-sizing: border-box; }
		body { width: ${OG_IMAGE.width}px; height: ${OG_IMAGE.height}px; background: ${INK.carbon}; color: ${INK.bone}; padding: 72px 80px 64px; display: flex; flex-direction: column; }
		.mark { display: flex; align-items: center; gap: 36px; }
		.name { font-family: 'Hubot Sans'; font-style: italic; font-weight: 900; font-stretch: 125%; font-size: 132px; line-height: 1; letter-spacing: 0.02em; text-transform: uppercase; }
		.label { font-family: 'Martian Mono'; font-stretch: 75%; font-size: 26px; letter-spacing: 0.06em; text-transform: uppercase; color: ${INK.muted}; }
		.tagline { margin-top: 28px; }
		.rule { margin-top: auto; border-top: 3px solid ${INK.rule}; padding-top: 18px; display: flex; }
		.rule span + span { border-left: 1px solid ${INK.rule}; margin-left: 24px; padding-left: 24px; }
		.strip { margin-top: 28px; }
	</style></head><body>
		<div class="mark">
			<svg width="${MARK_WIDTH * 6}" height="${BAR.height * 6}" viewBox="0 0 ${MARK_WIDTH * 6} ${BAR.height * 6}">${bars(6, 0, 0)}</svg>
			<span class="name">${BRAND.name}</span>
		</div>
		<p class="label tagline">${BRAND.tagline}</p>
		<div class="rule label">${fields}</div>
		<svg class="strip" width="1040" height="110" viewBox="0 0 1040 110">${barcode(1040, 110)}</svg>
	</body></html>`;
}

const ICONS = [
	{ file: 'icons/icon-192.png', size: 192, fill: 0.7 },
	{ file: 'icons/icon-512.png', size: 512, fill: 0.7 },
	// Launchers crop maskable icons to a circle 80% across; the bars stay well inside it.
	{ file: 'icons/icon-maskable-512.png', size: 512, fill: 0.5 },
	{ file: 'icons/apple-touch-icon.png', size: 180, fill: 0.62 }
] as const;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH });

try {
	const page = await browser.newPage();

	await mkdir(`${PUBLIC_DIR}icons`, { recursive: true });
	await writeFile(`${PUBLIC_DIR}favicon.svg`, `${markSvg(32, 0.84)}\n`);

	for (const icon of ICONS) {
		await page.setViewportSize({ width: icon.size, height: icon.size });
		await page.setContent(
			`<body style="margin:0">${markSvg(icon.size, icon.fill).replace('<svg ', `<svg width="${icon.size}" height="${icon.size}" `)}</body>`
		);
		await page.screenshot({ path: `${PUBLIC_DIR}${icon.file}`, omitBackground: false });
	}

	await page.setViewportSize({ width: OG_IMAGE.width, height: OG_IMAGE.height });
	await page.setContent(await shareCardHtml());
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: `${PUBLIC_DIR}${OG_IMAGE.path.slice(1)}` });
} finally {
	await browser.close();
}
