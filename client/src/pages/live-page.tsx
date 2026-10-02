import { FocusPanel } from '@/features/live/focus-panel';
import { RaceControlFeed } from '@/features/live/race-control-feed';
import { TimingTower } from '@/features/live/timing-tower';

/** Phones read top to bottom: your driver, the timing, then race control. */
export function LivePage() {
	return (
		<div className="grid gap-y-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:grid-rows-[auto_1fr] lg:gap-y-0">
			<div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:border-l">
				<FocusPanel />
			</div>
			<div className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
				<TimingTower />
			</div>
			<div className="flex min-w-0 lg:col-start-2 lg:row-start-2 lg:border-l">
				<RaceControlFeed />
			</div>
		</div>
	);
}
