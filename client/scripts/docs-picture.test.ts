import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import sharp from 'sharp';

import { MAX_BYTES, optimise, writePicture } from './docs-picture.ts';

async function screen(colour: string): Promise<Buffer> {
	return sharp({
		create: { width: 120, height: 80, channels: 3, background: colour }
	})
		.png()
		.toBuffer();
}

test('a screenshot is stored as a palette PNG of the same size', async () => {
	const packed = await optimise(await screen('#202020'), 'x/y');
	const meta = await sharp(packed).metadata();

	assert.equal(meta.width, 120);
	assert.equal(meta.height, 80);
	assert.equal(meta.isPalette, true);
});

test('a picture over the size limit is refused by name', async () => {
	const noise = randomBytes(800 * 600 * 3);

	const big = await sharp(noise, { raw: { width: 800, height: 600, channels: 3 } })
		.png()
		.toBuffer();

	await assert.rejects(optimise(big, 'live/noise'), new RegExp(`live/noise is over ${MAX_BYTES}`));
});

test('the same pixels leave the file alone; changed pixels rewrite it', async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'docs-picture-'));
	const file = path.join(directory, 'live', 'timing.png');

	assert.equal(await writePicture('live', 'timing', await screen('#202020'), directory), 'written');

	const first = await stat(file);

	assert.equal(
		await writePicture('live', 'timing', await screen('#202020'), directory),
		'unchanged'
	);
	assert.equal((await stat(file)).mtimeMs, first.mtimeMs);
	// Compared exactly: even a few levels of difference rewrites the file.
	assert.equal(await writePicture('live', 'timing', await screen('#212121'), directory), 'written');

	// Flagged tolerant, a few levels of anti-aliasing noise is the same picture; a real change is not.
	assert.equal(
		await writePicture('live', 'timing', await screen('#252525'), directory, true),
		'unchanged'
	);
	assert.equal(
		await writePicture('live', 'timing', await screen('#a0a0a0'), directory, true),
		'written'
	);

	// A thin line off by one pixel is noise; a block of changed pixels is not.
	const dot = await sharp(await screen('#a0a0a0'))
		.composite([
			{
				input: { create: { width: 2, height: 2, channels: 3, background: '#ffffff' } },
				left: 5,
				top: 5
			}
		])
		.png()
		.toBuffer();

	const block = await sharp(await screen('#a0a0a0'))
		.composite([
			{
				input: { create: { width: 30, height: 30, channels: 3, background: '#ffffff' } },
				left: 5,
				top: 5
			}
		])
		.png()
		.toBuffer();

	assert.equal(await writePicture('live', 'timing', dot, directory, true), 'unchanged');
	assert.equal(await writePicture('live', 'timing', block, directory, true), 'written');
	assert.ok((await readFile(file)).length > 0);
});

function screenWith(glyph: { width: number; height: number }): Promise<Buffer> {
	return sharp({ create: { width: 1440, height: 900, channels: 3, background: '#101010' } })
		.composite([
			{ input: { create: { ...glyph, channels: 3, background: '#e0e0e0' } }, left: 700, top: 400 }
		])
		.png()
		.toBuffer();
}

test('a changed number on a screen-sized picture rewrites it, tolerant or not', async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'docs-picture-'));

	assert.equal(
		await writePicture('live', 'lap', await screenWith({ width: 6, height: 9 }), directory),
		'written'
	);
	// One more digit the width of a glyph: far fewer pixels than a thousandth of the picture.
	assert.equal(
		await writePicture('live', 'lap', await screenWith({ width: 14, height: 9 }), directory),
		'written'
	);
});

test('a one-character change rewrites a picture that is not flagged tolerant', async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'docs-picture-'));

	await writePicture('ask', 'stop', await screenWith({ width: 6, height: 9 }), directory);

	// A full stop is a few pixels; it must not pass for anti-aliasing.
	const stop = await sharp(await screenWith({ width: 6, height: 9 }))
		.composite([
			{
				input: { create: { width: 2, height: 2, channels: 3, background: '#e0e0e0' } },
				left: 710,
				top: 420
			}
		])
		.png()
		.toBuffer();

	assert.equal(await writePicture('ask', 'stop', stop, directory), 'written');
});
