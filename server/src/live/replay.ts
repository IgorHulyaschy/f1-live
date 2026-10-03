import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { archiveTopics, parseJsonStream, readArchive } from '../sources/f1/archive.js';
import type { TopicFrame } from '../sources/f1/decode.js';

const keySchema = z.object({ Key: z.number() });

async function subdirectories(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);

	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join(directory, entry.name));
}

/** The saved session with archive key `key` under `rawDir` (`<year>/<meeting>/<session>/`), if any. */
export async function findSavedSession(rawDir: string, key: number): Promise<string | null> {
	const years = await subdirectories(rawDir);
	const meetings = (await Promise.all(years.map(subdirectories))).flat();
	const sessions = (await Promise.all(meetings.map(subdirectories))).flat();

	for (const session of sessions) {
		// oxlint-disable-next-line no-await-in-loop -- stops at the first match.
		const text = await readFile(path.join(session, 'SessionInfo.jsonStream'), 'utf8').catch(
			() => ''
		);

		const first = parseJsonStream('SessionInfo', text)[0];

		if (first && keySchema.safeParse(first.data).data?.Key === key) {
			return session;
		}
	}

	return null;
}

/** Every topic of a saved session as one time-ordered stream of frames, whatever recorded it. */
export async function loadReplayFrames(directory: string): Promise<TopicFrame[]> {
	return readArchive(directory, await archiveTopics(directory));
}
