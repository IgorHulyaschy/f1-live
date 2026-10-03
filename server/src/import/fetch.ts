import { createWriteStream } from 'node:fs';
import { access, mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { z } from 'zod';

import { fetchPolitely, mapLimited } from '../pkg/http.js';
import type { ImportTarget } from './select.js';

export const ARCHIVE_URL = 'https://livetiming.formula1.com/static';

/** A session that ended this long ago is final; a younger one may still be growing. */
const SETTLE_MS = 3 * 60 * 60 * 1000;

const FILES_AT_ONCE = 4;

/** A live recording's marker (raw-writer.ts); an archive download must not mix into that folder. */
const RECORDING_FILE = '_recording.json';

const sessionIndexSchema = z.object({
	Feeds: z.record(z.string(), z.object({ StreamPath: z.string() }))
});

export interface FetchStats {
	/** Files the session lists, Index.json included. */
	files: number;
	downloaded: number;
	bytes: number;
}

/** Thrown for a session the archive does not hold, as opposed to a network failure. */
export class ArchiveMissing extends Error {}

async function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false
	);
}

/** The bytes as served, so a saved stream keeps the archive's BOM. Streams to `<file>.part` first. */
async function downloadFile(url: string, file: string): Promise<number> {
	const response = await fetchPolitely(url);

	if (response.status === 403 || response.status === 404) {
		throw new ArchiveMissing(`GET ${url} found nothing`);
	}

	if (!response.ok || response.body === null) {
		throw new Error(`GET ${url} answered ${response.status}`);
	}

	const partial = `${file}.part`;

	await mkdir(path.dirname(file), { recursive: true });

	try {
		await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
		await rename(partial, file);
	} catch (error) {
		await rm(partial, { force: true });
		throw error;
	}

	return (await stat(file)).size;
}

/** The stream files a session's Index.json lists, with Index.json itself first. */
function listedFiles(indexText: string): string[] {
	const { Feeds } = sessionIndexSchema.parse(JSON.parse(indexText.replace(/^﻿/, '')));

	return ['Index.json', ...Object.values(Feeds).map((feed) => feed.StreamPath)];
}

function settledAt(target: ImportTarget): number {
	return Date.parse(target.endsAt) + SETTLE_MS;
}

function isSettled(target: ImportTarget, now: Date): boolean {
	return settledAt(target) < now.getTime();
}

/** A file saved after the session settled is final; one saved while it ran may be cut short. */
async function isFinal(file: string, target: ImportTarget): Promise<boolean> {
	return stat(file).then(
		(info) => info.mtimeMs >= settledAt(target),
		() => false
	);
}

/** True when a settled session has every file its saved Index.json lists, so it needs no request. */
async function isComplete(directory: string, target: ImportTarget, now: Date): Promise<boolean> {
	if (!isSettled(target, now)) {
		return false;
	}

	const index = await readFile(path.join(directory, 'Index.json'), 'utf8').catch(() => null);

	if (index === null) {
		return false;
	}

	const present = await Promise.all(
		listedFiles(index).map((file) => isFinal(path.join(directory, file), target))
	);

	return present.every(Boolean);
}

/**
 * Saves the session's Index.json and every stream it lists into `<rawDir>/<archive path>/`. A
 * settled session with all its files is skipped without a request, and a file already there is
 * kept, so a run that stopped half way resumes. A session still running or just ended is fetched
 * again whole, because its files grow.
 */
export async function fetchSession(
	target: ImportTarget,
	rawDir: string,
	now: Date,
	baseUrl = ARCHIVE_URL
): Promise<FetchStats> {
	const directory = path.join(rawDir, target.path);

	if (await exists(path.join(directory, RECORDING_FILE))) {
		throw new Error(`${directory} holds a live recording; import it with --from-dir`);
	}

	if (await isComplete(directory, target, now)) {
		return { files: 0, downloaded: 0, bytes: 0 };
	}

	const url = `${baseUrl}/${target.path}/`;
	const indexFile = path.join(directory, 'Index.json');
	const settled = isSettled(target, now);
	let bytes = await downloadFile(`${url}Index.json`, indexFile);
	const files = listedFiles(await readFile(indexFile, 'utf8'));
	let downloaded = 1;

	const wanted = await Promise.all(
		files
			.slice(1)
			.map(async (file) =>
				(await isFinal(path.join(directory, file), target)) && settled ? null : file
			)
	);

	await mapLimited(
		wanted.filter((file) => file !== null),
		FILES_AT_ONCE,
		async (file) => {
			const size = await downloadFile(`${url}${file}`, path.join(directory, file));

			bytes += size;
			downloaded += 1;
		}
	);

	return { files: files.length, downloaded, bytes };
}

/** Saves a season's Index.json to `<rawDir>/<year>/Index.json`; null when the archive has none yet. */
export async function fetchSeasonIndex(year: number, rawDir: string): Promise<string | null> {
	const file = path.join(rawDir, String(year), 'Index.json');

	try {
		await downloadFile(`${ARCHIVE_URL}/${year}/Index.json`, file);
	} catch (error) {
		if (error instanceof ArchiveMissing) {
			return null;
		}

		throw error;
	}

	return file;
}
