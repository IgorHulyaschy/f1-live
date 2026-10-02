import { ConditionsCard } from '@/features/live/conditions-card';
import { FollowedDriverCard } from '@/features/live/followed-driver-card';
import { RaceControlCard } from '@/features/live/race-control-card';
import { TimingTable } from '@/features/live/timing-table';

export function LivePage() {
	return (
		<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<TimingTable />
			<aside className="flex flex-col gap-4">
				<FollowedDriverCard />
				<RaceControlCard />
				<ConditionsCard />
			</aside>
		</div>
	);
}
