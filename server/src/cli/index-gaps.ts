/**
 * Finds the sessions a season's archive index leaves out and writes them to
 * `index-supplement/<year>.json`. Candidates come from OpenF1's calendar (2023 on) and from
 * `--path`; each is kept only when the archive serves its `SessionInfo.jsonStream`.
 *
 *   npm run index-gaps -w server -- 2024
 *   npm run index-gaps -w server -- 2018 --path 2018/2018-03-25_Australian_Grand_Prix/2018-03-25_Race
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { z } from 'zod';

import { SUPPLEMENT_DIR, sessionInfoSchema, supplementFile } from '../catalog/index-supplement.js';
import type { SessionInfo } from '../catalog/index-supplement.js';
import { parseSeasonIndex } from '../catalog/season-index.js';
import { ARCHIVE_URL } from '../import/fetch.js';
import { fetchPolitely, mapLimited } from '../pkg/http.js';
import { OPENF1_URL } from '../sources/openf1/session-result.js';

const OPENF1_FIRST_SEASON = 2023;

const openF1SessionsSchema = z.array(
	z.object({
		session_key: z.number(),
		session_name: z.string(),
		date_start: z.string(),
		gmt_offset: z.string(),
		meeting_key: z.number()
	})
);

const openF1MeetingsSchema = z.array(
	z.object({ meeting_key: z.number(), meeting_name: z.string() })
);

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: { path: { type: 'string', multiple: true, default: [] } }
});

const year = Number(positionals[0]);

if (!Number.isInteger(year)) {
	throw new Error('Usage: npm run index-gaps -w server -- <year> [--path <session path> ...]');
}

async function getText(url: string): Promise<string | null> {
	const response = await fetchPolitely(url);

	return response.ok ? response.text() : null;
}

/** The session's local date, as the archive's folder names write it. */
function localDate(startUtc: string, gmtOffset: string): string {
	const [hours = 0, minutes = 0] = gmtOffset.replace(/^-/, '').split(':').map(Number);
	const sign = gmtOffset.startsWith('-') ? -1 : 1;

	return new Date(Date.parse(startUtc) + sign * (hours * 60 + minutes) * 60_000)
		.toISOString()
		.slice(0, 10);
}

/** Archive folders for OpenF1's sessions: `<year>/<race date>_<Meeting>/<date>_<Session>`. */
async function openF1Paths(): Promise<string[]> {
	const meetings = openF1MeetingsSchema.parse(
		JSON.parse((await getText(`${OPENF1_URL}/meetings?year=${year}`)) ?? '[]')
	);

	const sessions = openF1SessionsSchema.parse(
		JSON.parse((await getText(`${OPENF1_URL}/sessions?year=${year}`)) ?? '[]')
	);

	return sessions.flatMap((session) => {
		const meeting = meetings.find((candidate) => candidate.meeting_key === session.meeting_key);

		const race = sessions.find(
			(candidate) =>
				candidate.meeting_key === session.meeting_key && candidate.session_name === 'Race'
		);

		if (meeting === undefined || race === undefined) {
			return [];
		}

		const folder = `${localDate(race.date_start, race.gmt_offset)}_${meeting.meeting_name}`;
		const name = `${localDate(session.date_start, session.gmt_offset)}_${session.session_name}`;

		return [`${year}/${folder}/${name}`.replaceAll(' ', '_')];
	});
}

const indexText = await getText(`${ARCHIVE_URL}/${year}/Index.json`);

const listed = new Set(
	indexText === null
		? []
		: parseSeasonIndex(indexText).meetings.flatMap((meeting) =>
				meeting.sessions.flatMap((session) =>
					session.path === null ? [] : [session.path.replace(/\/$/, '')]
				)
			)
);

const candidates = [
	...new Set([...(year >= OPENF1_FIRST_SEASON ? await openF1Paths() : []), ...values.path])
].filter((candidate) => !listed.has(candidate.replace(/\/$/, '')));

const found = await mapLimited(candidates, 4, async (candidate) => {
	const text = await getText(
		`${ARCHIVE_URL}/${candidate.replace(/\/$/, '')}/SessionInfo.jsonStream`
	);

	const json = text
		?.replace(/^﻿/, '')
		.split('\n')[0]
		?.replace(/^[\d:.]+/, '');

	const info = json === undefined ? null : sessionInfoSchema.safeParse(JSON.parse(json));

	process.stdout.write(`${candidate}: ${info?.success ? `key ${info.data.Key}` : 'not served'}\n`);

	return info?.success ? [info.data] : [];
});

const infos: SessionInfo[] = found.flat();

const file = path.join(SUPPLEMENT_DIR, `${year}.json`);

await writeFile(file, supplementFile(year, infos));

process.stdout.write(`${infos.length} sessions written to ${file}\n`);
