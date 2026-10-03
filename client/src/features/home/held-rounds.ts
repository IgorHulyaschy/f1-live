import type { SeasonResults, SessionFilter } from '@f1-live/shared/results';

/**
 * The rounds whose race or sprint the standings leave out, unseen and recent, with those
 * sessions, so a note can say how many and reveal them in one go.
 */
export function heldRounds(season: SeasonResults, include: SessionFilter) {
	const held = season.rounds.map((round) => ({
		round,
		sessions: round.sessions.filter(
			(session) => (session.type === 'race' || session.type === 'sprint') && !include(session.key)
		)
	}));

	const rounds = held.filter((entry) => entry.sessions.length > 0);

	return {
		rounds: rounds.map((entry) => entry.round),
		sessions: rounds.flatMap((entry) => entry.sessions)
	};
}
