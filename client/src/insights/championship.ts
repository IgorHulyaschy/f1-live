import { paysFastestLap, pointsFor, pointsTable } from '@f1-live/shared';
import type { RaceSnapshot, SessionType } from '@f1-live/shared';

import { isCleanLap } from './clean-laps.ts';
import { standingsAt } from './standings.ts';

export { pointsFor, pointsTable } from '@f1-live/shared';

/** The most points a driver can still score after this session: every race and sprint left won. */
export function pointsStillOnOffer(upcoming: readonly SessionType[], year: number): number {
	return upcoming.reduce((sum, type) => sum + (pointsTable(type, year)[0] ?? 0), 0);
}

export interface ProjectedPlace {
	/** A driver number, or a team name. */
	id: string;
	/** Before the session. */
	points: number;
	/** With the points of the running order at that moment. */
	projectedPoints: number;
	projectedPosition: number;
	/** Points from this session so far. */
	gained: number;
}

/** The running order at the end of `lap`; the last lap uses the classification, with corrections. */
function orderAtLap(snapshot: RaceSnapshot, lap: number): Map<string, number> {
	if (lap >= snapshot.currentLap) {
		return new Map(
			standingsAt(snapshot)
				.filter((row) => row.state !== 'out')
				.map((row) => [row.driver.number, row.position])
		);
	}

	const retired = new Set(
		snapshot.retirements
			.filter((retirement) => retirement.lap <= lap)
			.map((entry) => entry.driverNumber)
	);

	return new Map(
		snapshot.laps
			.filter((entry) => entry.lap === lap && !retired.has(entry.driverNumber))
			.map((entry) => [entry.driverNumber, entry.position])
	);
}

/** Where a driver runs at the end of `lap`, as the projection counts it; null when out. */
export function positionAt(
	snapshot: RaceSnapshot,
	driverNumber: string,
	lap: number
): number | null {
	return orderAtLap(snapshot, lap).get(driverNumber) ?? null;
}

/** Who holds the fastest lap at the end of `lap`, for the seasons that paid a point for it. */
function fastestLapHolder(snapshot: RaceSnapshot, lap: number): string | null {
	const best = snapshot.laps.reduce<{ driverNumber: string; lapTimeMs: number } | null>(
		(quickest, entry) =>
			entry.lap <= lap &&
			entry.lap > 1 &&
			isCleanLap(entry) &&
			(!quickest || entry.lapTimeMs < quickest.lapTimeMs)
				? entry
				: quickest,
		null
	);

	return best?.driverNumber ?? null;
}

function seasonOf(snapshot: RaceSnapshot): number {
	return new Date(snapshot.session.startsAt).getUTCFullYear();
}

/** Each driver's points from the session if it ended with the order at `lap`. */
export function sessionPoints(snapshot: RaceSnapshot, lap: number): Map<string, number> {
	const season = seasonOf(snapshot);
	const { type } = snapshot.session;
	const order = orderAtLap(snapshot, lap);

	const points = new Map(
		[...order].map(([driverNumber, position]) => [driverNumber, pointsFor(type, season, position)])
	);

	const fastest = fastestLapHolder(snapshot, lap);

	if (fastest !== null && paysFastestLap(type, season, order.get(fastest) ?? Infinity)) {
		points.set(fastest, (points.get(fastest) ?? 0) + 1);
	}

	return points;
}

function ranked(
	entries: readonly Omit<ProjectedPlace, 'projectedPosition'>[],
	prior: ReadonlyMap<string, number>
) {
	return entries
		.toSorted(
			(a, b) =>
				b.projectedPoints - a.projectedPoints ||
				(prior.get(a.id) ?? Infinity) - (prior.get(b.id) ?? Infinity)
		)
		.map((entry, index) => ({ ...entry, projectedPosition: index + 1 }));
}

/**
 * The drivers' championship as it would stand if the session ended with the order at `lap`: the
 * points before it plus each place's points. Ties keep the order before the session.
 */
export function projectedDrivers(snapshot: RaceSnapshot, lap: number): ProjectedPlace[] {
	const table = snapshot.championship?.drivers ?? [];
	const gained = sessionPoints(snapshot, lap);
	const prior = new Map(table.map((place) => [place.driverNumber, place.position]));

	return ranked(
		table.map((place) => ({
			id: place.driverNumber,
			points: place.points,
			gained: gained.get(place.driverNumber) ?? 0,
			projectedPoints: place.points + (gained.get(place.driverNumber) ?? 0)
		})),
		prior
	);
}

/** The teams' championship the same way: both cars' points count. */
export function projectedTeams(snapshot: RaceSnapshot, lap: number): ProjectedPlace[] {
	const table = snapshot.championship?.teams ?? [];
	const gained = sessionPoints(snapshot, lap);
	const teamOf = new Map(snapshot.drivers.map((driver) => [driver.number, driver.team]));
	const byTeam = new Map<string, number>();

	for (const [driverNumber, points] of gained) {
		const team = teamOf.get(driverNumber);

		if (team !== undefined) {
			byTeam.set(team, (byTeam.get(team) ?? 0) + points);
		}
	}

	return ranked(
		table.map((place) => ({
			id: place.team,
			points: place.points,
			gained: byTeam.get(place.team) ?? 0,
			projectedPoints: place.points + (byTeam.get(place.team) ?? 0)
		})),
		new Map(table.map((place) => [place.team, place.position]))
	);
}

/**
 * Drivers who can still take the title: the leader's points before the session are within what
 * they can score in it and in every race and sprint after it.
 */
export function contenders(snapshot: RaceSnapshot, stillOnOffer: number): string[] {
	const table = snapshot.championship?.drivers ?? [];
	const leader = Math.max(0, ...table.map((place) => place.points));
	const thisSession = pointsTable(snapshot.session.type, seasonOf(snapshot))[0] ?? 0;

	return table
		.filter((place) => place.points + thisSession + stillOnOffer >= leader)
		.toSorted((a, b) => b.points - a.points)
		.map((place) => place.driverNumber);
}

export interface SwingPoint {
	lap: number;
	/** Projected points behind the projected leader, per driver number; 0 for the leader. */
	[driverNumber: string]: number;
}

/** For the drivers asked, how far behind the projected leader they stood after every lap. */
export function championshipSwing(
	snapshot: RaceSnapshot,
	drivers: readonly string[]
): SwingPoint[] {
	return Array.from({ length: snapshot.currentLap }, (_, index) => {
		const lap = index + 1;
		const table = projectedDrivers(snapshot, lap);
		const top = table[0]?.projectedPoints ?? 0;
		const point: SwingPoint = { lap };

		for (const driverNumber of drivers) {
			const place = table.find((entry) => entry.id === driverNumber);

			if (place) {
				point[driverNumber] = top - place.projectedPoints;
			}
		}

		return point;
	});
}

export interface PlaceValue {
	/** The contender's finishing place; null for out of the points. */
	finish: number | null;
	/** Projected points against the best of the others: positive is ahead. */
	marginPoints: number;
	projectedPosition: number;
}

/**
 * What each finishing place is worth to a contender: their projected margin over the best of the
 * others if they finished there and everyone else kept the order at `lap`.
 */
export function placeValues(
	snapshot: RaceSnapshot,
	driverNumber: string,
	lap: number
): PlaceValue[] {
	const { type } = snapshot.session;
	const season = seasonOf(snapshot);
	const table = snapshot.championship?.drivers ?? [];

	const others = [...orderAtLap(snapshot, lap)]
		.filter(([number]) => number !== driverNumber)
		.toSorted((a, b) => a[1] - b[1])
		.map(([number]) => number);

	const before = new Map(table.map((place) => [place.driverNumber, place.points]));
	const finishes = [...pointsTable(type, season).keys()].map((index) => index + 1);

	return [...finishes, null].map((finish) => {
		const order =
			finish === null ? [...others, driverNumber] : others.toSpliced(finish - 1, 0, driverNumber);

		const totals = new Map(table.map((place) => [place.driverNumber, place.points]));

		for (const [index, number] of order.entries()) {
			totals.set(number, (before.get(number) ?? 0) + pointsFor(type, season, index + 1));
		}

		const own = totals.get(driverNumber) ?? 0;

		const rivals = [...totals].flatMap(([number, points]) =>
			number === driverNumber ? [] : [points]
		);

		const best = Math.max(0, ...rivals);

		return {
			finish,
			marginPoints: own - best,
			projectedPosition: 1 + rivals.filter((points) => points > own).length
		};
	});
}
