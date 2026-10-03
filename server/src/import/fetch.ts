import { createWriteStream } from 'node:fs';
import { access, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { z } from 'zod';

import { fetchPolitely, mapLimited } from '../pkg/http.js';
import { CLOCK_TOPICS } from '../sources/f1/archive.js';
import { F1_TOPICS } from '../sources/f1/decode.js';
import type { ImportTarget } from './select.js';

export const ARCHIVE_URL = 'https://livetiming.formula1.com/static';

/** A session that ended this long ago is final; a younger one may still be growing. */
const SETTLE_MS = 3 * 60 * 60 * 1000;

const FILES_AT_ONCE = 4;

/** A live recording's marker (raw-writer.ts); an archive download must not mix into that folder. */
const RECORDING_FILE = '_recording.json';

/**
 * Written in a session folder the archive publishes no Index.json for (2018 to 2021): the streams
 * it answered 403 for, so a complete folder is known without asking again.
 */
const ABSENT_FILE = '_archive.json';

/** What a session download keeps: every stream the archive has, or only what results need. */
export type TopicSet = 'all' | 'results';

/** The decoder's topics and the clock lines that place them; no car data or positions. */
const RESULT_STREAMS: readonly string[] = [...new Set([...F1_TOPICS, ...CLOCK_TOPICS])].map(
	(topic) => `${topic}.jsonStream`
);

const TELEMETRY_STREAMS = ['Position.z.jsonStream', 'CarData.z.jsonStream'];

const absentSchema = z.object({ absent: z.array(z.string()) });

const sessionIndexSchema = z.object({
	Feeds: z.record(z.string(), z.object({ StreamPath: z.string() }))
});

export interface FetchOptions {
	baseUrl?: string;
	/** Default: every stream. */
	topics?: TopicSet;
}

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

function keeps(file: string, topics: TopicSet): boolean {
	return topics === 'all' || RESULT_STREAMS.includes(file);
}

/** The stream files a session's Index.json lists that `topics` keeps, with Index.json itself first. */
function listedFiles(indexText: string, topics: TopicSet): string[] {
	const { Feeds } = sessionIndexSchema.parse(JSON.parse(indexText.replace(/^﻿/, '')));

	return [
		'Index.json',
		...Object.values(Feeds)
			.map((feed) => feed.StreamPath)
			.filter((file) => keeps(file, topics))
	];
}

/** The streams to ask for in a session folder that has no Index.json. */
function unlistedFiles(topics: TopicSet): string[] {
	return topics === 'all' ? [...RESULT_STREAMS, ...TELEMETRY_STREAMS] : [...RESULT_STREAMS];
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

/** The files a saved folder should hold: what its Index.json lists, or what the archive did not refuse. */
async function expectedFiles(directory: string, topics: TopicSet): Promise<string[] | null> {
	const index = await readFile(path.join(directory, 'Index.json'), 'utf8').catch(() => null);

	if (index !== null) {
		return listedFiles(index, topics);
	}

	const absent = await readFile(path.join(directory, ABSENT_FILE), 'utf8').catch(() => null);

	if (absent === null) {
		return null;
	}

	const refused = new Set(absentSchema.parse(JSON.parse(absent)).absent);

	return unlistedFiles(topics).filter((file) => !refused.has(file));
}

/** True when a settled session has every file it should, so it needs no request. */
async function isComplete(
	directory: string,
	target: ImportTarget,
	now: Date,
	topics: TopicSet
): Promise<boolean> {
	if (!isSettled(target, now)) {
		return false;
	}

	const files = await expectedFiles(directory, topics);

	if (files === null) {
		return false;
	}

	const present = await Promise.all(
		files.map((file) => isFinal(path.join(directory, file), target))
	);

	return present.every(Boolean);
}

/** Index.json and the streams it lists; null when the archive publishes none for the session. */
async function fetchListing(
	url: string,
	directory: string,
	topics: TopicSet
): Promise<{ files: string[]; bytes: number } | null> {
	const indexFile = path.join(directory, 'Index.json');

	try {
		const bytes = await downloadFile(`${url}Index.json`, indexFile);

		return { files: listedFiles(await readFile(indexFile, 'utf8'), topics), bytes };
	} catch (error) {
		if (error instanceof ArchiveMissing) {
			return null;
		}

		throw error;
	}
}

/**
 * Saves the session's Index.json and every stream it lists that `topics` keeps into
 * `<rawDir>/<archive path>/`. Older sessions have no Index.json; then each stream `topics` names is
 * asked for, and the ones the archive refuses are noted in `_archive.json`. A settled session with
 * all its files is skipped without a request, and a file already there is kept, so a run that
 * stopped half way resumes. A session still running or just ended is fetched again whole, because
 * its files grow.
 */
export async function fetchSession(
	target: ImportTarget,
	rawDir: string,
	now: Date,
	options: FetchOptions = {}
): Promise<FetchStats> {
	const { baseUrl = ARCHIVE_URL, topics = 'all' } = options;
	const directory = path.join(rawDir, target.path);

	if (await exists(path.join(directory, RECORDING_FILE))) {
		throw new Error(`${directory} holds a live recording; import it with --from-dir`);
	}

	if (await isComplete(directory, target, now, topics)) {
		return { files: 0, downloaded: 0, bytes: 0 };
	}

	const url = `${baseUrl}/${target.path}/`;
	const settled = isSettled(target, now);
	const listing = await fetchListing(url, directory, topics);
	const files = listing?.files.slice(1) ?? unlistedFiles(topics);
	let bytes = listing?.bytes ?? 0;
	let downloaded = listing === null ? 0 : 1;
	const absent: string[] = [];

	const wanted = await Promise.all(
		files.map(async (file) =>
			(await isFinal(path.join(directory, file), target)) && settled ? null : file
		)
	);

	await mapLimited(
		wanted.filter((file) => file !== null),
		FILES_AT_ONCE,
		async (file) => {
			try {
				bytes += await downloadFile(`${url}${file}`, path.join(directory, file));
				downloaded += 1;
			} catch (error) {
				if (listing !== null || !(error instanceof ArchiveMissing)) {
					throw error;
				}

				absent.push(file);
			}
		}
	);

	if (listing === null) {
		if (absent.includes('SessionInfo.jsonStream')) {
			throw new ArchiveMissing(`${url} has neither Index.json nor SessionInfo.jsonStream`);
		}

		await writeFile(
			path.join(directory, ABSENT_FILE),
			`${JSON.stringify({ absent: absent.toSorted() })}\n`
		);
	}

	return { files: (listing === null ? 0 : 1) + files.length - absent.length, downloaded, bytes };
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
