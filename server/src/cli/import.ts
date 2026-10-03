import { parseImportArguments } from '../import/args.js';
import { formatReport, hashOutputs } from '../import/report.js';
import { runImport } from '../import/run.js';

const { selection, dataDir, offline, now } = parseImportArguments(
	process.argv.slice(2),
	process.env
);

function log(message: string): void {
	process.stdout.write(`${message}\n`);
}

const report = await runImport(selection, { dataDir, offline, now, log });

log(`\n${formatReport(report, await hashOutputs(dataDir))}`);

// The report lists each failed session; the exit code says some need a look.
process.exitCode = report.outcomes.some((outcome) => outcome.failure !== null) ? 1 : 0;
