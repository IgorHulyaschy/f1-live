import { parseArgs } from 'node:util';

import { readSeasonResults } from '../results/season.js';
import { DEFAULT_DATA_DIR, factsPathOf, writeAtomic } from '../sinks/files.js';
import { buildFacts, fetchFacts } from '../sources/wikidata/fetch-facts.js';
import { unmappedIds } from '../sources/wikidata/ids.js';

const { values } = parseArgs({
	options: {
		'data-dir': { type: 'string' },
		refresh: { type: 'boolean' },
		offline: { type: 'boolean' }
	}
});

const dataDir = values['data-dir'] ?? process.env.DATA_DIR ?? DEFAULT_DATA_DIR;

const unmapped = unmappedIds(await readSeasonResults(dataDir));

if (unmapped.drivers.length + unmapped.circuits.length > 0) {
	throw new Error(`Add these to server/src/sources/wikidata/ids.ts: ${JSON.stringify(unmapped)}`);
}

if (!values.offline) {
	process.stdout.write(`fetched ${await fetchFacts(dataDir, values.refresh)} Wikidata items\n`);
}

const facts = await buildFacts(dataDir, new Date());

await writeAtomic(factsPathOf(dataDir), JSON.stringify(facts));

process.stdout.write(
	`${Object.keys(facts.drivers).length} drivers and ${Object.keys(facts.circuits).length} circuits: ${factsPathOf(dataDir)}\n`
);
