import type { Lap, PersonalBest, RaceSnapshot } from '@f1-live/shared';

const MINUTE_MS = 60_000;

/** When a session's clock starts and how many whole minutes of it there are to step through. */
export type SessionClock = { startMs: number; minutes: number };

function lapTime(lap: Lap): number | null {
	return lap.completedAt === undefined ? null : Date.parse(lap.completedAt);
}

/** From the start signal (or the first crossing) to the last crossing, in minutes. */
export function sessionClock(race: RaceSnapshot): SessionClock {
	const times = race.laps.flatMap((lap) => lapTime(lap) ?? []);
	const first = Math.min(...times);
	const startMs = race.startedAt ? Date.parse(race.startedAt) : first;
	const endMs = Math.max(startMs, ...times);

	return Number.isFinite(startMs)
		? { startMs, minutes: Math.max(1, Math.ceil((endMs - startMs) / MINUTE_MS)) }
		: { startMs: Date.parse(race.session.startsAt), minutes: 1 };
}

/** The newest moment a snapshot knows of, in ms: its last lap, status, flag or clock change. */
export function latestTime(snapshot: RaceSnapshot): number {
	const times = [
		...snapshot.laps.flatMap((lap) => lap.completedAt ?? []),
		...(snapshot.statusLog ?? []).map((change) => change.at),
		...(snapshot.trackStatusLog ?? []).map((change) => change.at),
		...(snapshot.clockLog ?? []).map((mark) => mark.at)
	];

	return times.reduce((latest, at) => Math.max(latest, Date.parse(at)), 0);
}

/** The moment `minute` minutes into the session. */
export function minuteTime(clock: SessionClock, minute: number): number {
	return clock.startMs + minute * MINUTE_MS;
}

/**
 * Each driver's best so far, from the laps a cut keeps. The feed's own bests hold the speeds
 * of the whole session, which a replay must not show early, so speeds stay unknown.
 */
export function bestsSoFar(race: RaceSnapshot, laps: readonly Lap[]): PersonalBest[] {
	return race.drivers.map((driver) => {
		const timed = laps.filter((lap) => lap.driverNumber === driver.number && lap.lapTimeMs > 0);

		const best = timed.reduce<Lap | null>(
			(fastest, lap) => (!fastest || lap.lapTimeMs < fastest.lapTimeMs ? lap : fastest),
			null
		);

		const sector = (index: 0 | 1 | 2) => {
			const times = timed.flatMap((lap) =>
				lap.sectorTimesMs[index] > 0 ? [lap.sectorTimesMs[index]] : []
			);

			return times.length > 0 ? Math.min(...times) : null;
		};

		return {
			driverNumber: driver.number,
			lapTimeMs: best?.lapTimeMs ?? null,
			lap: best?.lap ?? null,
			sectorTimesMs: [sector(0), sector(1), sector(2)],
			topSpeedsKph: { intermediate1: null, intermediate2: null, finishLine: null, speedTrap: null }
		};
	});
}

/** The snapshot without the feed's running order and mini sectors, which are as of now. */
function withoutStandings(race: RaceSnapshot): RaceSnapshot {
	const { standings, miniSectors, miniSectorLeaders, ...rest } = race;

	return standings || miniSectors || miniSectorLeaders ? rest : race;
}

/**
 * The session as it stood at `time` (ms), cut from a later snapshot by the times it carries:
 * laps by when they were completed, flags and statuses by when they changed, and the rest by the
 * laps each driver had done by then. The feed's running order and mini sectors are as of now, so
 * they are dropped.
 */
export function snapshotAtTime(race: RaceSnapshot, time: number): RaceSnapshot {
	const at = new Date(time).toISOString();
	const laps = race.laps.filter((lap) => lap.completedAt === undefined || lap.completedAt <= at);
	const lapsDone = new Map<string, number>();

	for (const lap of laps) {
		lapsDone.set(lap.driverNumber, Math.max(lap.lap, lapsDone.get(lap.driverNumber) ?? 0));
	}

	const done = (driverNumber: string) => lapsDone.get(driverNumber) ?? 0;
	const currentLap = Math.max(0, ...lapsDone.values());
	const trackStatusLog = (race.trackStatusLog ?? []).filter((change) => change.at <= at);
	const statusLog = (race.statusLog ?? []).filter((change) => change.at <= at);
	const clockLog = (race.clockLog ?? []).filter((mark) => mark.at <= at);

	return {
		...withoutStandings(race),
		currentLap,
		trackStatus: trackStatusLog.at(-1)?.status ?? 'green',
		trackStatusLog,
		statusLog,
		status: statusLog.at(-1)?.status ?? 'inactive',
		clockLog,
		laps,
		stints: race.stints
			.filter((stint) => stint.startLap <= done(stint.driverNumber) + 1)
			.map((stint) => ({
				...stint,
				endLap: Math.min(stint.endLap, Math.max(done(stint.driverNumber), stint.startLap))
			})),
		pitStops: race.pitStops.filter((stop) => stop.lap <= done(stop.driverNumber)),
		raceControl: race.raceControl.filter((message) =>
			message.at === undefined ? message.lap <= currentLap : message.at <= at
		),
		weather: race.weather.filter((sample) => sample.lap <= currentLap + 1),
		retirements: race.retirements.filter((retirement) =>
			retirement.at === undefined ? retirement.lap <= currentLap : retirement.at <= at
		),
		penalties: (race.penalties ?? [])
			.filter((penalty) => penalty.lap <= currentLap)
			.map(({ servedLap, ...penalty }) =>
				servedLap !== undefined && servedLap > currentLap
					? { ...penalty, status: 'issued' }
					: { ...penalty, servedLap }
			),
		overtakes: race.overtakes?.filter((pass) => pass.at <= at),
		teamRadio: race.teamRadio?.filter((clip) => clip.at <= at),
		personalBests: bestsSoFar(race, laps),
		corrections: (race.corrections ?? []).filter((correction) => correction.at <= at)
	};
}
