import type { SessionType } from './race.ts';

/** Points by finishing place, from first. */
const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;

const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

/** The first sprints, in 2021, paid the top three only. */
const SPRINT_POINTS_2021 = [3, 2, 1] as const;

/** From 2019 to 2024 the fastest lap earned a point when its driver finished in the top ten. */
const FASTEST_LAP_POINT_YEARS = { from: 2019, to: 2024 } as const;

/** A race short of this share of its distance pays reduced points. */
const FULL_DISTANCE_SHARE = 0.75;

/** Since 2022 a shortened race pays on a scale by how much of it was run (sporting regulations, art. 6.5). */
const SHORTENED_SCALE_FROM = 2022;

const SHORTENED_SCALES = [
	{ below: 0.25, points: [6, 4, 3, 2, 1] },
	{ below: 0.5, points: [13, 10, 8, 6, 5, 4, 3, 2, 1] },
	{ below: FULL_DISTANCE_SHARE, points: [19, 14, 12, 9, 8, 6, 5, 3, 2, 1] }
] as const;

/** Laps the leader must complete under green for any points to be paid. */
const MINIMUM_LAPS = 2;

/** How far a race got: laps the leader completed of the laps it was scheduled for. */
export interface RaceDistance {
	leaderLaps: number;
	scheduledLaps: number;
}

function shareOf(distance: RaceDistance | undefined): number {
	return distance === undefined || distance.scheduledLaps <= 0
		? 1
		: distance.leaderLaps / distance.scheduledLaps;
}

/** Points by place for a session of `type` in `season`, run to `distance` (the whole race by default). */
export function pointsTable(
	type: SessionType,
	season: number,
	distance?: RaceDistance
): readonly number[] {
	if (type === 'sprint') {
		return season === 2021 ? SPRINT_POINTS_2021 : SPRINT_POINTS;
	}

	if (type !== 'race') {
		return [];
	}

	const share = shareOf(distance);

	if (share >= FULL_DISTANCE_SHARE) {
		return RACE_POINTS;
	}

	if ((distance?.leaderLaps ?? 0) < MINIMUM_LAPS) {
		return [];
	}

	if (season < SHORTENED_SCALE_FROM) {
		return RACE_POINTS.map((points) => points / 2);
	}

	return SHORTENED_SCALES.find((scale) => share < scale.below)?.points ?? RACE_POINTS;
}

/** Points for finishing `position` (from 1); none outside the paying places. */
export function pointsFor(
	type: SessionType,
	season: number,
	position: number,
	distance?: RaceDistance
): number {
	return pointsTable(type, season, distance)[position - 1] ?? 0;
}

/**
 * Whether the fastest lap earns a point: races of 2019 to 2024, to a driver classified in the top
 * ten, and only in a race run to 75% of its distance (half of it from 2022).
 */
export function paysFastestLap(
	type: SessionType,
	season: number,
	position: number,
	distance?: RaceDistance
): boolean {
	const needed = season >= SHORTENED_SCALE_FROM ? 0.5 : FULL_DISTANCE_SHARE;

	return (
		type === 'race' &&
		season >= FASTEST_LAP_POINT_YEARS.from &&
		season <= FASTEST_LAP_POINT_YEARS.to &&
		position <= RACE_POINTS.length &&
		shareOf(distance) >= needed
	);
}
