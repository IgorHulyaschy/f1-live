import { gzipSync } from 'node:zlib';

/**
 * What the browser must fetch before the first route can run: the entry script, the chunks it
 * preloads and the stylesheets, as Vite writes them into index.html. Lazy routes and tiles load
 * later and are not counted.
 */
export type InitialAssets = { scripts: string[]; styles: string[] };

export function initialAssets(html: string): InitialAssets {
	const scripts = [
		...html.matchAll(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/g),
		...html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/g)
	].map((match) => match[1] ?? '');

	const styles = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)].map(
		(match) => match[1] ?? ''
	);

	return { scripts, styles };
}

export function gzipKilobytes(source: Buffer): number {
	return gzipSync(source, { level: 9 }).byteLength / 1024;
}
