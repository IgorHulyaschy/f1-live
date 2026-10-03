import { cp, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import type { IndexedSeason } from '../catalog/season-index.js';
import { parseSeasonIndex } from '../catalog/season-index.js';

const STREAM_SUFFIX = '.jsonStream';

const recordingSchema = z.object({ key: z.number(), path: z.string() });

/** A session folder found on disk, relative to the raw root it was found under. */
export interface LocalSession {
	/** Forward slashes, no trailing slash, e.g. "2026/2026-10-04_Bahrain_Grand_Prix/2026-10-02_Practice_2". */
	path: string;
	key: number | null;
}

async function isSessionDir(directory: string): Promise<boolean> {
	return (await readdir(directory)).some((file) => file.endsWith(STREAM_SUFFIX));
}

async function recordedKey(directory: string): Promise<number | null> {
	const text = await readFile(path.join(directory, '_recording.json'), 'utf8').catch(() => null);

	return text === null ? null : recordingSchema.parse(JSON.parse(text)).key;
}

/** Every folder under `root` that holds `.jsonStream` files, in path order. */
export async function findSessionDirs(root: string, relative = ''): Promise<string[]> {
	const directory = path.join(root, relative);
	const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);

	if (relative !== '' && (await isSessionDir(directory))) {
		return [relative];
	}

	const nested = await Promise.all(
		entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => findSessionDirs(root, path.posix.join(relative, entry.name)))
	);

	return nested.flat().toSorted();
}

/** The season indexes saved at `<root>/<year>/Index.json`, oldest first. */
export async function readSeasonIndexes(root: string): Promise<IndexedSeason[]> {
	const names = await readdir(root).catch(() => []);

	const seasons = await Promise.all(
		names
			.filter((name) => /^\d{4}$/.test(name))
			.map(async (name) => {
				const text = await readFile(path.join(root, name, 'Index.json'), 'utf8').catch(() => null);

				return text === null ? [] : [parseSeasonIndex(text)];
			})
	);

	return seasons.flat().toSorted((a, b) => a.year - b.year);
}

/**
 * The session folders under `root` with their keys: from a live recording's own marker, or from
 * the season indexes saved under the same root.
 */
export async function discoverSessions(root: string): Promise<LocalSession[]> {
	const keyByPath = new Map(
		(await readSeasonIndexes(root)).flatMap((season) =>
			season.meetings.flatMap((meeting) =>
				meeting.sessions.flatMap((session) =>
					session.path === null ? [] : [[session.path.replace(/\/$/, ''), session.key] as const]
				)
			)
		)
	);

	return Promise.all(
		(await findSessionDirs(root)).map(async (relative) => ({
			path: relative,
			key: (await recordedKey(path.join(root, relative))) ?? keyByPath.get(relative) ?? null
		}))
	);
}

/**
 * Copies a session folder into the raw root unless it already holds data there, so the raw root
 * stays the one place a rebuild reads. Returns true when it copied.
 */
export async function adoptSession(
	from: string,
	rawDir: string,
	session: LocalSession
): Promise<boolean> {
	const destination = path.join(rawDir, session.path);

	const present = await stat(destination).then(
		() => true,
		() => false
	);

	if (present && (await isSessionDir(destination))) {
		return false;
	}

	await cp(path.join(from, session.path), destination, { recursive: true });

	return true;
}
