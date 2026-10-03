import type { RaceControlMessage } from '@f1-live/shared';

import type { Zone } from './drs-zones.ts';

export type SectorFlagLevel = 'yellow' | 'double';

/** A yellow shown in one marshal sector, and the race-control message that raised it. */
export type SectorFlag = {
	sector: number;
	level: SectorFlagLevel;
	message: RaceControlMessage;
};

const SECTOR_MESSAGE = /^(DOUBLE YELLOW|YELLOW|CLEAR) IN TRACK SECTOR (\d+)\b/;

/** Clears every sector at once: the track is clear after an incident or a neutralisation. */
const TRACK_CLEAR = /^TRACK CLEAR\b/;

/** The marshal sector a race-control message flags or clears, if it is about one. */
export function flagOf(
	message: RaceControlMessage
): { sector: number; level: SectorFlagLevel | 'clear' } | null {
	const match = SECTOR_MESSAGE.exec(message.message);

	if (!match) {
		return null;
	}

	const level =
		match[1] === 'DOUBLE YELLOW' ? 'double' : match[1] === 'YELLOW' ? 'yellow' : 'clear';

	return { sector: Number(match[2]), level };
}

/** The yellows out in each marshal sector after `messages`, in order, the latest raised first. */
export function sectorFlags(messages: readonly RaceControlMessage[]): SectorFlag[] {
	const out = new Map<number, SectorFlag>();

	for (const message of messages) {
		if (TRACK_CLEAR.test(message.message)) {
			out.clear();
			continue;
		}

		const flag = flagOf(message);

		if (flag?.level === 'clear') {
			out.delete(flag.sector);
		} else if (flag) {
			// Raised again, it moves to the end, so the list stays in the order flags went out.
			out.delete(flag.sector);
			out.set(flag.sector, { sector: flag.sector, level: flag.level, message });
		}
	}

	return [...out.values()].toReversed();
}

/** Marshal sectors are this long on average; a circuit has at least this many of them. */
const MARSHAL_SECTOR_M = 300;

/**
 * How many marshal sectors to lay out: the highest the session's messages name, or one per
 * 300 m when they name fewer. The feed does not publish the count.
 */
export function marshalSectorCount(
	messages: readonly RaceControlMessage[],
	lengthM: number
): number {
	let highest = 0;

	for (const message of messages) {
		highest = Math.max(highest, flagOf(message)?.sector ?? 0);
	}

	return Math.max(highest, Math.round(lengthM / MARSHAL_SECTOR_M));
}

/**
 * Where marshal sector `sector` (from 1) lies, taking the sectors as equal shares of the lap from
 * the line. The feed names sectors but does not say where they are, so this is a guess.
 */
export function marshalSpan(sector: number, count: number, lengthM: number): Zone {
	const share = lengthM / Math.max(1, count);

	return { fromM: (sector - 1) * share, toM: Math.min(lengthM, sector * share) };
}
