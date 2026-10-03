import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

import { fillIndexHtml, robotsTxt, sitemapXml, webManifest } from './src/platform/site-files.ts';

/** The server with accounts on; `/api` goes there, so sign-in cookies stay first-party. */
const accountsServer = process.env.ACCOUNTS_SERVER_URL ?? 'http://127.0.0.1:3000';

// `ws` carries the signed-in device channel (`/api/me/events`) along with the REST calls.
const proxy = { '/api': { target: accountsServer, ws: true } };

const SERVICE_WORKER = fileURLToPath(new URL('./src/platform/service-worker.ts', import.meta.url));

/** Public files the offline shell needs besides the build output. */
const PRECACHED_PUBLIC_FILES = [
	'/favicon.svg',
	'/manifest.webmanifest',
	'/icons/icon-192.png',
	'/icons/apple-touch-icon.png'
];

/** Scripts, styles and the font subsets an English page uses; Cyrillic and the rest load online. */
function isPrecached(fileName: string): boolean {
	return (
		/\.(js|css)$/.test(fileName) ||
		/-(latin|latin-ext)-standard-(normal|italic)-[\w-]+\.woff2$/.test(fileName)
	);
}

/** Swaps a global the service worker declares for its value, which must appear exactly once. */
function fillPlaceholder(code: string, name: string, value: string): string {
	const parts = code.split(new RegExp(String.raw`\b${name}\b`));

	if (parts.length !== 2) {
		throw new Error(`sw.js should use ${name} once, found ${parts.length - 1}`);
	}

	return parts.join(value);
}

/**
 * index.html, the manifest, robots.txt and the sitemap are written from the brand module, and the
 * build adds a service worker that keeps the app shell for offline use.
 */
function site(indexable: boolean): Plugin[] {
	let publicDir = '';

	const generated = new Map([
		['manifest.webmanifest', () => `${JSON.stringify(webManifest(), null, '\t')}\n`],
		['robots.txt', () => robotsTxt(indexable)],
		['sitemap.xml', () => sitemapXml()]
	]);

	const contentTypes = new Map([
		['manifest.webmanifest', 'application/manifest+json'],
		['robots.txt', 'text/plain'],
		['sitemap.xml', 'application/xml']
	]);

	return [
		{
			name: 'site-files',
			transformIndexHtml: { order: 'pre', handler: (html) => fillIndexHtml(html, indexable) },
			configureServer(server) {
				server.middlewares.use((request, response, next) => {
					const name = request.url?.slice(1) ?? '';
					const render = generated.get(name);

					if (!render) {
						next();

						return;
					}

					response.setHeader('Content-Type', contentTypes.get(name) ?? 'text/plain');
					response.end(render());
				});
			},
			generateBundle() {
				for (const [fileName, render] of generated) {
					this.emitFile({ type: 'asset', fileName, source: render() });
				}
			}
		},
		{
			name: 'script-priority',
			apply: 'build',
			transformIndexHtml: {
				order: 'post',
				// The shell paints from HTML and CSS alone; the app's scripts must not compete with the
				// stylesheet for the first bytes. They still start loading at once.
				handler: (html) =>
					html
						.replaceAll(
							'<script type="module" crossorigin',
							'<script type="module" fetchpriority="low" crossorigin'
						)
						.replaceAll(
							'<link rel="modulepreload" crossorigin',
							'<link rel="modulepreload" fetchpriority="low" crossorigin'
						)
			}
		},
		{
			name: 'service-worker',
			apply: 'build',
			enforce: 'post',
			configResolved(config) {
				publicDir = config.publicDir;
			},
			buildStart() {
				this.emitFile({ type: 'chunk', id: SERVICE_WORKER, fileName: 'sw.js' });
			},
			generateBundle(_options, bundle) {
				const worker = bundle['sw.js'];
				const html = bundle['index.html'];

				if (worker?.type !== 'chunk' || html?.type !== 'asset') {
					throw new Error('The service worker needs sw.js and index.html in the bundle');
				}

				// The worker is a classic script: a module it shares with the app would become an import.
				if (worker.imports.length > 0) {
					throw new Error(
						`sw.js imports ${worker.imports.join(', ')}; keep the service worker's modules to itself`
					);
				}

				const files = Object.keys(bundle).filter((name) => name !== 'sw.js' && isPrecached(name));
				const precache = ['/', ...PRECACHED_PUBLIC_FILES, ...files.map((name) => `/${name}`)];

				// Hashed names change with their content; the page and the public files must be read.
				const hash = createHash('sha256').update(precache.join('\n')).update(html.source);

				for (const path of PRECACHED_PUBLIC_FILES) {
					const emitted = bundle[path.slice(1)];

					hash.update(
						emitted?.type === 'asset' ? emitted.source : readFileSync(join(publicDir, path))
					);
				}

				const version = hash.digest('hex').slice(0, 12);

				worker.code = fillPlaceholder(worker.code, 'BUILD_SHELL_FILES', JSON.stringify(precache));
				worker.code = fillPlaceholder(worker.code, 'BUILD_SHELL_VERSION', JSON.stringify(version));
			}
		}
	];
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd());

	return {
		plugins: [react(), tailwindcss(), site(env.VITE_SITE_NOINDEX !== 'true')],
		server: { proxy },
		preview: { proxy },
		resolve: {
			alias: {
				'@': fileURLToPath(new URL('./src', import.meta.url))
			}
		}
	};
});
