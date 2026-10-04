import path from 'node:path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

import { z } from 'zod';

import { buildTelemetry } from './build.js';
import type { BuildOptions, TelemetryReport } from './build.js';

const workerDataSchema = z.object({
	telemetryBuild: z.object({
		rawDir: z.string(),
		streamsDir: z.string().optional(),
		key: z.number().int(),
		dataDir: z.string()
	})
});

/** The worker runs this same file, in TypeScript under tsx and compiled in production. */
const WORKER_FILE = new URL(`./build-worker${path.extname(import.meta.filename)}`, import.meta.url);

/**
 * Builds a session's telemetry on another thread: a race takes a quarter of a minute of CPU,
 * which on the server's own thread would stall every viewer.
 */
export function buildInWorker(
	options: Omit<BuildOptions, 'log' | 'rebuildOutline'>
): Promise<TelemetryReport> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(WORKER_FILE, { workerData: { telemetryBuild: options } });

		// A build under way does not hold the server open at shutdown.
		worker.unref();
		worker.once('message', resolve);
		worker.once('error', reject);
		worker.once('exit', (code) =>
			reject(new Error(`the telemetry build stopped with code ${code}`))
		);
	});
}

// Another worker that imports this file carries no build.
const job = isMainThread ? null : workerDataSchema.safeParse(workerData);

if (job?.success === true) {
	// oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker port, not a window.
	parentPort?.postMessage(await buildTelemetry(job.data.telemetryBuild));
}
