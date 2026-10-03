import type { TyreCompound } from '@f1-live/shared';
import * as React from 'react';

import { Digits } from '@/components/console/digits';
import { EmptyNote } from '@/components/console/empty-note';
import { KeyGroup } from '@/components/console/keys';
import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { TyreBadge } from '@/components/tyre-badge';
import { useRaceView } from '@/data/race-context';
import { LONG_RUN_LAPS, longRuns, tyreMileage } from '@/insights/long-runs';
import { formatLapTime } from '@/lib/format';

const VIEWS = [
	{ value: 'runs', label: 'Runs' },
	{ value: 'mileage', label: 'Mileage' }
] as const;

type View = (typeof VIEWS)[number]['value'];

const COMPOUNDS: readonly TyreCompound[] = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'];

/** Practice for the race: each driver's longest run and its pace, or laps on each compound. */
export function LongRuns() {
	const { snapshot, followedDriver } = useRaceView();
	const [view, setView] = React.useState<View>('runs');
	const runs = React.useMemo(() => longRuns(snapshot), [snapshot]);
	const mileage = React.useMemo(() => tyreMileage(snapshot), [snapshot]);
	const fastest = runs[0]?.averageMs ?? 0;

	return (
		<Panel aria-label="Long runs" data-testid="long-runs">
			<PanelHeader
				title="Long runs"
				meta={view === 'runs' ? `${LONG_RUN_LAPS}+ laps on one set` : 'laps per compound'}
			>
				<KeyGroup label="Long runs view" options={VIEWS} value={view} onChange={setView} />
			</PanelHeader>
			{view === 'runs' ? (
				runs.length === 0 ? (
					<EmptyNote>{`No long runs yet: one shows once a car does ${LONG_RUN_LAPS} clean laps on one set.`}</EmptyNote>
				) : (
					<table className="w-full text-sm">
						<thead>
							<tr className="h-8 border-b">
								<th scope="col" className="type-label w-10 pl-4 text-left font-normal">
									#
								</th>
								<th scope="col" className="type-label text-left font-normal">
									Driver
								</th>
								<th scope="col" className="type-label text-left font-normal">
									Tyre
								</th>
								<th
									scope="col"
									className="type-label hidden pr-4 text-right font-normal @sm:table-cell"
								>
									Laps
								</th>
								<th scope="col" className="type-label pr-4 text-right font-normal">
									Average
								</th>
								<th scope="col" className="type-label pr-4 text-right font-normal">
									Fall-off
								</th>
							</tr>
						</thead>
						<tbody>
							{runs.map((run, place) => (
								<tr
									key={run.driver.number}
									data-state={run.driver.number === followedDriver ? 'selected' : undefined}
									className="data-[state=selected]:bg-accent h-8 border-b last:border-b-0"
								>
									<td className="text-muted-foreground pl-4 font-mono text-xs">{place + 1}</td>
									<td>
										<DriverTag driver={run.driver} />
									</td>
									<td>
										<TyreBadge compound={run.compound} />
									</td>
									<td
										className="hidden pr-4 text-right font-mono @sm:table-cell"
										title={`Laps ${run.fromLap} to ${run.toLap}`}
									>
										{run.laps}
									</td>
									<td className="pr-4 text-right">
										<Digits
											value={
												place === 0
													? formatLapTime(run.averageMs)
													: `+${((run.averageMs - fastest) / 1000).toFixed(3)}`
											}
										/>
									</td>
									<td className="pr-4 text-right whitespace-nowrap">
										<Digits
											value={`${run.fallOffMs < 0 ? '−' : '+'}${(Math.abs(run.fallOffMs) / 1000).toFixed(3)}`}
										/>
										<span className="type-label"> /lap</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)
			) : mileage.length === 0 ? (
				<EmptyNote />
			) : (
				<ol className="flex flex-col px-4 py-1">
					{mileage.map((entry) => (
						<li
							key={entry.driver.number}
							className="flex items-center gap-3 border-b py-1.5 last:border-b-0"
						>
							<DriverTag driver={entry.driver} className="w-16" />
							<span className="flex flex-1 flex-wrap gap-x-3 gap-y-1">
								{COMPOUNDS.flatMap((compound) => {
									const laps = entry.byCompound.get(compound);

									return laps
										? [
												<span key={compound} className="flex items-center gap-1">
													<TyreBadge compound={compound} />
													<span className="font-mono text-xs">{laps}</span>
												</span>
											]
										: [];
								})}
							</span>
							<span className="font-mono text-sm">{entry.total}</span>
						</li>
					))}
				</ol>
			)}
		</Panel>
	);
}
