import { paysFastestLap, pointsFor } from '@f1-live/shared';
import type { Lap, RaceDistance, RaceSnapshot, Standing } from '@f1-live/shared';
import { driverIdOf } from '@f1-live/shared/results';
import type {
	ResultRow,
	ResultSessionType,
	ResultStatus,
	SessionResults
} from '@f1-live/shared/results';

/** A car is classified when it covered this share of the winner's laps, rounded down. */
const CLASSIFIED_SHARE = 0.9;

function isResultSession(type: RaceSnapshot['session']['type']): type is ResultSessionType {
	return type !== 'practice';
}

function isRace(type: ResultSessionType): boolean {
	return type === 'race' || type === 'sprint';
}

/** When each part of a knockout session started: a part ends only with its chequered flag. */
function partStarts(snapshot: RaceSnapshot): string[] {
	const starts: string[] = [];
	let finished = true;

	for (const change of snapshot.statusLog ?? []) {
		if (change.status === 'started' && finished) {
			starts.push(change.at);
			finished = false;
		}

		if (change.status === 'finished') {
			finished = true;
		}
	}

	return starts;
}

/** Laps whose time the stewards deleted and did not give back. */
function deletedLaps(snapshot: RaceSnapshot): Set<Lap> {
	const deleted = new Set<Lap>();

	for (const { driverNumber, lapTimeRuling } of snapshot.raceControl) {
		if (lapTimeRuling === undefined) {
			continue;
		}

		for (const lap of snapshot.laps) {
			const named =
				lapTimeRuling.lapTimeMs === undefined
					? lap.lap === lapTimeRuling.lap
					: lap.lapTimeMs === lapTimeRuling.lapTimeMs;

			if (lap.driverNumber === driverNumber && named) {
				if (lapTimeRuling.reinstated) {
					deleted.delete(lap);
				} else {
					deleted.add(lap);
				}
			}
		}
	}

	return deleted;
}

/**
 * A part's lap this much slower than its fastest is no qualifying lap: one that ran into a red
 * flag, or the remains of a crash.
 */
const PART_LAP_LIMIT = 1.25;

/**
 * Each driver's best time in each part of a knockout session. Out-laps and in-laps never count,
 * nor do deleted laps or laps far off the part's pace; cool-down laps are slower than the flying
 * lap they follow.
 */
function partBests(snapshot: RaceSnapshot): Map<string, (number | null)[]> {
	const starts = partStarts(snapshot);
	const deleted = deletedLaps(snapshot);
	const parts = Math.max(1, starts.length);

	const timed = snapshot.laps.flatMap((lap) => {
		if (lap.lapTimeMs <= 0 || lap.pitIn || lap.pitOut || deleted.has(lap)) {
			return [];
		}

		const completed = lap.completedAt ?? '';

		return [{ lap, part: Math.max(1, starts.filter((start) => start <= completed).length) }];
	});

	const fastest = new Map<number, number>();

	for (const { lap, part } of timed) {
		fastest.set(part, Math.min(fastest.get(part) ?? Infinity, lap.lapTimeMs));
	}

	const bests = new Map<string, (number | null)[]>();

	for (const { lap, part } of timed) {
		const own = bests.get(lap.driverNumber) ?? Array.from({ length: parts }, () => null);
		const best = own[part - 1] ?? null;

		if (
			lap.lapTimeMs <= (fastest.get(part) ?? 0) * PART_LAP_LIMIT &&
			(best === null || lap.lapTimeMs < best)
		) {
			own[part - 1] = lap.lapTimeMs;
		}

		bests.set(lap.driverNumber, own);
	}

	return bests;
}

function raceStatus(
	standing: Standing,
	leaderLaps: number,
	classifiedLaps: number,
	neverStarted: boolean
): ResultStatus {
	if (standing.disqualified) {
		return 'dsq';
	}

	// The feed marks some cars retired that stopped on the slowing-down lap, the winner among them.
	if (standing.retired && standing.lapsCompleted < leaderLaps) {
		return standing.lapsCompleted === 0 && neverStarted ? 'dns' : 'dnf';
	}

	return standing.lapsCompleted >= classifiedLaps ? 'finished' : 'nc';
}

/** Laps each driver led at the line. */
function lapsLed(snapshot: RaceSnapshot): Map<string, number> {
	const led = new Map<string, number>();

	for (const lap of snapshot.laps) {
		if (lap.position === 1) {
			led.set(lap.driverNumber, (led.get(lap.driverNumber) ?? 0) + 1);
		}
	}

	return led;
}

/** The session's fastest lap, as the feed ranks each driver's best. */
function fastestLapHolder(snapshot: RaceSnapshot): string | null {
	let holder: { driverNumber: string; lapTimeMs: number } | null = null;

	for (const best of snapshot.personalBests ?? []) {
		if (best.lapTimeMs !== null && (holder === null || best.lapTimeMs < holder.lapTimeMs)) {
			holder = { driverNumber: best.driverNumber, lapTimeMs: best.lapTimeMs };
		}
	}

	return holder?.driverNumber ?? null;
}

/** When a retired car stopped: before the start means it never started. */
function retiredBeforeStart(snapshot: RaceSnapshot, driverNumber: string): boolean {
	const retirement = snapshot.retirements.find((entry) => entry.driverNumber === driverNumber);

	return (
		retirement?.at !== undefined &&
		snapshot.startedAt !== undefined &&
		retirement.at < snapshot.startedAt
	);
}

/**
 * One session's results from its final snapshot, corrections applied: the order, how each car
 * ended, the grid, the points under the season's rules, the fastest lap, laps led and, in
 * qualifying, each part's best time. Null for practice or a session with no running order.
 */
export function sessionResults(snapshot: RaceSnapshot, season: number): SessionResults | null {
	const { session } = snapshot;
	const standings = snapshot.standings ?? [];

	if (!isResultSession(session.type) || standings.length === 0) {
		return null;
	}

	const type = session.type;
	const race = isRace(type);
	const drivers = new Map(snapshot.drivers.map((driver) => [driver.number, driver]));
	const grid = new Map(snapshot.startingGrid.map((slot) => [slot.driverNumber, slot.position]));
	const bests = new Map((snapshot.personalBests ?? []).map((best) => [best.driverNumber, best]));
	const leaderLaps = Math.max(0, ...standings.map((standing) => standing.lapsCompleted));
	const classifiedLaps = Math.floor(leaderLaps * CLASSIFIED_SHARE);
	const distance: RaceDistance = { leaderLaps, scheduledLaps: session.totalLaps };
	const fastest = race ? fastestLapHolder(snapshot) : null;
	const led = race ? lapsLed(snapshot) : new Map<string, number>();
	const parts = race ? new Map<string, (number | null)[]>() : partBests(snapshot);
	const partCount = Math.max(1, partStarts(snapshot).length);

	const rows = standings
		.toSorted((a, b) => a.position - b.position)
		.flatMap((standing): ResultRow[] => {
			const driver = drivers.get(standing.driverNumber);

			if (driver === undefined) {
				return [];
			}

			const status: ResultStatus = race
				? raceStatus(
						standing,
						leaderLaps,
						classifiedLaps,
						retiredBeforeStart(snapshot, standing.driverNumber)
					)
				: standing.disqualified
					? 'dsq'
					: 'finished';

			const classified =
				!standing.disqualified && (!race || standing.lapsCompleted >= classifiedLaps);

			const hasFastest = fastest === standing.driverNumber;

			const points = classified
				? pointsFor(type, season, standing.position, distance) +
					(hasFastest && paysFastestLap(type, season, standing.position, distance) ? 1 : 0)
				: 0;

			const row: ResultRow = {
				driver: driverIdOf(driver.firstName, driver.lastName),
				number: driver.number,
				team: driver.team,
				position: standing.position,
				status,
				classified,
				laps: standing.lapsCompleted,
				points,
				bestLapMs: bests.get(standing.driverNumber)?.lapTimeMs ?? null
			};

			if (race) {
				row.grid = grid.get(standing.driverNumber) ?? null;
				row.gapMs = classified ? standing.gapToLeaderMs : null;
				row.lapsLed = led.get(standing.driverNumber) ?? 0;

				if (hasFastest) {
					row.fastestLap = true;
				}

				const retirement = snapshot.retirements.find(
					(entry) => entry.driverNumber === standing.driverNumber
				);

				if (status === 'dnf' && retirement !== undefined) {
					row.retirement = { lap: retirement.lap, reason: retirement.reason };
				}
			} else {
				row.parts =
					parts.get(standing.driverNumber) ?? Array.from({ length: partCount }, () => null);
			}

			return [row];
		});

	const results: SessionResults = {
		key: Number(session.id),
		type,
		name: session.name ?? type,
		startsAt: session.startsAt,
		rows
	};

	if (race) {
		results.scheduledLaps = session.totalLaps;
		results.leaderLaps = leaderLaps;
	}

	return results;
}
