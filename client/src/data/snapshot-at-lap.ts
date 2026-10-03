import type { RaceSnapshot } from '@f1-live/shared';

import { bestsSoFar } from './snapshot-at-time.ts';

/**
 * The race as it stood when the leader completed `lap`. The feed's running order, its personal
 * bests and speeds are as of now, and corrections are decided after the flag, so only the latest
 * lap keeps them.
 */
export function snapshotAtLap(race: RaceSnapshot, lap: number): RaceSnapshot {
	const currentLap = Math.min(Math.max(lap, 1), race.currentLap);
	const laps = race.laps.filter((entry) => entry.lap <= currentLap);
	const { standings, corrections, personalBests, ...rest } = race;

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
		retirements: race.retirements.filter((retirement) => retirement.lap <= currentLap),
		penalties: race.penalties
			?.filter((penalty) => penalty.lap <= currentLap)
			.map(({ servedLap, ...penalty }) =>
				servedLap !== undefined && servedLap > currentLap
					? { ...penalty, status: 'issued' }
					: { ...penalty, servedLap }
			),
		overtakes: race.overtakes?.filter((pass) => pass.lap <= currentLap),
		teamRadio: race.teamRadio?.filter((clip) => clip.lap <= currentLap),
		personalBests: personalBests ? bestsSoFar(race, laps) : undefined
	};

	return currentLap >= race.currentLap
		? { ...slice, standings, corrections, personalBests }
		: slice;
}
