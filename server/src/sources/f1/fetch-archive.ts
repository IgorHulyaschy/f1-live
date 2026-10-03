import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { RAW_DATA_DIR } from './archive.js';

const ARCHIVE_URL = 'https://livetiming.formula1.com/static';

/** The first season the archive indexes. */
const FIRST_SEASON = 2018;

const seasonIndexSchema = z.object({
	Meetings: z.array(
		z.object({
			Name: z.string(),
			Sessions: z.array(
				z.object({ Key: z.number(), Name: z.string().optional(), Path: z.string().optional() })
			)
		})
	)
});

const sessionIndexSchema = z.object({
	Feeds: z.record(z.string(), z.object({ StreamPath: z.string() }))
});

export interface ArchiveSession {
	key: number;
	/** E.g. "2025/2025-11-22_Las_Vegas_Grand_Prix/2025-11-22_Race/". */
	path: string;
	title: string;
}

/** The bytes as served, so a saved stream keeps the archive's BOM; null when not found. */
async function download(url: string): Promise<Uint8Array | null> {
	const response = await fetch(url);

	if (response.status === 403 || response.status === 404) {
		return null;
	}

	if (!response.ok) {
		throw new Error(`GET ${url} failed with ${response.status}`);
	}

	return new Uint8Array(await response.arrayBuffer());
}

function parseIndex<T extends z.ZodType>(schema: T, bytes: Uint8Array): z.output<T> {
	// TextDecoder drops the BOM the archive starts its files with.
	return schema.parse(JSON.parse(new TextDecoder().decode(bytes)));
}

async function downloadIndex<T extends z.ZodType>(schema: T, url: string): Promise<z.output<T>> {
	const bytes = await download(url);

	if (bytes === null) {
		throw new Error(`GET ${url} found nothing`);
	}

	return parseIndex(schema, bytes);
}

/** Looks the key up in every season's index; seasons not published yet are skipped. */
export async function findSession(key: number, now = new Date()): Promise<ArchiveSession> {
	const years = Array.from(
		{ length: now.getUTCFullYear() - FIRST_SEASON + 1 },
		(_, index) => FIRST_SEASON + index
	);

	const seasons = await Promise.all(
		years.map(async (year) => {
			const bytes = await download(`${ARCHIVE_URL}/${year}/Index.json`);

			if (bytes === null) {
				return [];
			}

			return parseIndex(seasonIndexSchema, bytes).Meetings.flatMap((meeting) =>
				meeting.Sessions.map((session) => ({ year, meeting, session }))
			);
		})
	);

	const found = seasons.flat().find(({ session }) => session.Key === key);

	if (!found?.session.Path) {
		throw new Error(`Session ${key} is not in the archive's season indexes`);
	}

	return {
		key,
		path: found.session.Path,
		title: `${found.meeting.Name} ${found.year}, ${found.session.Name ?? `session ${key}`}`
	};
}

/**
 * Saves the session's Index.json and every stream it lists into `data/raw/<archive path>/`, in
 * the archive's own format, so tests and imports run without the network; returns the directory.
 */
export async function fetchSession(
	session: ArchiveSession,
	rawDir = RAW_DATA_DIR
): Promise<string> {
	const url = `${ARCHIVE_URL}/${session.path}`;
	const directory = path.join(rawDir, session.path);
	const { Feeds } = await downloadIndex(sessionIndexSchema, `${url}Index.json`);

	await mkdir(directory, { recursive: true });
	await Promise.all(
		['Index.json', ...Object.values(Feeds).map((feed) => feed.StreamPath)].map(async (file) => {
			const bytes = await download(`${url}${file}`);

			if (bytes === null) {
				throw new Error(`GET ${url}${file} found nothing`);
			}

			await writeFile(path.join(directory, file), bytes);
		})
	);

	return directory;
}
