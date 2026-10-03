/**
 * Load smoke: starts `replay-live` as a child process, connects many WebSocket viewers from
 * worker processes and reports how long events take from being applied on the server to being
 * received, plus the server's memory. Both sides run on this machine, so the clocks agree.
 *
 *   npm run load-smoke -w server -- --key 9858 --viewers 1000 --speed 120 --seconds 80
 */
import { execFile, fork, spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';

import { WebSocket } from 'ws';
import { z } from 'zod';

const run = promisify(execFile);

const { values } = parseArgs({
	options: {
		key: { type: 'string', default: '9858' },
		viewers: { type: 'string', default: '1000' },
		workers: { type: 'string', default: '4' },
		speed: { type: 'string', default: '120' },
		seconds: { type: 'string', default: '80' },
		port: { type: 'string', default: '3917' },
		worker: { type: 'string' },
		url: { type: 'string' }
	}
});

const SELF = fileURLToPath(import.meta.url);

const REPLAY = fileURLToPath(new URL('./replay-live.ts', import.meta.url));

/** Viewers per second a worker opens, so the connect storm does not dominate the result. */
const CONNECT_PER_SECOND = 400;

const eventsAtSchema = z.coerce.number();

const healthSchema = z.object({ seq: z.number() });

const workerResultSchema = z.object({
	latenciesMs: z.array(z.number()),
	connected: z.number(),
	dropped: z.number(),
	messages: z.number(),
	bytes: z.number(),
	firstStateBytes: z.number(),
	connectsMs: z.array(z.number())
});

type WorkerResult = z.infer<typeof workerResultSchema>;

async function worker(url: string, viewers: number, seconds: number) {
	const result: WorkerResult = {
		latenciesMs: [],
		connected: 0,
		dropped: 0,
		messages: 0,
		bytes: 0,
		firstStateBytes: 0,
		connectsMs: []
	};

	const sockets: WebSocket[] = [];

	for (let index = 0; index < viewers; index += 1) {
		const startedAt = Date.now();
		const socket = new WebSocket(url);
		let first = true;

		socket.on('open', () => {
			result.connected += 1;
		});
		socket.on('message', (data) => {
			const received = Date.now();
			const text = data.toString();

			result.messages += 1;
			result.bytes += text.length;

			if (first) {
				first = false;
				result.firstStateBytes = Math.max(result.firstStateBytes, text.length);
				result.connectsMs.push(received - startedAt);

				return;
			}

			// `at` is the 5th field of an events message, well inside the first 200 characters.
			const at = /^\{"v":1,"type":"events".{0,120}?"at":(\d+)/.exec(text.slice(0, 200))?.[1];

			if (at !== undefined) {
				result.latenciesMs.push(received - eventsAtSchema.parse(at));
			}
		});
		socket.on('close', () => {
			if (Date.now() - startedAt < seconds * 1000) {
				result.dropped += 1;
			}
		});
		socket.on('error', () => undefined);
		sockets.push(socket);

		if ((index + 1) % (CONNECT_PER_SECOND / 10) === 0) {
			// oxlint-disable-next-line no-await-in-loop -- paces the connections.
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	await new Promise((resolve) => setTimeout(resolve, seconds * 1000));

	for (const socket of sockets) {
		socket.terminate();
	}

	process.send?.(result, () => process.exit(0));
}

function percentile(sorted: readonly number[], fraction: number): number {
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? Number.NaN;
}

async function rssMb(pid: number): Promise<number> {
	const { stdout } = await run('ps', ['-o', 'rss=', '-p', String(pid)]);

	return Math.round(Number(stdout.trim()) / 1024);
}

function spread(results: readonly WorkerResult[]) {
	const sorted = results.flatMap((result) => result.connectsMs).toSorted((a, b) => a - b);

	return { p50: percentile(sorted, 0.5), p95: percentile(sorted, 0.95), max: sorted.at(-1) };
}

function runWorkers(viewers: number, workers: number, port: string, seconds: number) {
	const share = Math.ceil(viewers / workers);

	return Promise.all(
		Array.from({ length: workers }, (_, index) => {
			const count = Math.min(share, viewers - index * share);

			return new Promise<WorkerResult>((resolve, reject) => {
				const child = fork(
					SELF,
					[
						'--worker',
						String(count),
						'--url',
						`ws://127.0.0.1:${port}/live`,
						'--seconds',
						String(seconds)
					],
					{ execArgv: ['--import', 'tsx'] }
				);

				child.once('message', (message) => resolve(workerResultSchema.parse(message)));
				child.once('error', reject);
			});
		})
	);
}

/** Waits for the replay to stop producing events. */
async function untilQuiet(baseUrl: string) {
	let last = -1;

	for (;;) {
		// oxlint-disable-next-line no-await-in-loop -- polls.
		const { seq } = healthSchema.parse(await (await fetch(`${baseUrl}/health`)).json());

		if (seq === last) {
			return;
		}

		last = seq;
		// oxlint-disable-next-line no-await-in-loop -- see above.
		await new Promise((resolve) => setTimeout(resolve, 3000));
	}
}

async function untilHealthy(baseUrl: string) {
	for (let attempt = 0; attempt < 100; attempt += 1) {
		// oxlint-disable-next-line no-await-in-loop -- polls until the server is up.
		const up = await fetch(`${baseUrl}/health`).then(
			(response) => response.ok,
			() => false
		);

		if (up) {
			return;
		}

		// oxlint-disable-next-line no-await-in-loop -- see above.
		await new Promise((resolve) => setTimeout(resolve, 200));
	}

	throw new Error('the replay server did not come up');
}

async function main() {
	const viewers = Number(values.viewers);
	const workers = Math.min(Number(values.workers), viewers);
	const seconds = Number(values.seconds);

	if (values.worker !== undefined && values.url !== undefined) {
		await worker(values.url, Number(values.worker), seconds);

		return;
	}

	const port = values.port ?? '3917';
	const baseUrl = `http://127.0.0.1:${port}`;

	const server: ChildProcess = spawn(
		process.execPath,
		[
			'--import',
			'tsx',
			REPLAY,
			'--key',
			values.key ?? '9858',
			'--speed',
			values.speed ?? '120',
			'--decoder-topics'
		],
		{
			env: { ...process.env, PORT: port, LOG_LEVEL: 'warn' },
			stdio: ['ignore', 'inherit', 'inherit']
		}
	);

	try {
		await untilHealthy(baseUrl);

		const pid = server.pid ?? 0;
		const before = await rssMb(pid);
		const peak = { rssMb: before };

		const sampler = setInterval(async () => {
			peak.rssMb = Math.max(peak.rssMb, await rssMb(pid));
		}, 1000);

		const results = await runWorkers(viewers, workers, port, seconds);

		clearInterval(sampler);

		// Everyone arrives again once the race is over, as a crowd does for the result.
		await untilQuiet(baseUrl);

		const late = await runWorkers(viewers, workers, port, 5);

		const health = healthSchema.parse(await (await fetch(`${baseUrl}/health`)).json());
		const latencies = results.flatMap((result) => result.latenciesMs).toSorted((a, b) => a - b);

		process.stdout.write(
			`${JSON.stringify(
				{
					viewersRequested: viewers,
					viewersConnected: results.reduce((sum, result) => sum + result.connected, 0),
					viewersDroppedMidRun: results.reduce((sum, result) => sum + result.dropped, 0),
					replaySpeed: Number(values.speed),
					seconds,
					eventsMessages: latencies.length,
					latencyMs: {
						p50: percentile(latencies, 0.5),
						p95: percentile(latencies, 0.95),
						p99: percentile(latencies, 0.99),
						max: latencies.at(-1)
					},
					joinAtStart: {
						stateKiB: Math.round(
							Math.max(...results.map((result) => result.firstStateBytes)) / 1024
						),
						msToFirstState: spread(results)
					},
					joinAtEnd: {
						viewers: late.reduce((sum, result) => sum + result.connected, 0),
						stateKiB: Math.round(Math.max(...late.map((result) => result.firstStateBytes)) / 1024),
						msToFirstState: spread(late)
					},
					receivedMiB: Math.round(
						results.reduce((sum, result) => sum + result.bytes, 0) / 1024 / 1024
					),
					serverRssMb: { beforeViewers: before, peak: peak.rssMb },
					serverSeq: health.seq
				},
				null,
				2
			)}\n`
		);
	} finally {
		server.kill('SIGTERM');
	}
}

await main();
