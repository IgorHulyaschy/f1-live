import * as React from 'react';

import { DataTable, TableKey } from '@/components/console/data-table';
import { Digits } from '@/components/console/digits';
import { Field, Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { RaceOnly } from '@/components/race-only';
import { useRaceView } from '@/data/race-context';
import { pitStopCost, type StopCost } from '@/insights/pit-cost';
import { cn } from '@/lib/utils';

/** The cost axis runs this far either side of the typical green stop. */
const AXIS_SPAN_MS = 12_000;

function seconds(ms: number | null): string {
	return ms === null ? '–' : `${(ms / 1000).toFixed(1)} s`;
}

/** Stops stack in rows so marks at nearly the same cost stay apart. */
const ROW_CLASS = ['top-2', 'top-5', 'top-8', 'top-11'] as const;

const UNUSUAL_TEXT = { 'opening-lap': 'opening lap', slow: 'slow stop' } as const;

function describe(entry: StopCost): string {
	const notes = [
		entry.neutralised ? 'under VSC or Safety Car' : null,
		entry.unusual ? UNUSUAL_TEXT[entry.unusual] : null
	].filter((note) => note !== null);

	return notes.length > 0 ? notes.join(', ') : 'green flag';
}

/**
 * What a pit stop costs at this circuit in race time, measured from this race: each stop's in-lap
 * and out-lap against the pace the driver would have done, the typical green stop, and how much
 * a VSC or Safety Car takes off.
 */
export function PitCost() {
	const { snapshot } = useRaceView();
	const [table, setTable] = React.useState(false);
	const cost = React.useMemo(() => pitStopCost(snapshot), [snapshot]);
	const drivers = new Map(snapshot.drivers.map((driver) => [driver.number, driver]));
	const centre = cost.greenMs ?? 22_000;
	const at = (ms: number) => Math.min(Math.max(50 + ((ms - centre) / AXIS_SPAN_MS) * 50, 0), 100);
	const costed = cost.stops.filter((entry) => entry.costMs !== null);

	return (
		<Panel aria-label="Pit stop cost" data-testid="pit-cost">
			<PanelHeader title="Stop cost" meta={snapshot.session.circuit}>
				<TableKey table={table} onTableChange={setTable} />
			</PanelHeader>
			<div className="flex flex-col gap-4 p-4">
				<RaceOnly what="Pit stop cost">
					<dl className="flex flex-wrap gap-x-6 gap-y-3">
						<Field label="Green stop">
							<Digits className="text-2xl font-bold" value={seconds(cost.greenMs)} />
						</Field>
						<Field label="Under VSC or SC">
							<Digits className="text-2xl font-bold" value={seconds(cost.neutralisedMs)} />
						</Field>
						<Field label="In the pit lane">
							<Digits value={seconds(cost.laneMs)} />
						</Field>
						<Field label="Stationary">
							<Digits value={seconds(cost.stationaryMs)} />
						</Field>
					</dl>
					{costed.length === 0 ? (
						<p className="text-muted-foreground text-sm">No stops yet.</p>
					) : table ? (
						<DataTable
							caption="What each stop cost"
							columns={[
								{ key: 'lap', label: 'Lap' },
								{ key: 'driver', label: 'Driver' },
								{ key: 'cost', label: 'Cost', numeric: true },
								{ key: 'lane', label: 'Lane', numeric: true },
								{ key: 'still', label: 'Still', numeric: true },
								{ key: 'note', label: 'Conditions' }
							]}
							rows={cost.stops.map((entry) => {
								const driver = drivers.get(entry.stop.driverNumber);

								return {
									id: `${entry.stop.driverNumber}-${entry.stop.lap}`,
									lap: `L${entry.stop.lap}`,
									driver: driver ? <DriverTag driver={driver} /> : entry.stop.driverNumber,
									cost: seconds(entry.costMs),
									lane: seconds(entry.stop.laneTimeMs),
									still: seconds(entry.stop.stationaryMs ?? null),
									note: describe(entry)
								};
							})}
						/>
					) : (
						<figure className="flex flex-col gap-1">
							<div className="relative h-16 border-b" aria-hidden>
								<span className="bg-rule-strong absolute inset-y-0 left-1/2 w-px" />
								{costed.map((entry, index) => {
									const driver = drivers.get(entry.stop.driverNumber);

									return (
										<span
											key={`${entry.stop.driverNumber}-${entry.stop.lap}`}
											title={`${driver?.code ?? entry.stop.driverNumber} L${entry.stop.lap}: ${seconds(entry.costMs)}, ${describe(entry)}`}
											className={cn(
												'absolute left-(--offset) size-2.5 -translate-x-1/2 border',
												ROW_CLASS[index % ROW_CLASS.length],
												entry.unusual
													? 'border-muted-foreground hatch text-muted-foreground'
													: entry.neutralised
														? 'bg-flag border-flag'
														: 'bg-foreground border-foreground'
											)}
											style={{ '--offset': `${at(entry.costMs ?? centre)}%` }}
										/>
									);
								})}
							</div>
							<figcaption className="type-label flex justify-between">
								<span>{seconds(centre - AXIS_SPAN_MS)}</span>
								<span className="text-foreground">Typical {seconds(cost.greenMs)}</span>
								<span>{seconds(centre + AXIS_SPAN_MS)}</span>
							</figcaption>
						</figure>
					)}
					<p className="text-muted-foreground text-xs">
						Race time each stop took: its in-lap and out-lap against the driver’s own clean laps
						around it, or under a VSC or Safety Car against the cars that stayed out. Yellow marks
						are stops under a neutralisation; hatched ones, on the opening lap or slow in the box,
						are left out of the typical cost.
					</p>
				</RaceOnly>
			</div>
		</Panel>
	);
}
