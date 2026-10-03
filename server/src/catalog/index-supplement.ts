import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { parseSeasonIndex } from './season-index.js';
import type { IndexedMeeting, IndexedSeason, IndexedSession } from './season-index.js';

/**
 * Sessions the archive serves that its season indexes leave out, one `<year>.json` in the index's
 * own format; see `README.md` there.
 */
export const SUPPLEMENT_DIR = path.resolve(import.meta.dirname, '../../index-supplement');

/** The first line of a session's `SessionInfo.jsonStream`, which names its meeting too. */
export const sessionInfoSchema = z.object({
	Meeting: z.object({
		Key: z.number(),
		Name: z.string(),
		OfficialName: z.string().optional(),
		Location: z.string(),
		Country: z.object({ Key: z.number().optional(), Code: z.string(), Name: z.string() }),
		Circuit: z.object({ Key: z.number().optional(), ShortName: z.string() })
	}),
	Key: z.number(),
	Type: z.string(),
	Name: z.string(),
	StartDate: z.string(),
	EndDate: z.string(),
	GmtOffset: z.string(),
	Path: z.string()
});

export type SessionInfo = z.output<typeof sessionInfoSchema>;

function byStart(a: IndexedSession, b: IndexedSession): number {
	return a.startsAt.localeCompare(b.startsAt) || a.key - b.key;
}

function meetingStart(meeting: IndexedMeeting): string {
	return meeting.sessions[0]?.startsAt ?? '';
}

/**
 * The season with the supplement's meetings and sessions added. A session the index lists without
 * a path takes the supplement's, which has one.
 */
export function withSupplement(season: IndexedSeason, extra: IndexedSeason): IndexedSeason {
	const meetings = new Map(season.meetings.map((meeting) => [meeting.key, meeting]));

	for (const meeting of extra.meetings) {
		const known = meetings.get(meeting.key);
		const sessions = new Map(known?.sessions.map((session) => [session.key, session]));

		for (const session of meeting.sessions) {
			if ((sessions.get(session.key)?.path ?? null) === null) {
				sessions.set(session.key, session);
			}
		}

		meetings.set(meeting.key, {
			...(known ?? meeting),
			sessions: [...sessions.values()].toSorted(byStart)
		});
	}

	return {
		year: season.year,
		meetings: [...meetings.values()].toSorted(
			(a, b) => meetingStart(a).localeCompare(meetingStart(b)) || a.key - b.key
		)
	};
}

/** The committed supplement for a season; null when it has none. */
export async function readSupplement(
	year: number,
	directory = SUPPLEMENT_DIR
): Promise<IndexedSeason | null> {
	const text = await readFile(path.join(directory, `${year}.json`), 'utf8').catch(() => null);

	return text === null ? null : parseSeasonIndex(text);
}

/** Session infos grouped into a season index file, meetings and sessions in calendar order. */
export function supplementFile(year: number, infos: readonly SessionInfo[]): string {
	const meetings = new Map<number, { meeting: SessionInfo['Meeting']; sessions: SessionInfo[] }>();

	for (const info of infos.toSorted((a, b) => a.StartDate.localeCompare(b.StartDate))) {
		const entry = meetings.get(info.Meeting.Key) ?? { meeting: info.Meeting, sessions: [] };

		entry.sessions.push(info);
		meetings.set(info.Meeting.Key, entry);
	}

	const index = {
		Year: year,
		Meetings: [...meetings.values()].map(({ meeting, sessions }) => ({
			Key: meeting.Key,
			Name: meeting.Name,
			OfficialName: meeting.OfficialName ?? meeting.Name,
			Location: meeting.Location,
			Country: meeting.Country,
			Circuit: meeting.Circuit,
			Sessions: sessions.map((session) => ({
				Key: session.Key,
				Type: session.Type,
				Name: session.Name,
				StartDate: session.StartDate,
				EndDate: session.EndDate,
				GmtOffset: session.GmtOffset,
				Path: session.Path
			}))
		}))
	};

	return `${JSON.stringify(index, null, '\t')}\n`;
}
