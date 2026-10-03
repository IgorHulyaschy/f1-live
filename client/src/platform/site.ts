import { BRAND } from '../brand.ts';
import { PRESETS } from '../features/dashboard/dashboards.ts';
import { dashboardPath } from '../features/dashboard/paths.ts';
import { LEGAL_DOCUMENTS } from '../legal/content.ts';

/**
 * Files the build writes next to the app (web app manifest, robots.txt, sitemap) and the head of
 * index.html, all made from the brand so a rename touches one module.
 */

/** Hex twins of `--background` in index.css, for the manifest and the browser's own toolbar. */
export const THEME_COLOURS = { dark: '#0d0c0a', light: '#f8f7f3' } as const;

/**
 * Pages worth finding in a search: the ready-made dashboards, the library and the legal pages.
 * Everything else is one viewer's: dashboards saved in their browser, shared links, pop-outs.
 */
export const INDEXED_PATHS: readonly string[] = [
	...PRESETS.map((preset) => dashboardPath(preset.id)),
	'/library',
	...LEGAL_DOCUMENTS.map((document) => `/legal/${document.slug}`)
];

export const OG_IMAGE = { path: '/og-image.png', width: 1200, height: 630 } as const;

export function siteUrl(path: string): string {
	return new URL(path, BRAND.origin).href;
}

/** The home page title; every other page is "<page> | <brand>". */
export function documentTitle(title: string | null): string {
	return title ? `${title} | ${BRAND.name}` : `${BRAND.name}: ${BRAND.tagline}`;
}

export type ManifestIcon = {
	src: string;
	sizes: string;
	type: string;
	purpose: 'any' | 'maskable';
};

export type WebManifest = {
	id: string;
	name: string;
	short_name: string;
	description: string;
	start_url: string;
	scope: string;
	display: 'standalone';
	background_color: string;
	theme_color: string;
	categories: readonly string[];
	icons: readonly ManifestIcon[];
	shortcuts: readonly { name: string; url: string }[];
};

export function webManifest(): WebManifest {
	return {
		id: '/',
		name: BRAND.name,
		short_name: BRAND.shortName,
		description: BRAND.description,
		start_url: '/',
		scope: '/',
		display: 'standalone',
		// Dark is the default theme, so the splash screen matches the first paint.
		background_color: THEME_COLOURS.dark,
		theme_color: THEME_COLOURS.dark,
		categories: ['sports'],
		icons: [
			{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
			{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
			{
				src: '/icons/icon-maskable-512.png',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'maskable'
			}
		],
		shortcuts: [
			{ name: 'Analysis', url: '/analysis' },
			{ name: 'Strategy', url: '/strategy' },
			{ name: 'Library', url: '/library' }
		]
	};
}

/** A private preview keeps crawlers out entirely (plan 2); a launch lists the sitemap. */
export function robotsTxt(indexable: boolean): string {
	return indexable
		? `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl('/sitemap.xml')}\n`
		: 'User-agent: *\nDisallow: /\n';
}

export function sitemapXml(): string {
	const urls = INDEXED_PATHS.map((path) => `  <url><loc>${siteUrl(path)}</loc></url>`).join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

/** Fills the `%SITE_…%` placeholders in index.html. */
export function fillIndexHtml(html: string, indexable: boolean): string {
	const values: ReadonlyMap<string, string> = new Map([
		['%SITE_NAME%', BRAND.name],
		['%SITE_TITLE%', documentTitle(null)],
		['%SITE_DESCRIPTION%', BRAND.description],
		['%SITE_ROBOTS%', indexable ? 'index, follow' : 'noindex, nofollow'],
		['%SITE_IMAGE%', siteUrl(OG_IMAGE.path)],
		['%SITE_IMAGE_WIDTH%', String(OG_IMAGE.width)],
		['%SITE_IMAGE_HEIGHT%', String(OG_IMAGE.height)],
		['%THEME_COLOUR%', THEME_COLOURS.dark],
		['%THEME_COLOUR_LIGHT%', THEME_COLOURS.light]
	]);

	return html.replaceAll(/%(?:SITE|THEME)_[A-Z_]+%/g, (placeholder) => {
		const value = values.get(placeholder);

		if (value === undefined) {
			throw new Error(`index.html has an unknown placeholder ${placeholder}`);
		}

		return escapeHtml(value);
	});
}
