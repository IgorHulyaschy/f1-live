import { Degradation } from '@/features/strategy/degradation';
import { PitStops } from '@/features/strategy/pit-stops';
import { StintChart } from '@/features/strategy/stint-chart';

export function StrategyPage() {
	return (
		<div className="bg-border grid gap-px overflow-hidden rounded-lg border lg:grid-cols-2">
			<div className="lg:col-span-2">
				<StintChart />
			</div>
			<Degradation />
			<PitStops />
		</div>
	);
}
