import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { anchorsOf, checkLinks, imagesWithoutAlt, linksOf, strayPictures } from './check-links.ts';

function repository(files: Record<string, string>): string {
	const root = mkdtempSync(path.join(tmpdir(), 'docs-links-'));

	for (const [name, content] of Object.entries(files)) {
		mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
		writeFileSync(path.join(root, name), content);
	}

	return root;
}

const GOOD = {
	'README.md':
		'# Pitwall\n\n![Live](docs/tour/live/a.png)\n\nSee [the tour](docs/tour/README.md#live-race).\n',
	'docs/tour/README.md': '# Tour\n\n## Live race\n\nBack to [home](../../README.md).\n',
	'docs/tour/live/a.png': 'png'
};

test('a repository whose links and pictures all resolve is clean', () => {
	assert.deepEqual(checkLinks(repository(GOOD)), []);
});

test('a broken page link, a missing image and a missing heading are each reported with their line', () => {
	const root = repository({
		...GOOD,
		'README.md':
			'# Pitwall\n\n![Live](docs/tour/live/gone.png)\n\n[Gone](docs/gone.md)\n\n[Anchor](docs/tour/README.md#nowhere)\n'
	});

	const messages = new Set(
		checkLinks(root).map((problem) => `${problem.file}:${problem.line} ${problem.message}`)
	);

	assert.ok(messages.has('README.md:3 missing image docs/tour/live/gone.png'));
	assert.ok(messages.has('README.md:5 broken link docs/gone.md'));
	assert.ok(messages.has('README.md:7 no heading #nowhere in docs/tour/README.md'));
});

test('a picture no page shows, and an image with no alt text, are reported', () => {
	const root = repository({
		...GOOD,
		'README.md': '# Pitwall\n\n![](docs/tour/live/a.png)\n\n[Tour](docs/tour/README.md)\n',
		'docs/tour/live/orphan.png': 'png'
	});

	const messages = new Set(checkLinks(root).map((problem) => problem.message));

	assert.ok(messages.has('image has no alt text'));
	assert.ok(messages.has('no page shows this picture'));
});

test('links inside code, external links and a heading with markup are read correctly', () => {
	const markdown = [
		'# A `code` heading, with [a link](x.md)!',
		'```md',
		'[not a link](missing.md)',
		'```',
		'Use `[inline](missing.md)` or [site](https://example.com/a.md) or <img src="p.png" alt="p">.'
	].join('\n');

	assert.deepEqual(
		linksOf('a.md', markdown).map((link) => link.target),
		['x.md', 'https://example.com/a.md', 'p.png']
	);
	assert.deepEqual([...anchorsOf(markdown)], ['a-code-heading-with-a-link']);
	assert.deepEqual(imagesWithoutAlt('![](a.png)\n![ok](b.png)'), [1]);
});

test('repeated headings get GitHub’s numbered anchors', () => {
	assert.deepEqual([...anchorsOf('## Live\n\n## Live\n')], ['live', 'live-1']);
});

test('a repository path written in code must exist', () => {
	const root = repository({
		...GOOD,
		'README.md':
			'# Pitwall\n\n![Live](docs/tour/live/a.png)\n\n[Tour](docs/tour/README.md)\n\nSee `docs/tour/README.md`, `server/src/gone.ts` and `data/raw/<key>`.\n'
	});

	assert.deepEqual(
		checkLinks(root).map((problem) => problem.message),
		['`server/src/gone.ts` is not in the repository']
	);
});

test('a four-backtick block holds a three-backtick one without ending early', () => {
	assert.deepEqual(
		anchorsOf('# Out\n\n````md\n```\n# In\n```\n````\n\n## After\n'),
		new Set(['out', 'after'])
	);
});

test('a tracked PNG outside docs/ and client/public/ is reported', () => {
	assert.deepEqual(
		strayPictures([
			'docs/tour/live/a.png',
			'client/public/icon.png',
			'shots/output/dark/home.png',
			'notes.md'
		]).map((problem) => problem.file),
		['shots/output/dark/home.png']
	);
});
