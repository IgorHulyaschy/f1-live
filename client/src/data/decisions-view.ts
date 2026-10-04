import type { Decision } from '@f1-live/shared/decisions';
import type { SeasonResults } from '@f1-live/shared/results';

interface SplitDecisions {
	shown: Decision[];
	held: Decision[];
}

/**
 * The decisions a viewer may see, given which sessions count (`includedKeys`). A decision names a
 * penalty and so can give away a result: it is shown with its session, or, when it has none
 * (practice, a document before any session), with its weekend's race. One the results index
 * cannot place is held back.
 */
export function splitDecisions(
	decisions: readonly Decision[],
	seasons: readonly SeasonResults[],
	include: (key: number) => boolean
): SplitDecisions {
	const raceOf = new Map(
		seasons.flatMap((season) =>
			season.rounds.map((round) => [
				round.meetingKey,
				round.sessions.find((session) => session.type === 'race')?.key
			])
		)
	);

	const shown: Decision[] = [];
	const held: Decision[] = [];

	for (const decision of decisions) {
		const key =
			decision.sessionKey ??
			(decision.meetingKey === null ? undefined : raceOf.get(decision.meetingKey));

		(key !== undefined && include(key) ? shown : held).push(decision);
	}

	return { shown, held };
}
