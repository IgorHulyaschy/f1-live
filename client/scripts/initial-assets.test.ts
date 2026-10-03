import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { gzipKilobytes, initialAssets } from './initial-assets.ts';

describe('initial assets', () => {
	it('count the entry, its preloads and stylesheets, not icons or the manifest', () => {
		const html = `<head>
			<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
			<link rel="manifest" href="/manifest.webmanifest" />
			<script type="module" crossorigin src="/assets/index-a1.js"></script>
			<link rel="modulepreload" crossorigin href="/assets/vendor-b2.js">
			<link rel="stylesheet" crossorigin href="/assets/index-c3.css">
		</head>`;

		assert.deepEqual(initialAssets(html), {
			scripts: ['/assets/index-a1.js', '/assets/vendor-b2.js'],
			styles: ['/assets/index-c3.css']
		});
	});

	it('measure what travels over the wire', () => {
		const repetitive = Buffer.from('lap '.repeat(10_000));

		assert.ok(gzipKilobytes(repetitive) < 1);
	});
});
