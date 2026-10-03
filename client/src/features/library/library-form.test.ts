import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handleProblem, parseTags, tagLineProblem } from './library-form.ts';

describe('parseTags', () => {
	it('trims, drops blanks and repeats, and keeps the first four', () => {
		assert.deepEqual(parseTags(' Race day , , race  DAY,TV,Phone, Strategy ,Extra'), [
			'Race day',
			'TV',
			'Phone',
			'Strategy'
		]);
	});

	it('cuts a long tag to the limit', () => {
		assert.deepEqual(parseTags('a very long tag indeed, ok'), ['a very long tag', 'ok']);
	});

	it('is empty for an empty line', () => {
		assert.deepEqual(parseTags(' , '), []);
	});
});

describe('tagLineProblem', () => {
	it('flags characters the server would refuse, and leaves ordinary tags alone', () => {
		assert.equal(tagLineProblem('Race day, 4K, Pit-wall, Українська'), null);
		assert.match(tagLineProblem('<b>bold</b>') ?? '', /letters, numbers/);
	});
});

describe('handleProblem', () => {
	it('says nothing when the handle is free, and why otherwise', () => {
		assert.equal(handleProblem('available'), null);
		assert.match(handleProblem('taken') ?? '', /already/);
		assert.match(handleProblem('format') ?? '', /3 to 20/);
	});
});
