import { parseArgs } from 'node:util';

import { formatReport, hashOutputs } from '../import/report.js';
import { runImport } from '../import/run.js';
import { DEFAULT_DATA_DIR } from '../sinks/files.js';

const { values } = parseArgs({
	allowNegative: true,
	options: {
		'data-dir': { type: 'string' },
		now: { type: 'string' },
		telemetry: { type: 'boolean', default: true }
	}
});

const dataDir = values['data-dir'] ?? process.env.DATA_DIR ?? DEFAULT_DATA_DIR;

const now = values.now === undefined ? new Date() : new Date(values.now);

if (Number.isNaN(now.getTime())) {
	throw new Error(`--now must be an ISO time, got ${values.now}`);
}

function log(message: string): void {
	process.stdout.write(`${message}\n`);
}

// No network: every output is derived again from the raw files and the saved OpenF1 results.
const report = await runImport(
	{ kind: 'local' },
	{ dataDir, offline: true, telemetry: values.telemetry, now, log }
);

log(`\n${formatReport(report, await hashOutputs(dataDir))}`);

process.exitCode = report.outcomes.some((outcome) => outcome.failure !== null) ? 1 : 0;
