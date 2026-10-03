import type { SessionType } from '@f1-live/shared';
import { z } from 'zod';

import { sessionTypeOf, utcStart } from '../sources/f1/decode.js';

const seasonIndexSchema = z.object({
	Year: z.number(),
	Meetings: z.array(
		z.object({
			Key: z.number(),
			Name: z.string(),
			OfficialName: z.string(),
			Location: z.string(),
			Country: z.object({ Code: z.string(), Name: z.string() }),
			Circuit: z.object({ ShortName: z.string() }),
			Sessions: z.array(
				z.object({
					Key: z.number(),
					Type: z.string(),
					Name: z.string(),
					StartDate: z.string(),
					EndDate: z.string(),
					GmtOffset: z.string(),
					Path: z.string().optional()
				})
			)
		})
	)
});

export interface IndexedSession {
	key: number;
	type: SessionType;
	name: string;
	/** ISO 8601, UTC. */
	startsAt: string;
	/** The scheduled end, ISO 8601 UTC; a race can run past it. */
	endsAt: string;
	/** E.g. "2025/2025-11-22_Las_Vegas_Grand_Prix/2025-11-22_Race/"; the archive lists none for some. */
	path: string | null;
}

export interface IndexedMeeting {
	key: number;
	name: string;
	officialName: string;
	location: string;
	circuit: string;
	country: { code: string; name: string };
	sessions: IndexedSession[];
}

export interface IndexedSeason {
	year: number;
	meetings: IndexedMeeting[];
}

/** Parses a season's `Index.json`; the file starts with a BOM, which `JSON.parse` rejects. */
export function parseSeasonIndex(text: string): IndexedSeason {
	const index = seasonIndexSchema.parse(JSON.parse(text.replace(/^﻿/, '')));

	return {
		year: index.Year,
		meetings: index.Meetings.map((meeting) => ({
			key: meeting.Key,
			name: meeting.Name,
			officialName: meeting.OfficialName,
			location: meeting.Location,
			circuit: meeting.Circuit.ShortName,
			country: { code: meeting.Country.Code, name: meeting.Country.Name },
			sessions: meeting.Sessions.map((session) => ({
				key: session.Key,
				type: sessionTypeOf(session.Type, session.Name),
				name: session.Name,
				startsAt: utcStart(session.StartDate, session.GmtOffset),
				endsAt: utcStart(session.EndDate, session.GmtOffset),
				path: session.Path ?? null
			}))
		}))
	};
}
