import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { FEED_TOPICS, LIVE_TIMING_URL, LiveFeed } from '../sources/f1/live.js';
import type { EventLog } from '../sources/f1/live.js';
import { RawWriter } from '../sources/f1/raw-writer.js';

const DEFAULT_OUT_DIR = fileURLToPath(new URL('../../../data/raw/', import.meta.url));

const { values } = parseArgs({
	options: {
		out: { type: 'string', default: DEFAULT_OUT_DIR },
		url: { type: 'string', default: LIVE_TIMING_URL },
		'stall-seconds': { type: 'string', default: '30' }
	}
});

const stallMs = Number(values['stall-seconds']) * 1000;

if (!Number.isFinite(stallMs) || stallMs <= 0) {
	throw new Error(`--stall-seconds must be a positive number, got ${values['stall-seconds']}`);
}

const log: EventLog = (event, fields) => {
	process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), event, ...fields })}\n`);
};

const writer = new RawWriter(values.out, log);

const feed = new LiveFeed(
	{
		url: values.url,
		topics: FEED_TOPICS,
		stallMs,
		backoff: { initialMs: 1000, maxMs: 30_000 },
		statsIntervalMs: 60_000,
		log,
		accessToken: process.env.LIVETIMING_ACCESS_TOKEN
	},
	{
		onSnapshot: (snapshot) => writer.writeSnapshot(snapshot),
		onFrame: (frame) => writer.writeFrame(frame)
	}
);

const stop = new AbortController();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.once(signal, () => {
		log('stopping', { signal });
		stop.abort();
	});
}

log('recorder-started', { out: values.out, url: values.url, stallMs });

await feed.run(stop.signal);

writer.close();

log('recorder-stopped');
