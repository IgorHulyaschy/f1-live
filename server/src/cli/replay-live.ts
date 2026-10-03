import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { loadConfig } from '../config.js';
import { F1_TOPICS } from '../sources/f1/decode.js';
import { FakeUpstream } from '../live/fake-upstream.js';
import { findSavedSession, loadReplayFrames } from '../live/replay.js';
import { createServer } from '../main.js';

const { values } = parseArgs({
	options: {
		key: { type: 'string' },
		dir: { type: 'string' },
		speed: { type: 'string', default: '10' },
		import: { type: 'boolean', default: false },
		'decoder-topics': { type: 'boolean', default: false }
	}
});

const usage =
	'Usage: npm run replay-live -w server -- (--key <session key> | --dir <session folder>) [--speed 10] [--import] [--decoder-topics]';

const speed = Number(values.speed);

if (!(speed > 0)) {
	throw new Error(`--speed must be a positive number. ${usage}`);
}

const base = loadConfig();

const rawDir = path.join(base.dataDir, 'raw');

const directory =
	values.dir ?? (values.key ? await findSavedSession(rawDir, Number(values.key)) : null);

if (!directory) {
	throw new Error(
		values.key
			? `Session ${values.key} is not in ${rawDir}; run npm run fetch:f1 -w server -- ${values.key}`
			: usage
	);
}

const frames = await loadReplayFrames(directory, values['decoder-topics'] ? F1_TOPICS : undefined);

const upstream = await FakeUpstream.start(frames, { speed });

// The replay's own recording stays out of data/raw: the saved session it plays is already there.
const recordings = await mkdtemp(path.join(tmpdir(), 'replay-live-'));

const server = await createServer(
	{
		...base,
		mode: 'all',
		live: { ...base.live, url: upstream.url, importOnFinish: values.import }
	},
	{ now: upstream.now, rawDir: recordings }
);

const address = await server.listen();

server.app.log.info(
	{ directory, frames: frames.length, speed, recordings },
	`replaying; viewers connect to ${address}`
);

void upstream.done.then(() =>
	server.app.log.info('replay finished; the server keeps the final state')
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.once(signal, () => {
		void server
			.close()
			.then(() => upstream.close())
			.then(() => process.exit(0));
	});
}
