import { Digits } from '@/components/console/digits';
import { EmptyNote } from '@/components/console/empty-note';
import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { TyreBadge } from '@/components/tyre-badge';
import { useRaceView } from '@/data/race-context';
import { ACTIONABLE, DriverLink } from '@/features/drill/drill-parts';
import { useDrill } from '@/features/drill/use-drill';
import { isCleanLap } from '@/insights/clean-laps';
import { formatLapTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const SHOWN_LAPS = 8;

/** Each driver's best lap so far, quickest first. */
export function FastestLaps() {
	const { snapshot } = useRaceView();
	const drivers = new Map(snapshot.drivers.map((driver) => [driver.number, driver]));
	const best = new Map<string, (typeof snapshot.laps)[number]>();

	for (const lap of snapshot.laps) {
		const current = best.get(lap.driverNumber);

		if (lap.lap > 1 && isCleanLap(lap) && (!current || lap.lapTimeMs < current.lapTimeMs)) {
			best.set(lap.driverNumber, lap);
		}
	}

	const laps = [...best.values()]
		.toSorted((a, b) => a.lapTimeMs - b.lapTimeMs)
		.slice(0, SHOWN_LAPS);

	const { open } = useDrill();
	const fastest = laps[0]?.lapTimeMs ?? 0;

	return (
		<Panel aria-label="Fastest laps">
			<PanelHeader title="Fastest laps" meta="best per driver" />
			{laps.length === 0 ? <EmptyNote /> : null}
			<ol className="flex max-w-2xl flex-col px-4 py-1">
				{laps.map((lap, index) => {
					const driver = drivers.get(lap.driverNumber);

					return (
						<li
							key={lap.driverNumber}
							className="flex items-center gap-3 border-b py-2 font-mono text-sm last:border-b-0"
						>
							<span className="text-muted-foreground w-4 text-right text-xs">{index + 1}</span>
							{driver ? (
								<DriverLink driver={driver}>
									<DriverTag driver={driver} />
								</DriverLink>
							) : null}
							<button
								type="button"
								onClick={() =>
									open({ kind: 'lap', driverNumber: lap.driverNumber, lap: lap.lap, vs: null })
								}
								aria-label={`Open lap ${lap.lap} of ${driver?.code ?? lap.driverNumber}`}
								className={cn(ACTIONABLE, 'text-muted-foreground ml-auto px-1 text-xs')}
							>
								L{lap.lap}
							</button>
							<TyreBadge compound={lap.compound} age={lap.tyreAge} />
							<Digits
								className={cn('w-20 text-right', index === 0 && 'text-fastest')}
								value={
									index === 0
										? formatLapTime(lap.lapTimeMs)
										: `+${((lap.lapTimeMs - fastest) / 1000).toFixed(3)}`
								}
							/>
						</li>
					);
				})}
			</ol>
		</Panel>
	);
}
