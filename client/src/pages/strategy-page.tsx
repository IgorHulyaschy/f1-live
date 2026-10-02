import { DegradationCard } from '@/features/strategy/degradation-card';
import { PitStopsCard } from '@/features/strategy/pit-stops-card';
import { StintTimelineCard } from '@/features/strategy/stint-timeline-card';

export function StrategyPage() {
	return (
		<div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_28rem]">
			<StintTimelineCard />
			<div className="flex flex-col gap-4">
				<DegradationCard />
				<PitStopsCard />
			</div>
		</div>
	);
}
