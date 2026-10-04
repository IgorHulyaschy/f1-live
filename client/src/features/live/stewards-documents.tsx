import { describeDecision } from '@f1-live/shared/decisions';

import { useSeasonDecisions } from '@/data/decisions-context';
import { useRace, useRaceView } from '@/data/race-context';
import { DecisionLink } from '@/features/history/driver-stewards';

const SHOWN = 5;

/**
 * The stewards' documents of the session on screen, each linking to the FIA's PDF. Where the
 * replay hides what lies ahead, a document appears once the feed has reached the time it came
 * out, so a penalty is never named before the race control message about it.
 */
export default function StewardsDocuments() {
	const { snapshot } = useRaceView();
	const { sessionKey, spoilers } = useRace();
	const state = useSeasonDecisions([new Date(snapshot.session.startsAt).getUTCFullYear()]);

	if (state.status !== 'ready') {
		return null;
	}

	const own = state.value
		.flatMap((season) => season.decisions)
		.filter((decision) => String(decision.sessionKey) === sessionKey);

	const seenUntil = snapshot.raceControl.at(-1)?.at ?? '';
	const shown = spoilers.hidesAhead ? own.filter((d) => d.publishedAt <= seenUntil) : own;

	if (own.length === 0) {
		return null;
	}

	const list = shown.toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, SHOWN);

	return (
		<section aria-label="Stewards’ documents" className="border-t" data-testid="stewards-documents">
			<h3 className="type-label px-4 pt-2">Stewards’ documents</h3>
			<ul className="max-h-48 overflow-y-auto px-4 pb-1">
				{list.map((decision) => (
					<li key={decision.id} className="flex flex-col gap-0.5 border-b py-2 last:border-b-0">
						<span className="text-sm">
							{decision.driverName ?? decision.team ?? 'Stewards'}: {describeDecision(decision)}
						</span>
						<span className="text-xs">
							<DecisionLink decision={decision} />
						</span>
					</li>
				))}
			</ul>
			{shown.length < own.length ? (
				<p className="text-muted-foreground px-4 pb-2 text-xs">
					{own.length - shown.length} more once the replay reaches them.
				</p>
			) : null}
		</section>
	);
}
