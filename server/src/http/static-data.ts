import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream';
import { createGunzip } from 'node:zlib';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/** What an import writes under `<DATA_DIR>/out`; nothing else in there is served. */
const SERVED = [
	{ route: '/catalog.json', file: 'catalog.json', cache: 'no-cache' },
	{ route: '/snapshots/*', dir: 'snapshots', cache: 'public, max-age=300, must-revalidate' },
	{ route: '/events/*', dir: 'events', cache: 'public, max-age=300, must-revalidate' }
] as const;

const FILE_NAME = /^[\w.-]+$/;

const CONTENT_TYPES = new Map([
	['.json', 'application/json; charset=utf-8'],
	['.ndjson', 'application/x-ndjson; charset=utf-8'],
	['.jsonl', 'application/x-ndjson; charset=utf-8']
]);

/**
 * Serves the import's output in development. Production puts a CDN in front of the same
 * folder, so these headers are what the CDN would be told: a `.gz` file keeps its gzip encoding
 * for clients that accept it and is unpacked for those that do not, and every response carries
 * an ETag so a repeat visit costs a 304.
 */
export function registerStaticData(app: FastifyInstance, dataDir: string) {
	const outDir = path.join(dataDir, 'out');

	for (const entry of SERVED) {
		app.get(entry.route, async (request: FastifyRequest<{ Params: { '*'?: string } }>, reply) => {
			const name = 'file' in entry ? entry.file : request.params['*'];

			if (
				name === undefined ||
				!name.split('/').every((part) => FILE_NAME.test(part) && !part.startsWith('.'))
			) {
				return reply.code(404).send({ error: 'not found' });
			}

			const file = path.join(outDir, 'dir' in entry ? entry.dir : '', name);

			return sendFile(request, reply, file, entry.cache);
		});
	}
}

async function sendFile(request: FastifyRequest, reply: FastifyReply, file: string, cache: string) {
	const info = await stat(file).catch(() => null);

	if (!info?.isFile()) {
		return reply.code(404).send({ error: 'not found' });
	}

	const etag = `W/"${info.size.toString(16)}-${Math.round(info.mtimeMs).toString(16)}"`;

	void reply
		.header('ETag', etag)
		.header('Cache-Control', cache)
		.header('Last-Modified', info.mtime.toUTCString());
	void reply.header('Vary', 'Accept-Encoding');

	if (request.headers['if-none-match']?.split(/,\s*/).some((tag) => tag === etag || tag === '*')) {
		return reply.code(304).send();
	}

	const gzipped = file.endsWith('.gz');

	const contentType =
		CONTENT_TYPES.get(path.extname(gzipped ? file.slice(0, -3) : file)) ??
		'application/octet-stream';

	const stream = createReadStream(file);

	void reply.header('Content-Type', contentType);

	if (!gzipped) {
		return reply.header('Content-Length', info.size).send(stream);
	}

	if (/\bgzip\b/.test(request.headers['accept-encoding'] ?? '')) {
		return reply
			.header('Content-Encoding', 'gzip')
			.header('Content-Length', info.size)
			.send(stream);
	}

	return reply.send(pipeline(stream, createGunzip(), () => undefined));
}
