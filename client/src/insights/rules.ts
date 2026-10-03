import type { RaceControlMessage, RaceSnapshot, Session } from '@f1-live/shared';

/**
 * DRS went with the 2026 rules: the moveable wings open for everyone on the straights, and a car
 * within a second of the one ahead at the detection point gets overtake mode instead.
 */
export function hasDrs(session: Pick<Session, 'startsAt'>): boolean {
	return new Date(session.startsAt).getUTCFullYear() < 2026;
}

/** Within this of the car ahead at a detection point: DRS until 2025, overtake mode from 2026. */
export const ONE_SECOND_MS = 1000;

const AID_SWITCH = /\b(DRS|OVERTAKE) (ENABLED|DISABLED)\b/;

/** Race control switching the one-second aid on or off: DRS until 2025, overtake mode after. */
export function isAidSwitch(message: RaceControlMessage): boolean {
	return AID_SWITCH.test(message.message);
}

export type OneSecondAid = {
	/** Its short name in the timing: DRS, or OVT for overtake mode. */
	code: 'DRS' | 'OVT';
	name: string;
	/** What race control last said; null before it said anything. */
	enabled: boolean | null;
};

/** The one-second aid of the session's rules, and whether race control has it enabled now. */
export function oneSecondAid(snapshot: RaceSnapshot): OneSecondAid {
	const drs = hasDrs(snapshot.session);
	const last = snapshot.raceControl.findLast(isAidSwitch);
	const enabled = last ? AID_SWITCH.exec(last.message)?.[2] === 'ENABLED' : null;

	return drs
		? { code: 'DRS', name: 'DRS', enabled }
		: { code: 'OVT', name: 'overtake mode', enabled };
}
