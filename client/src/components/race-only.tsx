import type * as React from 'react';

import { SESSION_TYPE_LABEL } from '@/data/catalog';
import { useRace } from '@/data/race-context';
import { isTimedSession } from '@/insights/qualifying';

/**
 * Race tools in practice and qualifying: a quiet line saying what the tool is for, instead of a
 * prediction that would mean nothing on single laps.
 */
export function RaceOnly({
	what,
	applies = true,
	children
}: {
	what: string;
	/** False when this use of the tile works in any session. */
	applies?: boolean;
	children: React.ReactNode;
}) {
	const { race } = useRace();

	if (!applies || !isTimedSession(race.session.type)) {
		return children;
	}

	return (
		<p className="text-muted-foreground text-sm" data-testid="race-only">
			{what} applies to races; this is {race.session.name ?? SESSION_TYPE_LABEL[race.session.type]}.
		</p>
	);
}
