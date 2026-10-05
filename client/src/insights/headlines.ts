import type { RaceControlMessage, Stint } from '@f1-live/shared';

/** One line in words that a tile leads with, before its numbers. */

export function leaderHeadline(
	rows: readonly { code: string; gapToLeaderMs: number | null }[]
): string | null {
	const [leader, second] = rows;

	if (!leader) {
		return null;
	}

	if (!second || second.gapToLeaderMs === null) {
		return `${leader.code} leads`;
	}

	return `${leader.code} leads ${second.code} by ${(second.gapToLeaderMs / 1000).toFixed(1)} s`;
}

export function fightsHeadline(
	fights: readonly { ahead: string; behind: string; gapSeconds: number }[]
): string {
	const closest = fights.toSorted((a, b) => a.gapSeconds - b.gapSeconds)[0];

	if (!closest) {
		return 'No car is in a fight';
	}

	const others = fights.length - 1;

	return `${closest.behind} is ${closest.gapSeconds.toFixed(1)} s behind ${closest.ahead}${
		others > 0 ? `, and ${others} more ${others === 1 ? 'fight' : 'fights'}` : ''
	}`;
}

export function messageHeadline(messages: readonly RaceControlMessage[]): string | null {
	const latest = messages.at(-1);

	return latest ? `Lap ${latest.lap}: ${latest.message}` : null;
}

export function stintsHeadline(
	stints: readonly Stint[],
	codeOf: (driverNumber: string) => string | undefined,
	compoundName: (compound: Stint['compound']) => string
): string | null {
	let longest: Stint | null = null;

	for (const stint of stints) {
		if (!longest || length(stint) > length(longest)) {
			longest = stint;
		}
	}

	const code = longest ? codeOf(longest.driverNumber) : undefined;

	if (!longest || !code) {
		return null;
	}

	return `${code} ran the longest stint so far, ${length(longest)} laps on ${compoundName(longest.compound).toLowerCase()} tyres`;
}

function length(stint: Stint): number {
	return stint.endLap - stint.startLap + 1;
}
