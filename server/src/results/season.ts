import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

import type { RaceSnapshot } from '@f1-live/shared';
import { driverIdOf } from '@f1-live/shared/results';
import type {
	ResultAdjustment,
	ResultDriver,
	ResultRound,
	SeasonResults
} from '@f1-live/shared/results';
import { z } from 'zod';

import type { CatalogSeason } from '../catalog/catalog.js';
import { snapshotPathOf, writeAtomic } from '../sinks/files.js';
import { sessionResults } from './session-results.js';

/** Committed constructors' points changes, per season; see `corrections/README.md`. */
export const SEASON_ADJUSTMENTS_FILE = path.resolve(
	import.meta.dirname,
	'../../corrections/seasons.json'
);

const adjustmentsSchema = z.array(
	z.object({
		season: z.int(),
		team: z.string().min(1),
		round: z.int().positive(),
		points: z.number(),
		reason: z.string().min(1),
		source: z.url()
	})
);

export type SeasonAdjustment = z.output<typeof adjustmentsSchema>[number];

export function resultsPathOf(dataDir: string, season: number): string {
	return path.join(dataDir, 'out', 'results', `${season}.json.gz`);
}

export async function readAdjustments(file = SEASON_ADJUSTMENTS_FILE): Promise<SeasonAdjustment[]> {
	const text = await readFile(file, 'utf8').catch(() => null);

	return text === null ? [] : adjustmentsSchema.parse(JSON.parse(text));
}

/** A saved snapshot; null when the session has none. */
export async function readSnapshot(dataDir: string, key: number): Promise<RaceSnapshot | null> {
	const bytes = await readFile(snapshotPathOf(dataDir, key)).catch(() => null);

	// SAFETY: written by this importer from the shared reducer's output.
	return bytes === null ? null : (JSON.parse(gunzipSync(bytes).toString('utf8')) as RaceSnapshot);
}

/**
 * A season's results index from its catalog entry and saved snapshots: a round for each meeting
 * with a race, numbered in calendar order, holding the sessions that have results. Drivers and
 * team colours are as last seen in the season.
 */
export async function seasonResults(
	season: CatalogSeason,
	loadSnapshot: (key: number) => Promise<RaceSnapshot | null>,
	adjustments: readonly SeasonAdjustment[]
): Promise<SeasonResults> {
	const drivers: Record<string, ResultDriver> = {};
	const teams: Record<string, string> = {};
	const rounds: ResultRound[] = [];

	for (const meeting of season.meetings) {
		const race = meeting.sessions.find((session) => session.type === 'race');

		if (race === undefined) {
			continue;
		}

		const round: ResultRound = {
			round: rounds.length + 1,
			meetingKey: meeting.key,
			name: meeting.name,
			location: meeting.location,
			circuit: race.circuit,
			countryCode: race.country.code,
			startsAt: race.startsAt,
			sessions: []
		};

		for (const session of meeting.sessions) {
			if (session.type === 'practice' || !session.outputs.snapshot) {
				continue;
			}

			// oxlint-disable-next-line no-await-in-loop -- one snapshot at a time keeps memory flat.
			const snapshot = await loadSnapshot(session.key);
			const results = snapshot === null ? null : sessionResults(snapshot, season.year);

			if (snapshot === null || results === null) {
				continue;
			}

			round.sessions.push(results);

			for (const driver of snapshot.drivers) {
				const info: ResultDriver = {
					code: driver.code,
					firstName: driver.firstName,
					lastName: driver.lastName
				};

				if (driver.headshotUrl !== undefined) {
					info.headshotUrl = driver.headshotUrl;
				}

				drivers[driverIdOf(driver.firstName, driver.lastName)] = info;
				teams[driver.team] = driver.teamColour;
			}
		}

		rounds.push(round);
	}

	return {
		season: season.year,
		drivers,
		teams,
		rounds,
		adjustments: adjustments.flatMap(({ season: year, ...adjustment }): ResultAdjustment[] =>
			year === season.year ? [adjustment] : []
		)
	};
}

/** Level 9 gzip without a timestamp, so equal results give equal bytes. Returns the size. */
export async function writeSeasonResults(dataDir: string, results: SeasonResults): Promise<number> {
	const bytes = gzipSync(JSON.stringify(results), { level: 9 });

	await writeAtomic(resultsPathOf(dataDir, results.season), bytes);

	return bytes.length;
}
