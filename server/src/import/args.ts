import { parseArgs } from 'node:util';

import { DEFAULT_DATA_DIR } from '../sinks/files.js';
import type { Selection } from './select.js';

export interface ImportArguments {
	selection: Selection;
	dataDir: string;
	offline: boolean;
	/** Overrides the clock, for sessions' status in the catalog. */
	now: Date;
}

const USAGE = `Usage: npm run import -w server -- <year[,year]> [meeting name]
       npm run import -w server -- --key <session key>
       npm run import -w server -- --from-dir <raw root> [--key <session key>]
Options: --data-dir <dir> (default data/, or DATA_DIR), --offline, --now <ISO time>`;

/** Reads the import command line; throws the usage text when it does not make sense. */
export function parseImportArguments(
	argv: readonly string[],
	env: Readonly<Record<string, string | undefined>>
): ImportArguments {
	const { values, positionals } = parseArgs({
		args: [...argv],
		allowPositionals: true,
		options: {
			key: { type: 'string' },
			'from-dir': { type: 'string' },
			'data-dir': { type: 'string' },
			offline: { type: 'boolean', default: false },
			now: { type: 'string' }
		}
	});

	const key = values.key === undefined ? undefined : Number(values.key);

	if (key !== undefined && !Number.isInteger(key)) {
		throw new Error(`--key must be a whole number, got ${values.key}\n${USAGE}`);
	}

	const now = values.now === undefined ? new Date() : new Date(values.now);

	if (Number.isNaN(now.getTime())) {
		throw new Error(`--now must be an ISO time, got ${values.now}\n${USAGE}`);
	}

	return {
		selection: selectionOf(values['from-dir'], key, positionals),
		dataDir: values['data-dir'] ?? env.DATA_DIR ?? DEFAULT_DATA_DIR,
		offline: values.offline,
		now
	};
}

function selectionOf(
	fromDir: string | undefined,
	key: number | undefined,
	positionals: readonly string[]
): Selection {
	if (fromDir !== undefined) {
		return key === undefined
			? { kind: 'fromDir', root: fromDir }
			: { kind: 'fromDir', root: fromDir, key };
	}

	if (key !== undefined) {
		return { kind: 'key', key };
	}

	const [first = '', ...rest] = positionals;
	const years = first.split(',').map(Number);

	if (years.length === 0 || years.some((year) => !Number.isInteger(year) || year < 2018)) {
		throw new Error(`Give a season such as 2025, or --key or --from-dir\n${USAGE}`);
	}

	const meeting = rest.join(' ').trim();

	return meeting === '' ? { kind: 'meeting', years } : { kind: 'meeting', years, meeting };
}
