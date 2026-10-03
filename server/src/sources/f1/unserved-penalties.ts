import { access } from 'node:fs/promises';

import type { ClassificationCorrectionEvent, Penalty, RaceSnapshot } from '@f1-live/shared';

import type { CorrectionSource, CorrectionTarget } from '../../import/corrections.js';
import { openF1CacheOf } from '../../sinks/files.js';

/** How far a gap may stray from the gaps at the line plus a penalty and still be that penalty. */
const APPLIED_TOLERANCE_MS = 500;

function near(value: number, target: number): boolean {
	return Math.abs(value - target) <= APPLIED_TOLERANCE_MS;
}

/**
 * Whether the feed already added `addedMs` to the car's time, as it sometimes did: at its last
 * crossing (the gap grew by the penalty more than the lap times explain), or after the flag (the
 * final gap is the gap at the line plus the penalty, against the car classified first).
 */
function appliedByFeed(snapshot: RaceSnapshot, driverNumber: string, addedMs: number): boolean {
	const own = snapshot.laps.filter((lap) => lap.driverNumber === driverNumber);
	const last = own.at(-1);
	const before = own.at(-2);
	const lapLeader = snapshot.laps.find((lap) => lap.lap === last?.lap && lap.position === 1);

	if (last && before && lapLeader) {
		const growth =
			last.gapToLeaderMs - before.gapToLeaderMs - (last.lapTimeMs - lapLeader.lapTimeMs);

		if (near(growth, addedMs)) {
			return true;
		}
	}

	const standings = snapshot.standings ?? [];
	const final = standings.find((standing) => standing.driverNumber === driverNumber);
	const leader = standings.find((standing) => standing.position === 1);
	const leaderAtLine = snapshot.laps.findLast((lap) => lap.driverNumber === leader?.driverNumber);

	return (
		final !== undefined &&
		final.gapToLeaderMs !== null &&
		last !== undefined &&
		leaderAtLine !== undefined &&
		near(final.gapToLeaderMs, last.gapToLeaderMs + addedMs - leaderAtLine.gapToLeaderMs)
	);
}

/**
 * Time penalties never served at a stop: the regulations add those to the race time at the flag.
 * The feed announces a penalty but does not say when it was served, so one counts as served when
 * the car stopped after the lap it was given on. A car whose penalties the feed already added is
 * left out.
 */
export function unservedPenalties(snapshot: RaceSnapshot): Penalty[] {
	const unserved = (snapshot.penalties ?? []).filter(
		(penalty) =>
			penalty.kind === 'time' &&
			penalty.status === 'issued' &&
			(penalty.seconds ?? 0) > 0 &&
			!snapshot.pitStops.some(
				(stop) => stop.driverNumber === penalty.driverNumber && stop.lap > penalty.lap
			)
	);

	return unserved.filter((penalty) => {
		const addedMs = unserved
			.filter((other) => other.driverNumber === penalty.driverNumber)
			.reduce((sum, other) => sum + (other.seconds ?? 0) * 1000, 0);

		return !appliedByFeed(snapshot, penalty.driverNumber, addedMs);
	});
}

/**
 * The unserved time penalties of a race, for the seasons no other source covers: a session with
 * a saved OpenF1 result (2023 on) takes its penalties from there instead.
 */
export class UnservedPenalties implements CorrectionSource {
	private readonly dataDir: string;

	constructor(dataDir: string) {
		this.dataDir = dataDir;
	}

	async load({
		key,
		endedAt,
		snapshot
	}: CorrectionTarget): Promise<ClassificationCorrectionEvent[]> {
		const covered = await access(openF1CacheOf(this.dataDir, key)).then(
			() => true,
			() => false
		);

		return covered
			? []
			: unservedPenalties(snapshot).map((penalty) => ({
					kind: 'classification_correction',
					at: endedAt,
					correction: {
						driverNumber: penalty.driverNumber,
						kind: 'time_penalty',
						seconds: penalty.seconds,
						reason: `${penalty.seconds} second time penalty not served: ${penalty.reason}`
					}
				}));
	}
}
