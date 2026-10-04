import { parseArgs } from 'node:util';

import { DEFAULT_DATA_DIR } from '../sinks/files.js';
import { fetchDocuments, fetchListings } from '../sources/fia/fetch-decisions.js';
import { FIA_SEASON_PAGES } from '../sources/fia/listing.js';
import { writeDecisions } from '../sources/fia/write-decisions.js';

const { values } = parseArgs({
	options: {
		'data-dir': { type: 'string' },
		season: { type: 'string', multiple: true },
		refresh: { type: 'boolean' },
		offline: { type: 'boolean' }
	}
});

const dataDir = values['data-dir'] ?? process.env.DATA_DIR ?? DEFAULT_DATA_DIR;

const seasons = values.season?.map(Number) ?? [...FIA_SEASON_PAGES.keys()];

if (!values.offline) {
	await fetchListings(dataDir, seasons, values.refresh ?? false);

	const { read, failed } = await fetchDocuments(dataDir, seasons, (line) =>
		process.stdout.write(`${line}\n`)
	);

	process.stdout.write(`read ${read} documents, ${failed} to try again\n`);
}

for (const [season, count] of await writeDecisions(dataDir, seasons)) {
	process.stdout.write(`${season}: ${count} decisions\n`);
}
