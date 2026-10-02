import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { TyreBadge } from '@/components/tyre-badge';
import { useRace } from '@/data/race-context';

/** Lane-time bars span this range, so differences between stops are visible. */
const LANE_MIN_MS = 10_000;

const LANE_MAX_MS = 24_000;

export function PitStops() {
	const { snapshot } = useRace();
	const drivers = new Map(snapshot.drivers.map((driver) => [driver.number, driver]));
	const stops = snapshot.pitStops.toReversed();

	const neutralised = new Set(
		snapshot.laps
			.filter((lap) => lap.trackStatus !== 'green')
			.map((lap) => `${lap.driverNumber}-${lap.lap}`)
	);

	return (
		<Panel aria-label="Pit stops" data-testid="pit-stops">
			<PanelHeader title="Pit stops" meta={`${stops.length} so far`} />
			{stops.length === 0 ? (
				<p className="text-muted-foreground p-4 text-sm">No stops yet.</p>
			) : (
				<ol className="flex max-h-120 flex-col overflow-y-auto px-4 py-2">
					{stops.map((stop) => {
						const driver = drivers.get(stop.driverNumber);
						const cheap = neutralised.has(`${stop.driverNumber}-${stop.lap}`);

						const fitted = snapshot.stints.find(
							(stint) => stint.driverNumber === stop.driverNumber && stint.startLap === stop.lap + 1
						);

						const share = (stop.laneTimeMs - LANE_MIN_MS) / (LANE_MAX_MS - LANE_MIN_MS);

						return (
							<li
								key={`${stop.driverNumber}-${stop.lap}`}
								className="grid grid-cols-[2.5rem_3.5rem_4.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 border-b py-2 font-mono text-sm last:border-b-0"
							>
								<span className="text-muted-foreground text-xs">L{stop.lap}</span>
								{driver ? <DriverTag driver={driver} /> : <span />}
								<span className="flex items-center gap-1.5">
									{fitted ? (
										<TyreBadge compound={fitted.compound} />
									) : (
										<span className="text-muted-foreground text-xs">In lane</span>
									)}
									{cheap ? (
										<span className="bg-safety-car text-background font-display rounded-sm px-1 text-xs font-bold">
											VSC
										</span>
									) : null}
								</span>
								<span aria-hidden className="bg-muted relative h-1.5 overflow-hidden rounded-full">
									<span
										className={
											cheap
												? 'bg-safety-car absolute inset-y-0 left-0 w-(--size) rounded-full'
												: 'bg-foreground/50 absolute inset-y-0 left-0 w-(--size) rounded-full'
										}
										style={{ '--size': `${Math.min(Math.max(share, 0.04), 1) * 100}%` }}
									/>
								</span>
								<span className="text-right">{(stop.laneTimeMs / 1000).toFixed(1)}s</span>
							</li>
						);
					})}
				</ol>
			)}
		</Panel>
	);
}
