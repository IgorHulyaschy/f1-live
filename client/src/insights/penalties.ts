import type { RaceSnapshot } from '@f1-live/shared';

const TIME_PENALTY = /(\d+) SECOND TIME PENALTY FOR CAR (\d+)/i;

/** Time penalties issued so far, in seconds per car number, parsed from race control. */
export function timePenalties(snapshot: RaceSnapshot): Map<string, number> {
	const penalties = new Map<string, number>();

	for (const message of snapshot.raceControl) {
		const match = TIME_PENALTY.exec(message.message);
		const seconds = Number(match?.[1]);
		const car = match?.[2];

		if (car && Number.isFinite(seconds)) {
			penalties.set(car, (penalties.get(car) ?? 0) + seconds);
		}
	}

	return penalties;
}
