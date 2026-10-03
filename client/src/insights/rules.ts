import type { Session } from '@f1-live/shared';

/**
 * DRS went with the 2026 rules: the moveable wings open for everyone on the straights, and a car
 * within a second of the one ahead at the detection point gets overtake mode instead.
 */
export function hasDrs(session: Pick<Session, 'startsAt'>): boolean {
	return new Date(session.startsAt).getUTCFullYear() < 2026;
}
