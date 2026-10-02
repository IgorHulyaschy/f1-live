import { Digits } from '@/components/console/digits';
import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { TyreBadge } from '@/components/tyre-badge';
import { useRace } from '@/data/race-context';
import { cn } from '@/lib/utils';

/** Bars span this much either side of the median green-flag stop. */
const SCALE_MS = 1500;

function median(values: readonly number[]): number {
	const sorted = values.toSorted((a, b) => a - b);

	return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** Every stop against the typical green-flag stop: quicker to the left, slower to the right. */
export function PitStops() {
	const { snapshot } = useRace();
	const drivers = new Map(snapshot.drivers.map((driver) => [driver.number, driver]));
	const stops = snapshot.pitStops.toReversed();

	// Only a VSC or Safety Car makes a stop cheap; a local yellow does not.
	const neutralised = new Set(
		snapshot.laps.flatMap((lap) =>
			lap.trackStatus === 'vsc' || lap.trackStatus === 'safety_car'
				? [`${lap.driverNumber}-${lap.lap}`]
				: []
		)
	);

	const typical = median(
		snapshot.pitStops.flatMap((stop) =>
			neutralised.has(`${stop.driverNumber}-${stop.lap}`) ? [] : [stop.laneTimeMs]
		)
	);

	return (
		<Panel aria-label="Pit stops" data-testid="pit-stops">
			<PanelHeader
				title="Pit stops"
				meta={`${stops.length} so far, typical ${(typical / 1000).toFixed(1)}s`}
			/>
			{stops.length === 0 ? (
				<p className="text-muted-foreground p-4 text-sm">No stops yet.</p>
			) : (
				<ol className="flex max-h-120 flex-col overflow-y-auto px-4 py-1">
					{stops.map((stop) => {
						const driver = drivers.get(stop.driverNumber);
						const cheap = neutralised.has(`${stop.driverNumber}-${stop.lap}`);
						const delta = stop.laneTimeMs - typical;
						const share = Math.min(Math.abs(delta) / SCALE_MS, 1) * 50;

						const fitted = snapshot.stints.find(
							(stint) => stint.driverNumber === stop.driverNumber && stint.startLap === stop.lap + 1
						);

						return (
							<li
								key={`${stop.driverNumber}-${stop.lap}`}
								className="grid h-9 grid-cols-[2.5rem_3.5rem_2rem_minmax(0,1fr)_4rem] items-center gap-3 border-b last:border-b-0"
							>
								<span className="text-muted-foreground font-mono text-xs">L{stop.lap}</span>
								{driver ? <DriverTag driver={driver} /> : <span />}
								{fitted ? (
									<TyreBadge compound={fitted.compound} />
								) : (
									<span className="type-label">Lane</span>
								)}
								{cheap ? (
									<span className="type-label text-flag font-bold">VSC stop, nearly free</span>
								) : (
									<span aria-hidden className="relative h-2">
										<span className="bg-rule-strong absolute inset-y-0 left-1/2 w-px" />
										<span
											className={cn(
												'absolute inset-y-0 w-(--size)',
												delta < 0 ? 'bg-personal-best right-1/2' : 'bg-foreground/50 left-1/2'
											)}
											style={{ '--size': `${share}%` }}
										/>
									</span>
								)}
								<Digits
									className="text-right text-sm"
									value={`${(stop.laneTimeMs / 1000).toFixed(1)}s`}
								/>
							</li>
						);
					})}
				</ol>
			)}
		</Panel>
	);
}
