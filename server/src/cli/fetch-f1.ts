import { parseArgs } from 'node:util';

import { fetchSession, findSession } from '../sources/f1/fetch-archive.js';

const { positionals: keys } = parseArgs({ allowPositionals: true });

if (keys.length === 0) {
	throw new Error('Usage: npm run fetch:f1 -w server -- <session key>...');
}

await Promise.all(
	keys.map(async (key) => {
		const session = await findSession(Number(key));
		const directory = await fetchSession(session);

		process.stdout.write(`${session.title}: ${directory}\n`);
	})
);
