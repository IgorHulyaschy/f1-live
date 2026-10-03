import { Digits } from '@/components/console/digits';
import { EmptyNote } from '@/components/console/empty-note';
import { TeamStripe } from '@/components/driver-tag';
import { useRace } from '@/data/race-context';
import { battleAhead } from '@/insights/battle';
import { isTimedSession } from '@/insights/qualifying';
import { ONE_SECOND_MS, oneSecondAid } from '@/insights/rules';
import type { StandingRow } from '@/insights/standings';
import { cn } from '@/lib/utils';

/** Cars listed either side of the followed driver. */
const RUNGS = 2;

/** Race time between two running cars on the lead lap, from their gaps to the leader. */
function gapSeconds(from: StandingRow, to: StandingRow): number | null {
	const fromGap = from.position === 1 ? 0 : from.gapToLeaderMs;
	const toGap = to.position === 1 ? 0 : to.gapToLeaderMs;

	return fromGap === null || toGap === null ? null : (toGap - fromGap) / 1000;
}

function Trend({ closing }: { closing: number | null }) {
	if (closing === null || Math.abs(closing) < 0.05) {
		return <span className="text-muted-foreground font-mono text-xs">steady</span>;
	}

	return (
		<span
			className={cn('font-mono text-xs', closing > 0 ? 'text-foreground' : 'text-muted-foreground')}
		>
			{closing > 0 ? 'closing' : 'opening'} {Math.abs(closing).toFixed(2)}/lap
		</span>
	);
}

/**
 * The fight around the followed driver as a ladder: two cars ahead, two behind, each with the
 * race-time gap to you and whether it is closing. In practice and qualifying the gaps are
 * between best laps, and nothing closes.
 */
export function GapLadder() {
	const { snapshot, followedDriver, standings } = useRace();
	const timed = isTimedSession(snapshot.session.type);
	const aid = oneSecondAid(snapshot);
	const rows = standings.filter((row) => row.state !== 'out' && row.lapsDown === 0);
	const index = rows.findIndex((row) => row.driver.number === followedDriver);
	const subject = rows[index];

	if (standings.length === 0 || snapshot.laps.length === 0) {
		return <EmptyNote />;
	}

	if (!subject) {
		const followed = standings.find((row) => row.driver.number === followedDriver);

		return <EmptyNote>{followed?.out ? 'Out of the race.' : 'Not on the lead lap.'}</EmptyNote>;
	}

	const rungs = rows.slice(Math.max(index - RUNGS, 0), index + RUNGS + 1);

	return (
		<ol
			className="flex flex-col py-1"
			data-testid="battle-summary"
			aria-label="Gaps around the followed driver"
		>
			{rungs.map((row) => {
				const isSubject = row === subject;
				const gap = gapSeconds(subject, row);
				const ahead = row.position < subject.position;
				const adjacent = Math.abs(row.position - subject.position) === 1;

				// Closing rate between the adjacent pair, seen from the chasing car.
				const battle =
					adjacent && !timed
						? ahead
							? battleAhead(snapshot, subject.driver.number)
							: battleAhead(snapshot, row.driver.number)
						: null;

				return (
					<li
						key={row.driver.number}
						className={cn(
							'grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-1.5',
							isSubject && 'bg-accent'
						)}
					>
						<span className="font-mono text-xs">P{row.position}</span>
						<span className="flex min-w-0 items-center gap-2">
							<TeamStripe driver={row.driver} />
							<span className="type-wide text-sm font-bold">{row.driver.code}</span>
							{battle && !isSubject ? <Trend closing={battle.closingSecondsPerLap} /> : null}
						</span>
						{isSubject ? (
							<span className="type-label text-foreground">You</span>
						) : gap === null ? (
							<span className="text-muted-foreground font-mono text-sm">-</span>
						) : (
							<span className="flex items-center gap-2">
								{adjacent &&
								ahead &&
								!timed &&
								aid.enabled !== false &&
								Math.abs(gap) * 1000 < ONE_SECOND_MS ? (
									<span className="type-label text-foreground border px-1">{aid.code}</span>
								) : null}
								<Digits
									value={`${gap < 0 ? '−' : '+'}${Math.abs(gap).toFixed(3)}`}
									className="text-sm"
								/>
							</span>
						)}
					</li>
				);
			})}
		</ol>
	);
}
