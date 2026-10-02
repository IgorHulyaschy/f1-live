import type { RaceSnapshot } from '@f1-live/shared';

const TIME_PENALTY = /(\d+) SECOND TIME PENALTY FOR CAR (\d+)/i;

/** Messages that close a penalty rather than issue one. */
const CLEARED = /PENALTY SERVED|REVOKED|CANCELLED|RESCINDED/i;

/**
 * Time penalties still outstanding, in seconds per car number, parsed from race control.
 * A served or revoked penalty is taken off again.
 */
export function timePenalties(snapshot: RaceSnapshot): Map<string, number> {
	const penalties = new Map<string, number>();

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
