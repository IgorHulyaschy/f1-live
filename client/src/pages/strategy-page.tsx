import { Degradation } from '@/features/strategy/degradation';
import { PitStops } from '@/features/strategy/pit-stops';
import { StintChart } from '@/features/strategy/stint-chart';

export function StrategyPage() {
	return (
		<div className="flex flex-col gap-6">
			<StintChart />
			<div className="grid gap-y-6 lg:grid-cols-2 lg:gap-y-0">
				<div className="lg:border-r">
					<Degradation />
				</div>
				<PitStops />
			</div>
		</div>
	);
}
