import * as React from 'react';

import { Digits } from '@/components/console/digits';
import { EmptyNote } from '@/components/console/empty-note';
import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { useRaceView } from '@/data/race-context';
import { bestSectors } from '@/insights/sectors';
import { formatGap, formatLapTime, formatSectorTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const SECTORS = [0, 1, 2] as const;

/**
 * The fastest time in each sector and who holds it, then every driver's ideal lap from their
 * own best sectors, with the time their best lap left on the table.
 */
export function BestSectors() {
	const { snapshot, followedDriver } = useRaceView();
	const { fastest, ideal } = React.useMemo(() => bestSectors(snapshot), [snapshot]);

	const idealOfBests = fastest.every((holder) => holder !== null)
		? fastest.reduce((total, holder) => total + (holder?.timeMs ?? 0), 0)
		: null;

	return (
		<Panel aria-label="Best sectors" data-testid="best-sectors">
			<PanelHeader title="Best sectors" meta="ideal laps from each driver’s best sectors" />
			{ideal.length === 0 ? (
				<EmptyNote />
			) : (
				<>
					<dl className="grid grid-cols-3 border-b @lg:grid-cols-4 @lg:divide-x">
						{SECTORS.map((index) => {
							const holder = fastest[index];

							return (
								<div key={index} className="flex min-w-0 flex-col gap-0.5 px-4 py-2">
									<dt className="type-label">S{index + 1} fastest</dt>
									<dd className="flex flex-wrap items-center gap-x-2">
										{holder ? (
											<>
												<DriverTag driver={holder.driver} />
												<Digits
													value={formatSectorTime(holder.timeMs)}
													className="text-fastest text-sm"
												/>
											</>
										) : (
											'-'
										)}
									</dd>
								</div>
							);
						})}
						<div className="hidden min-w-0 flex-col gap-0.5 px-4 py-2 @lg:flex">
							<dt className="type-label">All three</dt>
							<dd>
								{idealOfBests === null ? '-' : <Digits value={formatLapTime(idealOfBests)} />}
							</dd>
						</div>
					</dl>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="h-8 border-b">
									<th scope="col" className="type-label w-10 pl-4 text-left font-normal">
										#
									</th>
									<th scope="col" className="type-label text-left font-normal">
										Driver
									</th>
									{SECTORS.map((index) => (
										<th
											key={index}
											scope="col"
											className="type-label hidden pr-4 text-right font-normal @2xl:table-cell"
										>
											S{index + 1}
										</th>
									))}
									<th scope="col" className="type-label pr-4 text-right font-normal">
										Ideal
									</th>
									<th
										scope="col"
										className="type-label hidden pr-4 text-right font-normal @md:table-cell"
									>
										Best lap
									</th>
									<th scope="col" className="type-label pr-4 text-right font-normal">
										Left
									</th>
								</tr>
							</thead>
							<tbody>
								{ideal.map((entry, place) => (
									<tr
										key={entry.driver.number}
										data-state={entry.driver.number === followedDriver ? 'selected' : undefined}
										className="data-[state=selected]:bg-accent h-8 border-b last:border-b-0"
									>
										<td className="text-muted-foreground pl-4 font-mono text-xs">{place + 1}</td>
										<td>
											<DriverTag driver={entry.driver} />
										</td>
										{SECTORS.map((index) => (
											<td key={index} className="hidden pr-4 text-right @2xl:table-cell">
												<Digits
													value={formatSectorTime(entry.sectorsMs[index])}
													className={cn(
														entry.sectorsMs[index] === fastest[index]?.timeMs && 'text-fastest'
													)}
												/>
											</td>
										))}
										<td className="pr-4 text-right">
											<Digits value={formatLapTime(entry.idealMs)} />
										</td>
										<td className="hidden pr-4 text-right @md:table-cell">
											{entry.bestMs === null ? '-' : <Digits value={formatLapTime(entry.bestMs)} />}
										</td>
										<td className="pr-4 text-right">
											{entry.bestMs === null ? (
												'-'
											) : (
												<Digits
													value={formatGap(Math.max(0, entry.bestMs - entry.idealMs))}
													className="text-muted-foreground"
												/>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			)}
		</Panel>
	);
}
