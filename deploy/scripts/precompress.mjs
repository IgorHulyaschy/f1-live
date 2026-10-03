// Writes a .br and a .gz next to every compressible file in a build folder, so a static server
// can send them as they are (Caddy's `precompressed`, or a CDN that looks for them).
// Usage: node deploy/scripts/precompress.mjs client/dist
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { brotliCompress, constants, gzip } from 'node:zlib';
import { promisify } from 'node:util';

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json', '.txt', '.map', '.xml']);

/** Below this a compressed copy saves nothing worth a second file. */
const MIN_BYTES = 256;

const brotli = promisify(brotliCompress);

const gz = promisify(gzip);

async function* files(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const file = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			yield* files(file);
		} else {
			yield file;
		}
	}
}

const root = process.argv[2];

if (!root || !(await stat(root).catch(() => null))?.isDirectory()) {
	console.error('Usage: node deploy/scripts/precompress.mjs <build folder>');
	process.exit(1);
}

let count = 0;

for await (const file of files(root)) {
	if (!COMPRESSIBLE.has(path.extname(file))) {
		continue;
	}

	const body = await readFile(file);

	if (body.length < MIN_BYTES) {
		continue;
	}

	await writeFile(
		`${file}.br`,
		await brotli(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })
	);
	await writeFile(`${file}.gz`, await gz(body, { level: 9 }));
	count++;
}

process.stdout.write(`precompressed ${count} files in ${root}\n`);
