import type { Lap, RaceSnapshot } from '@f1-live/shared';

import { plural } from '../lib/format.ts';
import { type LapRange, lapsToReach, type PairPace, pairPace } from './battle.ts';
import { isCleanLap } from './clean-laps.ts';
import { paceNow } from './pace-now.ts';
import { type StandingRow, standingsAt } from './standings.ts';

/** Below this a lap the two are matched on pace. */
const MATCHED_SECONDS_PER_LAP = 0.05;

export interface DuelLap {
	lap: number;
	/** Seconds the second driver was quicker on this lap; null when either lap was not clean. */
	gainSeconds: number | null;
	/** How far the second driver was behind the first at the line; negative when ahead. */
	gapSeconds: number | null;
	/** Why the lap was not clean: a stop, or a flag that slowed the field. */
	mark: 'pit' | 'neutral' | null;
}

export interface Duel {
	first: StandingRow;
	second: StandingRow;
	laps: readonly DuelLap[];
	/** The second driver against the first: positive when the second is faster. */
	pace: PairPace | null;
	/**
	 * The same over each driver's own last clean laps, fuel taken out, for when they have too few
	 * clean laps together, such as just after one of them stopped. Null when either has too few.
	 */
	ownPaceSecondsPerLap: number | null;
	/** How far the second driver is behind the first now; negative when ahead. */
	gapSeconds: number | null;
}

function lineGap(first: Lap, second: Lap): number {
	return first.completedAt && second.completedAt
		? (Date.parse(second.completedAt) - Date.parse(first.completedAt)) / 1000
		: (second.gapToLeaderMs - first.gapToLeaderMs) / 1000;
}

function lapMark(first: Lap, second: Lap): DuelLap['mark'] {
	if (first.pitIn || first.pitOut || second.pitIn || second.pitOut) {
		return 'pit';
	}

	return first.trackStatus === 'green' && second.trackStatus === 'green' ? null : 'neutral';
}

/** Every lap both drivers have driven, in lap order. */
export function duelLaps(
	snapshot: RaceSnapshot,
	firstNumber: string,
	secondNumber: string
): DuelLap[] {
	const theirs = new Map(
		snapshot.laps.filter((lap) => lap.driverNumber === secondNumber).map((lap) => [lap.lap, lap])
	);

	return snapshot.laps.flatMap((lap): DuelLap[] => {
		const other = lap.driverNumber === firstNumber ? theirs.get(lap.lap) : undefined;

		return other
			? [
					{
						lap: lap.lap,
						gainSeconds:
							isCleanLap(lap) && isCleanLap(other)
								? (lap.lapTimeMs - other.lapTimeMs) / 1000
								: null,
						gapSeconds: lineGap(lap, other),
						mark: lapMark(lap, other)
					}
				]
			: [];
	});
}

/**
 * Two drivers lap by lap: who was quicker on each lap both drove clean, the gap between them at the
 * line, and their pace over the last laps. Any two cars, wherever they are on track.
 */
export function duel(
	snapshot: RaceSnapshot,
	firstNumber: string,
	secondNumber: string,
	rows: readonly StandingRow[] = standingsAt(snapshot)
): Duel | null {
	const first = rows.find((row) => row.driver.number === firstNumber);
	const second = rows.find((row) => row.driver.number === secondNumber);

	if (!first || !second || first === second) {
		return null;
	}

	const laps = duelLaps(snapshot, firstNumber, secondNumber);

	const gapSeconds =
		first.gapToLeaderMs !== null && second.gapToLeaderMs !== null && first.state !== 'out'
			? (second.gapToLeaderMs - first.gapToLeaderMs) / 1000
			: (laps.at(-1)?.gapSeconds ?? null);

	const [firstPace, secondPace] = [first, second].map(
		(row) => paceNow(snapshot, [row])[0]?.paceSeconds
	);

	return {
		first,
		second,
		laps,
		pace: pairPace(snapshot, firstNumber, secondNumber),
		ownPaceSecondsPerLap:
			firstPace === undefined || secondPace === undefined ? null : firstPace - secondPace,
		gapSeconds
	};
}

export type DuelVerdict = {
	/** The car ahead and the one behind it. */
	leader: StandingRow;
	chaser: StandingRow;
	/** Seconds a lap the chaser gains; null without enough clean laps together. */
	closingSecondsPerLap: number | null;
	/** Laps until the chaser is within a second; null when it is not closing. */
	within: LapRange | null;
	text: string;
};

function seconds(value: number): string {
	return `${Math.abs(value).toFixed(1)} s`;
}

export function lapRangeText([low, high]: LapRange, lapsLeft: number): string {
	if (low > lapsLeft) {
		return 'not before the flag';
	}

	if (high === low) {
		return `in about ${plural(low, 'lap')}`;
	}

	return high === null || high > lapsLeft
		? `in ${plural(low, 'lap')} or more`
		: `in ${low} to ${high} laps`;
}

/**
 * The duel in one line, e.g. "NOR is 0.31 s a lap faster over the last 5 laps and 1.2 s behind:
 * in DRS range in about 3 laps". `aid` names the one-second aid: DRS, or overtake from 2026.
 */
export function duelVerdict(
	pair: Duel,
	lapsLeft: number,
	aid: 'DRS' | 'overtake',
	/** The flag pausing racing now, which says why there is no pace to compare. */
	flag: string | null = null
): DuelVerdict | null {
	const { pace, gapSeconds } = pair;

	if (gapSeconds === null) {
		return null;
	}

	const swapped = gapSeconds < 0;
	const leader = swapped ? pair.second : pair.first;
	const chaser = swapped ? pair.first : pair.second;
	const gap = Math.abs(gapSeconds);
	const lead = leader.driver.code;
	const chase = chaser.driver.code;
	const where = `${chase} is ${seconds(gap)} behind ${lead}`;

	if (pace === null) {
		const own = pair.ownPaceSecondsPerLap;
		const gain = own === null ? null : swapped ? -own : own;

		const text =
			gain === null
				? `${where}; ${flag ? `pace is paused under the ${flag}` : 'too few clean laps lately to compare pace'}.`
				: Math.abs(gain) < MATCHED_SECONDS_PER_LAP
					? `${where}; matched on pace over their own last clean laps.`
					: `${where}; ${gain > 0 ? chase : lead} is ${Math.abs(gain).toFixed(2)} s a lap faster over their own last clean laps.`;

		return { leader, chaser, closingSecondsPerLap: null, within: null, text };
	}

	const closing = swapped ? -pace.secondsPerLap : pace.secondsPerLap;
	const over = `over the last ${plural(pace.laps.length, 'lap')}`;
	const within = lapsToReach(gap, { ...pace, secondsPerLap: closing });

	if (Math.abs(closing) < MATCHED_SECONDS_PER_LAP) {
		return {
			leader,
			chaser,
			closingSecondsPerLap: closing,
			within,
			text: `${lead} and ${chase} are matched on pace ${over}; ${where}.`
		};
	}

	const faster = closing > 0 ? chase : lead;
	const rate = `${faster} is ${Math.abs(closing).toFixed(2)} s a lap faster ${over}`;

	if (closing < 0) {
		return {
			leader,
			chaser,
			closingSecondsPerLap: closing,
			within,
			text: `${rate} and ${seconds(gap)} ahead: pulling away.`
		};
	}

	const range = `in ${aid} range`;

	const outlook =
		within === null
			? 'closing slowly'
			: within[0] === 0
				? `${range} now`
				: `${range} ${lapRangeText(within, lapsLeft)}`;

	return {
		leader,
		chaser,
		closingSecondsPerLap: closing,
		within,
		text: `${rate} and ${seconds(gap)} behind: ${outlook}.`
	};
}

/**
 * The pair after one more driver is picked: the one picked last stays and the new one follows it,
 * so the order in the URL is the order the viewer clicked. Null when it is the same driver.
 */
export function pickedPair(
	current: readonly [string, string] | null,
	driverNumber: string
): [string, string] | null {
	const kept = current?.[1];

	return kept && kept !== driverNumber ? [kept, driverNumber] : null;
}
