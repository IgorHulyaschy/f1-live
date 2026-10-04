import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

/** Where the tour's pictures live, one folder per area. */
export const TOUR_DIR = fileURLToPath(new URL('../../docs/tour/', import.meta.url));

/** The most a single picture may weigh; GitHub pages stay quick on a phone below it. */
export const MAX_BYTES = 300_000;

/** Palette sizes to try, richest first: flat UI screens lose nothing visible at 256 colours. */
const PALETTES = [256, 128, 64] as const;

/** The smallest palette PNG of a screenshot that fits MAX_BYTES, or an error saying which picture is too big. */
export async function optimise(png: Buffer, name: string): Promise<Buffer> {
	for (const colours of PALETTES) {
		// oxlint-disable-next-line no-await-in-loop -- each size is tried only when the last was too big.
		const packed = await sharp(png)
			.png({ palette: true, colours, quality: 90, effort: 7, compressionLevel: 9 })
			.toBuffer();

		if (packed.length <= MAX_BYTES) {
			return packed;
		}
	}

	throw new Error(
		`${name} is over ${MAX_BYTES} bytes at ${PALETTES.at(-1)} colours; crop it tighter`
	);
}

/**
 * What counts as the same picture across runs, for a picture flagged `tolerant` only: a chart
 * whose thin lines Chromium draws a shade differently from run to run, after which the palette
 * step remaps a few colours (a team bar) across the picture. A pixel moving by `SHADE` or less is
 * ignored. Beyond that, scattered pixels are noise but a dense patch is a change: more than
 * `DENSE` moved pixels in one `TILE` x `TILE` square is a changed letter or number. Every other
 * picture is compared exactly, so a one-character change always shows.
 */
const SHADE = 24;

const MOVED = 64;

const TILE = 16;

const DENSE = 12;

type Raster = { data: Buffer; width: number };

async function pixels(png: Buffer): Promise<Raster> {
	const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

	return { data, width: info.width };
}

function sameWithinNoise(before: Raster, after: Raster): boolean {
	if (before.data.length !== after.data.length || before.width !== after.width) {
		return false;
	}

	const tiles = new Map<number, number>();

	for (let i = 0; i < before.data.length; i += 4) {
		const shade = Math.max(
			Math.abs((before.data[i] ?? 0) - (after.data[i] ?? 0)),
			Math.abs((before.data[i + 1] ?? 0) - (after.data[i + 1] ?? 0)),
			Math.abs((before.data[i + 2] ?? 0) - (after.data[i + 2] ?? 0))
		);

		if (shade > SHADE) {
			const pixel = i / 4;
			const column = Math.floor((pixel % before.width) / TILE);
			const row = Math.floor(pixel / before.width / TILE);
			const tile = row * before.width + column;
			const count = (tiles.get(tile) ?? 0) + (shade > MOVED ? 1 : 0);

			tiles.set(tile, count);

			if (count > DENSE) {
				return false;
			}
		}
	}

	return true;
}

/**
 * Writes a screenshot as docs/tour/<area>/<name>.png, optimised. A picture whose pixels match the
 * file already there is left alone, so a second run changes only what the UI changed. `tolerant`
 * also forgives the anti-aliasing noise of a chart.
 */
export async function writePicture(
	area: string,
	name: string,
	screenshot: Buffer,
	directory: string = TOUR_DIR,
	tolerant = false
): Promise<'written' | 'unchanged'> {
	const file = path.join(directory, area, `${name}.png`);
	const packed = await optimise(screenshot, `${area}/${name}`);
	const existing = await readFile(file).catch(() => null);

	if (existing) {
		const [before, after] = await Promise.all([pixels(existing), pixels(packed)]);

		if (
			(before.data.equals(after.data) && before.width === after.width) ||
			(tolerant && sameWithinNoise(before, after))
		) {
			return 'unchanged';
		}
	}

	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, packed);

	return 'written';
}
