import { createWriteStream } from 'node:fs';
import { access, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { ArchiveMissing, TELEMETRY_STREAMS } from '../import/fetch.js';
import { fetchPolitely } from '../pkg/http.js';

export interface StreamsProgress {
	receivedBytes: number;
	/** Null until every answer has said its length, or when one does not. */
	totalBytes: number | null;
}

export interface FetchStreamsOptions {
	baseUrl: string;
	archivePath: string;
	/** Where the streams go, under their archive names. */
	directory: string;
	/** Called once the answers say how much is coming, before any byte is written; throws to stop. */
	beforeWrite?: (totalBytes: number | null) => Promise<void> | void;
	onProgress?: (progress: StreamsProgress) => void;
}

export interface FetchedStreams {
	/** The streams the folder holds now. */
	files: string[];
	/** Bytes this call wrote. */
	bytes: number;
}

async function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false
	);
}

/**
 * Downloads a session's positions and car data, as the archive serves them, into `directory`; a
 * stream already there is kept. Throws `ArchiveMissing` when the archive holds no positions for
 * the session; missing car data alone is fine.
 */
export async function fetchTelemetryStreams(options: FetchStreamsOptions): Promise<FetchedStreams> {
	const { baseUrl, archivePath, directory, beforeWrite, onProgress } = options;

	const saved = await Promise.all(
		TELEMETRY_STREAMS.map((file) => exists(path.join(directory, file)))
	);

	const wanted = TELEMETRY_STREAMS.filter((_, index) => !saved[index]);

	const answers = await Promise.all(
		wanted.map(async (file) => ({
			file,
			response: await fetchPolitely(`${baseUrl}/${archivePath}/${file}`)
		}))
	);

	const cancelAll = () => Promise.all(answers.map(({ response }) => response.body?.cancel()));

	const served = answers.filter(
		({ response }) => response.status !== 403 && response.status !== 404
	);

	const failed = served.find(({ response }) => !response.ok || response.body === null);

	if (failed !== undefined) {
		await cancelAll();
		throw new Error(`GET ${failed.response.url} answered ${failed.response.status}`);
	}

	if (!saved[0] && !served.some(({ file }) => file === TELEMETRY_STREAMS[0])) {
		await cancelAll();
		throw new ArchiveMissing(`${baseUrl}/${archivePath}/ holds no ${TELEMETRY_STREAMS[0]}`);
	}

	const lengths = served.map(({ response }) => Number(response.headers.get('content-length')));

	const totalBytes = lengths.every((length) => length > 0)
		? lengths.reduce((sum, length) => sum + length, 0)
		: null;

	try {
		await beforeWrite?.(totalBytes);
	} catch (error) {
		await cancelAll();
		throw error;
	}

	await mkdir(directory, { recursive: true });

	let receivedBytes = 0;

	onProgress?.({ receivedBytes, totalBytes });

	const bodies = served.flatMap(({ file, response }) =>
		response.body === null ? [] : [{ file, body: response.body }]
	);

	await Promise.all(
		bodies.map(async ({ file, body }) => {
			const target = path.join(directory, file);
			const partial = `${target}.part`;

			const count = new Transform({
				transform(chunk: Buffer, _encoding, done) {
					receivedBytes += chunk.length;
					onProgress?.({ receivedBytes, totalBytes });
					done(null, chunk);
				}
			});

			try {
				// The archive's bytes as served, BOM included, as every other saved stream.
				await pipeline(Readable.fromWeb(body), count, createWriteStream(partial));
				await rename(partial, target);
			} catch (error) {
				await rm(partial, { force: true });
				throw error;
			}
		})
	);

	const present = await Promise.all(
		TELEMETRY_STREAMS.map((file) => exists(path.join(directory, file)))
	);

	return { files: TELEMETRY_STREAMS.filter((_, index) => present[index]), bytes: receivedBytes };
}
