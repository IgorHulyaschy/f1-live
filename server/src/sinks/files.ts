import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import type { RaceEvent, RaceSnapshot } from '@f1-live/shared';

import type { Catalog } from '../catalog/catalog.js';

/** Where the importer keeps things: `raw/` is the input, `out/` is rebuilt from it. */
export const DEFAULT_DATA_DIR = path.resolve(import.meta.dirname, '../../../data');

export function rawDirOf(dataDir: string): string {
	return path.join(dataDir, 'raw');
}

export interface TopicFailure {
	topic: string;
	/** Frames of the topic the decoder rejected. */
	frames: number;
	/** The first few messages. */
	samples: { at: string; message: string }[];
}

export interface SessionErrorReport {
	key: number;
	frames: number;
	topics: TopicFailure[];
}

/** The OpenF1 results the importer reads, kept so a rebuild needs no network. */
export function openF1CacheOf(dataDir: string, key: number): string {
	return path.join(dataDir, 'openf1', `${key}.json`);
}

function outDirOf(dataDir: string): string {
	return path.join(dataDir, 'out');
}

export function catalogPathOf(dataDir: string): string {
	return path.join(outDirOf(dataDir), 'catalog.json');
}

export function eventsPathOf(dataDir: string, key: number): string {
	return path.join(outDirOf(dataDir), 'events', `${key}.jsonl.gz`);
}

export function snapshotPathOf(dataDir: string, key: number): string {
	return path.join(outDirOf(dataDir), 'snapshots', `${key}.json.gz`);
}

export function errorsPathOf(dataDir: string, key: number): string {
	return path.join(outDirOf(dataDir), 'errors', `${key}.json`);
}

/** Writes through a temporary file, so a reader never sees half a file. */
async function writeAtomic(file: string, content: string | Uint8Array): Promise<void> {
	await mkdir(path.dirname(file), { recursive: true });

	const temporary = `${file}.tmp`;

	await writeFile(temporary, content);
	await rename(temporary, file);
}

/** Level 9, and zlib writes no timestamp in the header, so equal input gives equal bytes. */
function compress(text: string): Buffer {
	return gzipSync(text, { level: 9 });
}

/** One event per line; returns the compressed size. */
export async function writeEvents(
	dataDir: string,
	key: number,
	events: readonly RaceEvent[]
): Promise<number> {
	const bytes = compress(events.map((event) => `${JSON.stringify(event)}\n`).join(''));

	await writeAtomic(eventsPathOf(dataDir, key), bytes);

	return bytes.length;
}

/** Returns the compressed size. */
export async function writeSnapshot(
	dataDir: string,
	key: number,
	snapshot: RaceSnapshot
): Promise<number> {
	const bytes = compress(JSON.stringify(snapshot));

	await writeAtomic(snapshotPathOf(dataDir, key), bytes);

	return bytes.length;
}

/** Writes the session's error report, or removes an old one when there is nothing to report. */
export async function writeErrors(
	dataDir: string,
	key: number,
	report: SessionErrorReport | null
): Promise<void> {
	const file = errorsPathOf(dataDir, key);

	if (report === null) {
		await rm(file, { force: true });
	} else {
		await writeAtomic(file, `${JSON.stringify(report, null, '\t')}\n`);
	}
}

export async function writeCatalog(dataDir: string, catalog: Catalog): Promise<void> {
	await writeAtomic(catalogPathOf(dataDir), `${JSON.stringify(catalog, null, '\t')}\n`);
}

/** The keys that have an output, read from the file names; none when the folder is missing. */
export async function outputKeys(
	dataDir: string,
	folder: 'events' | 'snapshots'
): Promise<number[]> {
	const names = await readdir(path.join(outDirOf(dataDir), folder)).catch(() => []);

	return names.flatMap((name) => {
		const key = /^(\d+)\.json/.exec(name)?.[1];

		return key === undefined ? [] : [Number(key)];
	});
}
