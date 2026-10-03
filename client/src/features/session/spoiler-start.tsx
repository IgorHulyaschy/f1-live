import { EyeIcon, PlayIcon } from 'lucide-react';

import { Key } from '@/components/console/keys';
import { SESSION_TYPE_LABEL } from '@/data/catalog';
import { useRaceView } from '@/data/race-context';
import { isKnockout, isTimedSession } from '@/insights/qualifying';

/**
 * At the start of a session whose results are hidden, one line saying so, with Play and, apart
 * from it, the way to the finish. It goes once the replay runs or moves on.
 */
export function SpoilerStart() {
	const { race, spoilers, lap, playing, setPlaying, speed } = useRaceView();

	if (!spoilers.hidden || playing || lap > 1 || race.laps.length === 0) {
		return null;
	}

	const { type } = race.session;
	const name = race.session.name ?? SESSION_TYPE_LABEL[type];

	const start = isKnockout(type)
		? `the start of ${type === 'sprint_qualifying' ? 'SQ1' : 'Q1'}`
		: isTimedSession(type)
			? 'its start'
			: 'lap 1';

	return (
		<aside
			aria-label="Results hidden"
			data-testid="spoiler-start"
			className="border-foreground mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 py-1 pl-3"
		>
			<p className="text-sm">
				<span className="type-label text-foreground mr-2">Results hidden</span>
				{name} opens at {start}, paused.
			</p>
			<span className="flex flex-wrap gap-2">
				<Key
					pressed
					onClick={() => setPlaying(true)}
					aria-label={`Play from the start at ${speed}×`}
				>
					<PlayIcon aria-hidden />
					Play at {speed}×
				</Key>
				<Key onClick={spoilers.reveal}>
					<EyeIcon aria-hidden />
					Jump to the finish (shows results)
				</Key>
			</span>
		</aside>
	);
}
