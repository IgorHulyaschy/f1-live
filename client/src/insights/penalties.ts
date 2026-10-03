import type { RaceSnapshot } from '@f1-live/shared';

const TIME_PENALTY = /(\d+) SECOND TIME PENALTY FOR CAR (\d+)/i;

/** Messages that close a penalty rather than issue one. */
const CLEARED = /PENALTY SERVED|REVOKED|CANCELLED|RESCINDED/i;

/**
 * Time penalties still outstanding, in seconds per car number. Real data carries the stewards'
 * decisions; the modelled replay has only race control, which is parsed instead. A served or
 * revoked penalty is taken off again.
 */
export function timePenalties(snapshot: RaceSnapshot): Map<string, number> {
	const penalties = new Map<string, number>();

	if (snapshot.penalties) {
		for (const penalty of snapshot.penalties) {
			const servedBy = penalty.servedLap ?? Infinity;

			if (
				penalty.kind === 'time' &&
				penalty.seconds &&
				penalty.status !== 'revoked' &&
				penalty.lap <= snapshot.currentLap &&
				servedBy > snapshot.currentLap
			) {
				penalties.set(
					penalty.driverNumber,
					(penalties.get(penalty.driverNumber) ?? 0) + penalty.seconds
				);
			}
		}

		return penalties;
	}

	for (const message of snapshot.raceControl) {
		const match = TIME_PENALTY.exec(message.message);
		const seconds = Number(match?.[1]);
		const car = match?.[2];

		if (!car || !Number.isFinite(seconds)) {
			continue;
		}

		const total = (penalties.get(car) ?? 0) + (CLEARED.test(message.message) ? -seconds : seconds);

		if (total > 0) {
			penalties.set(car, total);
		} else {
			penalties.delete(car);
		}
	}

	return penalties;
}

/** Drive-throughs and stop-and-gos the stewards gave and the car has not served yet. */
export function pitPenalties(snapshot: RaceSnapshot): Map<string, 'DT' | 'SG'> {
	const outstanding = new Map<string, 'DT' | 'SG'>();

	for (const penalty of snapshot.penalties ?? []) {
		const served = penalty.servedLap !== undefined && penalty.servedLap <= snapshot.currentLap;

		if (
			(penalty.kind === 'drive_through' || penalty.kind === 'stop_go') &&
			penalty.status !== 'revoked' &&
			penalty.lap <= snapshot.currentLap &&
			!served
		) {
			outstanding.set(penalty.driverNumber, penalty.kind === 'drive_through' ? 'DT' : 'SG');
		}
	}

	return outstanding;
}
