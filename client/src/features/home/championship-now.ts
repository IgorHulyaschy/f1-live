import type { RaceSnapshot } from '@f1-live/shared';

import {
	type ProjectedPlace,
	projectedDrivers,
	projectedTeams
} from '../../insights/championship.ts';

/**
 * Which table the home shows: the standings going into the session, after it, or as it runs.
 * A session whose results are hidden only ever shows "before", so the table spoils nothing.
 */
export type ChampionshipBasis = 'before' | 'after' | 'live';

/** A driver number or a team name, with its place and points. */
export type ChampionshipRow = { id: string; position: number; points: number };

export type ChampionshipTable = {
	basis: ChampionshipBasis;
	drivers: ChampionshipRow[];
	teams: ChampionshipRow[];
};

function byPosition(rows: readonly ChampionshipRow[]): ChampionshipRow[] {
	return rows.toSorted((a, b) => a.position - b.position);
}

function projected(places: readonly ProjectedPlace[]): ChampionshipRow[] {
	return byPosition(
		places.map((place) => ({
			id: place.id,
			position: place.projectedPosition,
			points: place.projectedPoints
		}))
	);
}

/**
 * The championship as the home page shows it, from the session the app has loaded: the latest
 * saved one or the live one. T11h's season standings replace this once they land; until then the
 * session's own table is the freshest the app holds.
 */
export function championshipNow(
	race: RaceSnapshot,
	{ hidden, live }: { hidden: boolean; live: boolean }
): ChampionshipTable | null {
	if (!race.championship || race.championship.drivers.length === 0) {
		return null;
	}

	const { drivers, teams } = race.championship;
	const scoring = race.session.type === 'race' || race.session.type === 'sprint';

	if (!scoring || hidden) {
		return {
			basis: 'before',
			drivers: byPosition(
				drivers.map(({ driverNumber, position, points }) => ({
					id: driverNumber,
					position,
					points
				}))
			),
			teams: byPosition(teams.map(({ team, position, points }) => ({ id: team, position, points })))
		};
	}

	return {
		basis: live ? 'live' : 'after',
		drivers: projected(projectedDrivers(race, race.currentLap)),
		teams: projected(projectedTeams(race, race.currentLap))
	};
}
