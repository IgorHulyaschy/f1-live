import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { parseJsonStream } from '../sources/f1/archive.js';

const sessionInfoSchema = z.object({ Key: z.number() }).partial();

async function listDirectories(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);

	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join(directory, entry.name));
}

async function sessionKeyOf(directory: string): Promise<number | null> {
	try {
		const text = await readFile(path.join(directory, 'SessionInfo.jsonStream'), 'utf8');

		for (const { data } of parseJsonStream('SessionInfo', text)) {
			const info = sessionInfoSchema.safeParse(data);

			if (info.success && info.data.Key !== undefined) {
				return info.data.Key;
			}
		}
	} catch {
		// A folder without a readable SessionInfo is not a session.
	}

	return null;
}

/**
 * The raw directory of a session in `<rawRoot>/<year>/<meeting>/<session>/`, by its archive key;
 * null when none is saved.
 */
export async function findRawSession(rawRoot: string, key: number): Promise<string | null> {
	const years = await listDirectories(rawRoot);
	const meetings = (await Promise.all(years.map(listDirectories))).flat();
	const sessions = (await Promise.all(meetings.map(listDirectories))).flat();
	const keys = await Promise.all(sessions.map(sessionKeyOf));

	return sessions.find((_, index) => keys[index] === key) ?? null;
}
