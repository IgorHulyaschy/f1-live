/**
 * Serves a production build the way a static host does (plan 2 recommends Cloudflare Pages or
 * Vercel): HTTP/2 over TLS, Brotli where the browser accepts it, and index.html for every app
 * route. Vite's preview speaks HTTP/1.1 and only gzips, which would measure the first load slower
 * than production delivers it. The certificate is a throwaway one for localhost, made with
 * openssl at start; the browser must be told to accept it (--ignore-certificate-errors).
 *
 * It listens on 127.0.0.1 at a port the system picks: a fixed port, or the name `localhost`,
 * could reach another checkout's dev server on the same machine instead (scripts/budgets.ts).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { createSecureServer } from 'node:http2';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';

const TYPES: ReadonlyMap<string, string> = new Map([
	['.html', 'text/html; charset=utf-8'],
	['.js', 'text/javascript; charset=utf-8'],
	['.css', 'text/css; charset=utf-8'],
	['.json', 'application/json'],
	['.webmanifest', 'application/manifest+json'],
	['.svg', 'image/svg+xml'],
	['.png', 'image/png'],
	['.woff2', 'font/woff2'],
	['.txt', 'text/plain; charset=utf-8'],
	['.xml', 'application/xml']
]);

/** Fonts and pictures are compressed already and go as they are. */
const COMPRESSIBLE = new Set([
	'.html',
	'.js',
	'.css',
	'.json',
	'.webmanifest',
	'.svg',
	'.txt',
	'.xml'
]);

/** Compressed once at start, as a host does at deploy, so no request waits on Brotli level 11. */
async function compressAll(dir: string): Promise<Map<string, Buffer>> {
	const files = await readdir(dir, { recursive: true });
	const compressed = new Map<string, Buffer>();

	await Promise.all(
		files
			.filter((file) => COMPRESSIBLE.has(extname(file)))
			.map(async (file) => {
				const path = join(dir, file);

				compressed.set(
					path,
					brotliCompressSync(await readFile(path), {
						params: { [constants.BROTLI_PARAM_QUALITY]: 11 }
					})
				);
			})
	);

	return compressed;
}

function localhostCertificate() {
	const folder = mkdtempSync(join(tmpdir(), 'serve-dist-'));
	const key = join(folder, 'key.pem');
	const cert = join(folder, 'cert.pem');

	const made = spawnSync('openssl', [
		'req',
		'-x509',
		'-newkey',
		'ec',
		'-pkeyopt',
		'ec_paramgen_curve:prime256v1',
		'-nodes',
		'-days',
		'1',
		'-subj',
		'/CN=localhost',
		'-keyout',
		key,
		'-out',
		cert
	]);

	if (made.status !== 0) {
		throw new Error(`openssl could not make a localhost certificate: ${made.stderr}`);
	}

	const pair = { key: readFileSync(key), cert: readFileSync(cert) };

	rmSync(folder, { recursive: true });

	return pair;
}

async function fileFor(dir: string, pathname: string): Promise<string> {
	const path = join(dir, normalize(pathname));

	try {
		if ((await stat(path)).isFile()) {
			return path;
		}
	} catch {
		// Not a file: an app route, answered by the single-page app.
	}

	return join(dir, 'index.html');
}

export type DistServer = { origin: string; close: () => Promise<void> };

export async function serveDist(dir: string): Promise<DistServer> {
	const brotli = await compressAll(dir);

	const server = createSecureServer(
		{ ...localhostCertificate(), allowHTTP1: true },
		async (request, response) => {
			// The URL parser has already resolved `..` and kept percent escapes, so this stays in dir.
			const { pathname } = new URL(request.url, 'https://localhost');
			const path = await fileFor(dir, pathname);
			const extension = extname(path);

			response.setHeader('content-type', TYPES.get(extension) ?? 'application/octet-stream');
			response.setHeader(
				'cache-control',
				pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'
			);

			const compressed = brotli.get(path);

			if (!compressed || !/\bbr\b/.test(request.headers['accept-encoding'] ?? '')) {
				response.end(await readFile(path));

				return;
			}

			response.setHeader('content-encoding', 'br');
			response.setHeader('vary', 'accept-encoding');
			response.end(compressed);
		}
	);

	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});

	// SAFETY: a server listening on a TCP host and port reports an AddressInfo, not a pipe name.
	const { port } = server.address() as AddressInfo;

	return {
		origin: `https://127.0.0.1:${port}`,
		close: () => new Promise((resolve) => server.close(() => resolve()))
	};
}
