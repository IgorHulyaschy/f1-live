import type { Driver, PitStop, RaceSnapshot } from '@f1-live/shared';

import { isNeutralised, median, paceAround } from './clean-laps.ts';

/** A stop standing this many times longer than the field's usual one went wrong or served a penalty. */
const SLOW_STOP_SHARE = 1.8;

export interface StopCost {
	stop: PitStop;
	/** Race time the in-lap and out-lap lost against the driver's normal pace; null if unknown. */
	costMs: number | null;
	/** The stop came under a Virtual Safety Car or a Safety Car. */
	neutralised: boolean;
	/**
	 * Left out of the typical cost: a stop on the opening lap has no pace to compare with, and a
	 * slow one was a problem or a penalty served.
	 */
	unusual: 'opening-lap' | 'slow' | null;
}

export interface PitCost {
	stops: StopCost[];
	/** Typical cost of a green-flag stop, and of one under a VSC or Safety Car. */
	greenMs: number | null;
	neutralisedMs: number | null;
	/** Typical time in the pit lane, and stationary in the box, of green-flag stops. */
	laneMs: number | null;
	stationaryMs: number | null;
}

/**
 * What each stop cost in race time: its in-lap and out-lap against the pace the driver would have
 * done. Under green that is the driver's own clean laps around the stop; under a VSC or Safety
 * Car, when everyone slows, it is the field's laps on those laps by cars that did not stop.
 */
export function pitStopCost(snapshot: RaceSnapshot): PitCost {
	const usualStill = median(snapshot.pitStops.flatMap((stop) => stop.stationaryMs ?? []));
	const lapOf = new Map(snapshot.laps.map((lap) => [`${lap.driverNumber}/${lap.lap}`, lap]));
	const stoppedOn = new Set(snapshot.pitStops.map((stop) => `${stop.driverNumber}/${stop.lap}`));

	const fieldPace = (lap: number) =>
		median(
			snapshot.laps.flatMap((entry) =>
				entry.lap === lap && !entry.pitIn && !entry.pitOut ? [entry.lapTimeMs] : []
			)
		);

	const stops = snapshot.pitStops.map((stop): StopCost => {
		const inLap = lapOf.get(`${stop.driverNumber}/${stop.lap}`);
		const outLap = lapOf.get(`${stop.driverNumber}/${stop.lap + 1}`);
		const neutralised = isNeutralised(inLap) || isNeutralised(outLap);

		const unusual =
			stop.lap === 1
				? 'opening-lap'
				: usualStill !== null && (stop.stationaryMs ?? 0) > usualStill * SLOW_STOP_SHARE
					? 'slow'
					: null;

		if (!inLap || !outLap || stoppedOn.has(`${stop.driverNumber}/${stop.lap + 1}`)) {
			return { stop, costMs: null, neutralised, unusual };
		}

		if (neutralised) {
			const inPace = fieldPace(inLap.lap);
			const outPace = fieldPace(outLap.lap);

			return {
				stop,
				costMs:
					inPace === null || outPace === null
						? null
						: inLap.lapTimeMs - inPace + (outLap.lapTimeMs - outPace),
				neutralised,
				unusual
			};
		}

		const pace = paceAround(
			snapshot.laps.filter((lap) => lap.driverNumber === stop.driverNumber),
			stop.lap
		);

		return {
			stop,
			costMs: pace === null ? null : inLap.lapTimeMs + outLap.lapTimeMs - 2 * pace,
			neutralised,
			unusual
		};
	});

	const typical = stops.filter((entry) => entry.unusual === null);
	const green = typical.filter((entry) => !entry.neutralised);

	return {
		stops,
		greenMs: median(green.flatMap((entry) => entry.costMs ?? [])),
		neutralisedMs: median(
			typical.flatMap((entry) => (entry.neutralised && entry.costMs !== null ? [entry.costMs] : []))
		),
		laneMs: median(green.map((entry) => entry.stop.laneTimeMs)),
		stationaryMs: median(green.flatMap((entry) => entry.stop.stationaryMs ?? []))
	};
}

export interface CrewStop {
	driverNumber: string;
	lap: number;
	stationaryMs: number;
	/** Far slower than the field's usual stop: a problem, or a penalty served in the box. */
	slow: boolean;
}

export interface CrewRow {
	team: string;
	/** A driver of the team, for its colour. */
	driver: Driver;
	stops: CrewStop[];
	bestMs: number;
	/** The team's usual stop, slow ones left out; null when every stop was slow. */
	medianMs: number | null;
}

/**
 * Every team's stops at a standstill, ranked by their usual stop, then by their best; a team with
 * only slow stops comes last.
 */
export function crewLeague(snapshot: RaceSnapshot): CrewRow[] {
	const drivers = new Map(snapshot.drivers.map((driver) => [driver.number, driver]));
	const byTeam = new Map<string, { driver: Driver; stops: PitStop[] }>();

	for (const stop of snapshot.pitStops) {
		const driver = drivers.get(stop.driverNumber);

		if (driver && stop.stationaryMs !== undefined) {
			const entry = byTeam.get(driver.team) ?? { driver, stops: [] };

			entry.stops.push(stop);
			byTeam.set(driver.team, entry);
		}
	}

	const usual = median(snapshot.pitStops.flatMap((stop) => stop.stationaryMs ?? [])) ?? 0;

	return [...byTeam]
		.map(([team, { driver, stops }]) => {
			const times = stops.map((stop) => stop.stationaryMs ?? 0);

			const marked = stops.map((stop) => ({
				driverNumber: stop.driverNumber,
				lap: stop.lap,
				stationaryMs: stop.stationaryMs ?? 0,
				slow: (stop.stationaryMs ?? 0) > usual * SLOW_STOP_SHARE
			}));

			const normal = marked.filter((stop) => !stop.slow).map((stop) => stop.stationaryMs);

			return {
				team,
				driver,
				stops: marked.toSorted((a, b) => a.stationaryMs - b.stationaryMs),
				bestMs: Math.min(...times),
				medianMs: median(normal)
			};
		})
		.toSorted((a, b) => (a.medianMs ?? Infinity) - (b.medianMs ?? Infinity) || a.bestMs - b.bestMs);
}
