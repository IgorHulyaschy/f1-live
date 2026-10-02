import { FocusPanel } from '@/features/live/focus-panel';
import { RaceControlFeed } from '@/features/live/race-control-feed';
import { TimingTower } from '@/features/live/timing-tower';

export function LivePage() {
	return (
		<div className="bg-border grid gap-px overflow-hidden rounded-lg border lg:grid-cols-[minmax(0,1fr)_24rem]">
			<TimingTower />
			<div className="bg-border flex flex-col gap-px">
				<FocusPanel />
				<RaceControlFeed />
			</div>
		</div>
	);
}
