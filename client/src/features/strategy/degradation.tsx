import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { ProGate } from '@/components/pro-gate';
import { TyreBadge } from '@/components/tyre-badge';
import { useRace } from '@/data/race-context';
import { stintPaces } from '@/insights/tyre-pace';
import { formatDeltaSeconds, formatLapTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const SHOWN_STINTS = 10;

/** Wear bars are full at this loss per lap. */
const WEAR_SCALE_SECONDS = 0.08;

export function Degradation() {
	const { snapshot } = useRace();
	const drivers = new Map(snapshot.drivers.map((driver) => [driver.number, driver]));

	const stints = stintPaces(snapshot)
		.toSorted((a, b) => a.degradationSecondsPerLap - b.degradationSecondsPerLap)
		.slice(0, SHOWN_STINTS);

	return (
		<Panel aria-label="Tyre degradation" data-testid="degradation">
			<PanelHeader title="Tyre wear" meta="loss per lap, fuel corrected" />
			<div className="p-4">
				<ProGate feature="Degradation by stint">
					<ol className="flex flex-col">
						{stints.map((stint) => {
							const driver = drivers.get(stint.driverNumber);
							const wear = Math.max(stint.degradationSecondsPerLap, 0);

							return (
								<li
									key={`${stint.driverNumber}-${stint.stint}`}
									className="grid grid-cols-[3.5rem_3.5rem_minmax(0,1fr)_4.5rem_5rem] items-center gap-3 border-b py-2 font-mono text-sm last:border-b-0"
								>
									{driver ? <DriverTag driver={driver} /> : <span />}
									<TyreBadge compound={stint.compound} age={stint.cleanLaps} />
									<span
										aria-hidden
										className="bg-muted relative h-1.5 overflow-hidden rounded-full"
									>
										<span
											className={cn(
												'absolute inset-y-0 left-0 w-(--size) rounded-full',
												wear > WEAR_SCALE_SECONDS / 2 ? 'bg-warning' : 'bg-personal-best'
											)}
											style={{
												'--size': `${Math.max(Math.min(wear / WEAR_SCALE_SECONDS, 1) * 100, 2)}%`
											}}
										/>
									</span>
									<span className="text-right">
										{formatDeltaSeconds(stint.degradationSecondsPerLap, 3)}
									</span>
									<span className="text-muted-foreground text-right text-xs">
										{formatLapTime(Math.round(stint.newTyrePaceSeconds * 1000))}
									</span>
								</li>
							);
						})}
					</ol>
				</ProGate>
				<p className="text-muted-foreground mt-3 text-xs">
					Lowest wear first. The last column is the fitted pace on a new set of that compound.
				</p>
			</div>
		</Panel>
	);
}
