import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { loadConfig } from '../config.js';
import { buildTelemetry } from '../telemetry/build.js';
import { readOutline } from '../telemetry/files.js';
import { findRawSession } from '../telemetry/locate.js';
import { renderOutlineSvg } from '../telemetry/svg.js';

const USAGE =
	'Usage: npm run telemetry -w server -- --key <session key> [--from-dir <raw session dir>] [--rebuild-outline] [--svg <file>]';

const { values } = parseArgs({
	options: {
		key: { type: 'string' },
		'from-dir': { type: 'string' },
		'rebuild-outline': { type: 'boolean', default: false },
		svg: { type: 'string' }
	}
});

const key = Number(values.key);

if (!Number.isInteger(key) || key <= 0) {
	throw new Error(USAGE);
}

const { dataDir } = loadConfig();

const rawDir = values['from-dir'] ?? (await findRawSession(path.join(dataDir, 'raw'), key));

if (rawDir === null || rawDir === undefined) {
	throw new Error(
		`No raw session ${key} under ${dataDir}/raw; fetch it with npm run fetch:f1 -w server -- ${key}`
	);
}

const report = await buildTelemetry({
	rawDir: path.resolve(rawDir),
	key,
	dataDir,
	rebuildOutline: values['rebuild-outline']
});

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (report.status === 'built' && values.svg !== undefined) {
	const outline = await readOutline(dataDir, report.circuitKey);

	if (outline !== null) {
		await mkdir(path.dirname(path.resolve(values.svg)), { recursive: true });
		await writeFile(values.svg, renderOutlineSvg(outline));
	}
}
