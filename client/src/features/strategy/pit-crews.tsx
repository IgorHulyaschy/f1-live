import * as React from 'react';

import { DataTable, TableKey } from '@/components/console/data-table';
import { Digits } from '@/components/console/digits';
import { EmptyNote } from '@/components/console/empty-note';
import { Panel, PanelHeader } from '@/components/console/panel';
import { TeamStripe } from '@/components/driver-tag';
import { RaceOnly } from '@/components/race-only';
import { useRaceView } from '@/data/race-context';
import { crewLeague } from '@/insights/pit-cost';
import { cn } from '@/lib/utils';

/** The bars run from zero to this, so a usual stop of about three seconds sits mid-way. */
const SCALE_MS = 6000;

function barAt(ms: number): string {
	return `${Math.min(ms / SCALE_MS, 1) * 100}%`;
}

function seconds(ms: number): string {
	return `${(ms / 1000).toFixed(1)}`;
}

/**
 * The pit crew league: every team's stops at a standstill, ranked by their usual stop. A bar
 * runs to the team's usual time, each stop is a tick on it, and slow stops are flagged.
 */
export function PitCrews() {
	const { snapshot } = useRaceView();
	const [table, setTable] = React.useState(false);
	const league = React.useMemo(() => crewLeague(snapshot), [snapshot]);
	const codes = new Map(snapshot.drivers.map((driver) => [driver.number, driver.code]));

	return (
		<Panel aria-label="Pit crew league" data-testid="pit-crews">
			<PanelHeader title="Pit crews" meta="stationary, usual stop">
				<TableKey table={table} onTableChange={setTable} />
			</PanelHeader>
			<div className="flex flex-col gap-3 p-4">
				<RaceOnly what="The pit crew league">
					{league.length === 0 ? (
						<EmptyNote className="px-0">No stop with a stationary time yet.</EmptyNote>
					) : table ? (
						<DataTable
							caption="Each team's stops at a standstill"
							columns={[
								{ key: 'rank', label: '#' },
								{ key: 'team', label: 'Team' },
								{ key: 'usual', label: 'Usual', numeric: true },
								{ key: 'best', label: 'Best', numeric: true },
								{ key: 'stops', label: 'Stops' }
							]}
							rows={league.map((row, index) => ({
								id: row.team,
								rank: `${index + 1}`,
								team: row.team,
								usual: row.medianMs === null ? null : `${seconds(row.medianMs)} s`,
								best: `${seconds(row.bestMs)} s`,
								stops: row.stops
									.map(
										(stop) =>
											`${codes.get(stop.driverNumber) ?? stop.driverNumber} L${stop.lap} ${seconds(stop.stationaryMs)}${stop.slow ? ' slow' : ''}`
									)
									.join(', ')
							}))}
						/>
					) : (
						<ol className="flex flex-col">
							{league.map((row, index) => (
								<li
									key={row.team}
									className="grid h-9 grid-cols-[1.25rem_minmax(0,9rem)_minmax(0,1fr)_3.5rem] items-center gap-3 border-b last:border-b-0"
								>
									<span className="text-muted-foreground text-right font-mono text-xs">
										{index + 1}
									</span>
									<span className="flex min-w-0 items-center gap-2">
										<TeamStripe driver={row.driver} />
										<span className="truncate text-sm font-medium">{row.team}</span>
									</span>
									<span aria-hidden className="border-rule-strong relative h-3 border-l">
										<span
											className="bg-foreground/25 absolute inset-y-0 left-0 w-(--size)"
											style={{ '--size': barAt(row.medianMs ?? 0) }}
										/>
										{row.stops.map((stop) => (
											<span
												key={`${stop.driverNumber}-${stop.lap}`}
												title={`${codes.get(stop.driverNumber) ?? stop.driverNumber} L${stop.lap}: ${seconds(stop.stationaryMs)} s`}
												className={cn(
													'absolute -inset-y-0.5 left-(--offset) w-0.5',
													stop.slow ? 'bg-danger' : 'bg-foreground'
												)}
												style={{ '--offset': barAt(stop.stationaryMs) }}
											/>
										))}
									</span>
									{row.medianMs === null ? (
										<span className="type-label text-right">Slow</span>
									) : (
										<Digits className="text-right text-sm" value={`${seconds(row.medianMs)} s`} />
									)}
								</li>
							))}
						</ol>
					)}
					<p className="text-muted-foreground text-xs">
						Time at a standstill as the timing feed gives it, to a tenth, which can differ from the
						broadcast’s own pit stop timing. Ticks are each stop; red ticks, past the scale or far
						over the field’s usual stop, were problems or served a penalty and are left out of the
						usual time.
					</p>
				</RaceOnly>
			</div>
		</Panel>
	);
}
