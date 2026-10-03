import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { fetchPolitely } from '../../pkg/http.js';
import { openF1CacheOf } from '../../sinks/files.js';
import { OPENF1_URL, parseSessionResult } from './session-result.js';

/**
 * Saves each session's result of one meeting, as OpenF1 serves it, to `openF1CacheOf`. Sessions
 * OpenF1 does not list get no file. Returns the keys saved.
 */
export async function fetchMeetingResults(
	dataDir: string,
	meetingKey: number,
	sessionKeys: readonly number[]
): Promise<number[]> {
	const response = await fetchPolitely(`${OPENF1_URL}/session_result?meeting_key=${meetingKey}`);

	if (response.status === 404) {
		return [];
	}

	if (!response.ok) {
		throw new Error(`OpenF1 session_result for meeting ${meetingKey} answered ${response.status}`);
	}

	const rows = parseSessionResult(await response.text());
	const saved: number[] = [];

	for (const key of sessionKeys) {
		const own = rows.filter((row) => row.session_key === key);

		if (own.length > 0) {
			const file = openF1CacheOf(dataDir, key);

			await mkdir(path.dirname(file), { recursive: true });
			await writeFile(file, JSON.stringify(own));
			saved.push(key);
		}
	}

	return saved;
}
