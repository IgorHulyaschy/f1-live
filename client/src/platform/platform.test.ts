import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BRAND } from '../brand.ts';
import { type Dashboard, PRESETS } from '../features/dashboard/dashboards.ts';
import { dashboardPath } from '../features/dashboard/paths.ts';
import { COMMUNITY } from '../features/library/community.ts';
import { encodeShare } from '../features/library/share.ts';
import { LEGAL_DOCUMENTS } from '../legal/content.ts';
import {
	analyticsProvider,
	consoleAnalytics,
	resolveAnalytics,
	silentAnalytics
} from './analytics.ts';
import { isStaleChunk } from './errors.ts';
import { ROUTE_META } from './route-meta.ts';
import {
	documentTitle,
	fillIndexHtml,
	INDEXED_PATHS,
	robotsTxt,
	sitemapXml,
	THEME_COLOURS,
	webManifest
} from './site.ts';

describe('site files', () => {
	it('list every ready-made dashboard and legal page in the sitemap', () => {
		const sitemap = sitemapXml();

		for (const preset of PRESETS) {
			assert.ok(
				INDEXED_PATHS.some((path) => path === dashboardPath(preset.id)),
				preset.id
			);
		}

		for (const document of LEGAL_DOCUMENTS) {
			assert.ok(sitemap.includes(`${BRAND.origin}/legal/${document.slug}<`), document.slug);
		}

		assert.ok(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
	});

	it('keep crawlers out of a private preview and point them at the sitemap otherwise', () => {
		assert.equal(robotsTxt(false), 'User-agent: *\nDisallow: /\n');
		assert.match(
			robotsTxt(true),
			/^User-agent: \*\nAllow: \/\n\nSitemap: https:\/\/.+\/sitemap\.xml\n$/
		);
	});

	it('describe an installable app with a maskable icon', () => {
		const manifest = webManifest();

		assert.equal(manifest.name, BRAND.name);
		assert.equal(manifest.display, 'standalone');
		assert.equal(manifest.theme_color, THEME_COLOURS.dark);
		assert.ok(
			manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable')
		);
		assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.purpose === 'any'));
	});

	it('fill index.html from the brand, escaped, and refuse a placeholder it does not know', () => {
		const html = fillIndexHtml(
			'<title>%SITE_TITLE%</title><meta name="robots" content="%SITE_ROBOTS%">',
			false
		);

		assert.equal(
			html,
			`<title>${documentTitle(null)}</title><meta name="robots" content="noindex, nofollow">`
		);
		assert.throws(() => fillIndexHtml('%SITE_NOPE%', true), /SITE_NOPE/);
	});

	it('title pages after the brand, and the home page with its tagline', () => {
		assert.equal(documentTitle('Analysis'), `Analysis | ${BRAND.name}`);
		assert.equal(documentTitle(null), `${BRAND.name}: ${BRAND.tagline}`);
	});
});

function ownDashboard(name: string): Dashboard {
	return { id: 'mine', name, tiles: [], layout: [] };
}

describe('route meta', () => {
	const input = { params: {}, search: new URLSearchParams(), dashboards: PRESETS };

	it('names a shared dashboard after the dashboard and keeps it out of search', () => {
		const dashboard = ownDashboard('Sofa screen');
		const search = new URLSearchParams({ d: encodeShare(dashboard) });
		const meta = ROUTE_META.shared({ ...input, search });

		assert.equal(meta.title, 'Sofa screen: shared dashboard');
		assert.equal(meta.indexed, false);
		assert.equal(ROUTE_META.shared(input).title, 'Shared dashboard');
	});

	it('indexes ready-made dashboards but not ones saved in one browser', () => {
		const own = ownDashboard('My wall');
		const dashboards = [...PRESETS, own];

		assert.deepEqual(ROUTE_META.dashboard({ ...input, dashboards, params: { id: 'battle' } }), {
			title: 'Battle',
			description: ROUTE_META.dashboard({ ...input, params: { id: 'battle' } }).description,
			indexed: true
		});
		assert.equal(
			ROUTE_META.dashboard({ ...input, dashboards, params: { id: 'mine' } }).indexed,
			false
		);
		assert.equal(
			ROUTE_META.dashboard({ ...input, dashboards, params: { id: 'mine' } }).title,
			'My wall'
		);
	});

	it('credits a library entry to its author', () => {
		const entry = COMMUNITY[0];

		assert.ok(entry);
		assert.equal(
			ROUTE_META.libraryEntry({ ...input, params: { entryId: entry.id } }).title,
			`${entry.dashboard.name} by @${entry.author}`
		);
	});
});

describe('analytics', () => {
	const provider = analyticsProvider('console');

	it('runs nothing without a provider, printing only in development', () => {
		assert.equal(analyticsProvider(undefined), null);
		assert.equal(analyticsProvider('unknown'), null);
		assert.deepEqual(resolveAnalytics(null, null, false), {
			ask: false,
			analytics: silentAnalytics
		});
		assert.deepEqual(resolveAnalytics(null, null, true), {
			ask: false,
			analytics: consoleAnalytics
		});
	});

	it('asks before a configured provider starts, and stays silent after a no', () => {
		assert.ok(provider);
		assert.deepEqual(resolveAnalytics(provider, null, false), {
			ask: true,
			analytics: silentAnalytics
		});
		assert.deepEqual(resolveAnalytics(provider, 'denied', false), {
			ask: false,
			analytics: silentAnalytics
		});
		assert.deepEqual(resolveAnalytics(provider, 'granted', false), {
			ask: false,
			analytics: consoleAnalytics
		});
	});
});

describe('errors', () => {
	it('tell a chunk lost to a deploy from a crash', () => {
		assert.equal(
			isStaleChunk(new TypeError('Failed to fetch dynamically imported module: /assets/a.js')),
			true
		);
		assert.equal(isStaleChunk(new TypeError('Importing a module script failed.')), true);
		assert.equal(
			isStaleChunk(new TypeError("Cannot read properties of undefined (reading 'lap')")),
			false
		);
		assert.equal(isStaleChunk('dynamically imported module'), false);
	});
});
