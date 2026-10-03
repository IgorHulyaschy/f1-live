import type { RaceSnapshot } from '@f1-live/shared';

/**
 * The race as it stood when the leader completed `lap`. The feed's running order is the order
 * now, so only the latest lap keeps it.
 */
export function snapshotAtLap(race: RaceSnapshot, lap: number): RaceSnapshot {
	const currentLap = Math.min(Math.max(lap, 1), race.currentLap);
	const laps = race.laps.filter((entry) => entry.lap <= currentLap);
	const { standings, ...rest } = race;

	const slice: RaceSnapshot = {
		...rest,
		currentLap,
		trackStatus: laps.findLast((entry) => entry.lap === currentLap)?.trackStatus ?? 'green',
		laps,
		stints: race.stints
			.filter((stint) => stint.startLap <= currentLap)
			.map((stint) => ({ ...stint, endLap: Math.min(stint.endLap, currentLap) })),
		pitStops: race.pitStops.filter((stop) => stop.lap <= currentLap),
		raceControl: race.raceControl.filter((message) => message.lap <= currentLap),
		weather: race.weather.filter((sample) => sample.lap <= currentLap),
		retirements: race.retirements.filter((retirement) => retirement.lap <= currentLap)
	};

	return currentLap >= race.currentLap && standings ? { ...slice, standings } : slice;
}
