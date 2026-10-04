import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fetchText } from './fetch-decisions.js';

const answering = (status: number) => () => Promise.resolve(new Response('', { status }));

describe('reading a decision document', () => {
	it('gives up on a document the FIA no longer serves', async () => {
		assert.equal(await fetchText('https://www.fia.com/a.pdf', answering(404)), null);
	});

	for (const status of [403, 429, 503]) {
		it(`throws on ${status}, so the document is tried again on the next run`, async () => {
			await assert.rejects(fetchText('https://www.fia.com/a.pdf', answering(status)), {
				message: `status ${status}`
			});
		});
	}
});
