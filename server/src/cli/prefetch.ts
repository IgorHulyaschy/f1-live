import { parseArgs } from 'node:util';

import { SESSION_TYPES } from '@f1-live/shared';
import { z } from 'zod';

import { loadConfig } from '../config.js';
import { GB } from '../pkg/disk.js';
import { buildTelemetry } from '../telemetry/build.js';
import { readLedger } from '../telemetry/cache.js';
import { indexedSessions } from '../telemetry/on-demand.js';
import { prefetch, selectSessions } from '../telemetry/prefetch.js';

const USAGE =
	'Usage: npm run prefetch -w server -- (<year> [--type race|sprint|qualifying|sprint_qualifying|practice] | --key <key>[,<key>]) [--cap-gb <n>] [--floor-gb <n>]';

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		type: { type: 'string', multiple: true },
		key: { type: 'string' },
		'cap-gb': { type: 'string' },
		'floor-gb': { type: 'string' }
	}
});

const argsSchema = z.object({
	year: z.coerce.number().int().min(2018).max(2024).optional(),
	types: z.array(z.enum(SESSION_TYPES)).optional(),
	keys: z.array(z.coerce.number().int().positive()).optional(),
	capGb: z.coerce.number().positive().optional(),
	floorGb: z.coerce.number().min(0).optional()
});

const args = argsSchema.safeParse({
	year: positionals[0],
	types: values.type,
	keys: values.key?.split(','),
	capGb: values['cap-gb'],
	floorGb: values['floor-gb']
});

if (!args.success || (args.data.year === undefined) === (args.data.keys === undefined)) {
	throw new Error(USAGE);
}

const config = loadConfig();

const { dataDir } = config;

const settings = {
	dataDir,
	archiveUrl: config.telemetryCache.archiveUrl,
	capBytes: (args.data.capGb ?? config.telemetryCache.capBytes / GB) * GB,
	floorBytes: (args.data.floorGb ?? config.telemetryCache.floorBytes / GB) * GB,
	build: buildTelemetry
};

const sessions = selectSessions((await indexedSessions(dataDir)).values(), args.data);

if (sessions.length === 0) {
	throw new Error(`No imported session matches; import the season first: npm run import -w server`);
}

const result = await prefetch(sessions, settings, (line) => {
	process.stdout.write(
		`${line.key} ${line.state} ${line.name}${line.detail === null ? '' : `: ${line.detail}`}\n`
	);
});

const cached = await readLedger(dataDir);

const total = cached.reduce((sum, session) => sum + session.bytes, 0);

for (const line of result.lines.filter((done) => done.state === 'ready')) {
	const bytes = cached.find((session) => session.key === line.key)?.bytes ?? 0;

	process.stdout.write(`${line.key} ${(bytes / 1e6).toFixed(1)} MB\n`);
}

process.stdout.write(
	`The cache holds ${cached.length} sessions, ${(total / GB).toFixed(2)} GB of ${(settings.capBytes / GB).toFixed(1)} GB.\n`
);

if (result.stopped !== null) {
	process.stderr.write(`Stopped: ${result.stopped}\n`);
}

if (result.stopped !== null || result.lines.some((line) => line.state === 'failed')) {
	process.exitCode = 1;
}
