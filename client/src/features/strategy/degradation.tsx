import type { RaceSnapshot } from '@f1-live/shared';
import * as React from 'react';

import { TableKey } from '@/components/console/data-table';
import { Digits } from '@/components/console/digits';
import { EmptyNote } from '@/components/console/empty-note';
import { KeyGroup } from '@/components/console/keys';
import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { ProGate } from '@/components/pro-gate';
import { TyreBadge } from '@/components/tyre-badge';
import { useRaceView } from '@/data/race-context';
import { stintPaces } from '@/insights/tyre-pace';
import { formatDeltaSeconds, formatLapTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import { useTileFill } from '../dashboard/tile-fill';

// The chart library loads only when the curves are shown.
const TyreLifeChart = React.lazy(async () => ({
	default: (await import('./tyre-life-chart')).TyreLifeChart
}));

const VIEWS = [
	{ value: 'curves', label: 'Curves' },
	{ value: 'stints', label: 'Stints' }
] as const;

type View = (typeof VIEWS)[number]['value'];

const SHOWN_STINTS = 10;

/** Wear bars are full at this loss per lap. */
const WEAR_SCALE_SECONDS = 0.08;

/** Above this, a stint is wearing fast enough to force an earlier stop. */
const HIGH_WEAR_SECONDS = 0.04;

/**
 * Tyre wear two ways: curves of lap time against tyre age per compound, with the cliff and the
 * crossover, and each stint's loss per lap, highest first.
 */
export function Degradation() {
	const { snapshot } = useRaceView();
	const fill = useTileFill();
	const [view, setView] = React.useState<View>('curves');
	const [table, setTable] = React.useState(false);

	return (
		<Panel
			aria-label="Tyre wear"
			data-testid="degradation"
			className={cn('min-h-0', fill && 'h-full')}
		>
			<PanelHeader title="Tyre wear" meta={view === 'curves' ? 'by tyre age' : 'highest first'}>
				<KeyGroup label="Tyre wear view" options={VIEWS} value={view} onChange={setView} />
				{view === 'curves' ? <TableKey table={table} onTableChange={setTable} /> : null}
			</PanelHeader>
			<div className={cn('flex flex-col gap-3 p-4', fill && 'min-h-0 flex-1')}>
				<ProGate
					feature="Tyre wear"
					teaser="How fast each compound loses time with age, where it falls off, and when a new set of the harder one is quicker."
				>
					{view === 'curves' ? (
						<React.Suspense
							fallback={<p className="text-muted-foreground text-sm">Loading curves…</p>}
						>
							<TyreLifeChart table={table} />
						</React.Suspense>
					) : (
						<StintWear snapshot={snapshot} />
					)}
				</ProGate>
			</div>
		</Panel>
	);
}

/** Each stint's fitted loss per lap, highest first. */
function StintWear({ snapshot }: { snapshot: RaceSnapshot }) {
	const drivers = new Map(snapshot.drivers.map((driver) => [driver.number, driver]));

	const stints = stintPaces(snapshot)
		.toSorted((a, b) => b.degradationSecondsPerLap - a.degradationSecondsPerLap)
		.slice(0, SHOWN_STINTS);

	if (stints.length === 0) {
		return <EmptyNote className="px-0">Wear shows once a stint has a few clean laps.</EmptyNote>;
	}

	return (
		<>
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b">
						<th scope="col" className="type-label pb-1.5 text-left font-normal">
							Driver
						</th>
						<th scope="col" className="type-label pb-1.5 text-left font-normal">
							Stint
						</th>
						<th scope="col" className="type-label hidden pb-1.5 font-normal @md:table-cell">
							<span className="sr-only">Wear bar</span>
						</th>
						<th scope="col" className="type-label pb-1.5 text-right font-normal">
							Per lap
						</th>
						<th scope="col" className="type-label pb-1.5 text-right font-normal">
							New-tyre pace
						</th>
					</tr>
				</thead>
				<tbody>
					{stints.map((stint) => {
						const driver = drivers.get(stint.driverNumber);
						const wear = Math.max(stint.degradationSecondsPerLap, 0);

						return (
							<tr
								key={`${stint.driverNumber}-${stint.stint}`}
								className="h-9 border-b last:border-b-0"
							>
								<td>{driver ? <DriverTag driver={driver} /> : stint.driverNumber}</td>
								<td>
									<span className="flex items-center gap-2">
										<TyreBadge compound={stint.compound} />
										<span className="type-label">
											S{stint.stint} {stint.cleanLaps}L
										</span>
									</span>
								</td>
								<td className="hidden w-1/3 px-3 @md:table-cell" aria-hidden>
									<span aria-hidden className="border-rule-strong relative block h-2 border-l">
										<span
											className={cn(
												'absolute inset-y-0 left-0 w-(--size)',
												wear > HIGH_WEAR_SECONDS ? 'bg-danger' : 'bg-foreground/50'
											)}
											style={{ '--size': `${Math.min(wear / WEAR_SCALE_SECONDS, 1) * 100}%` }}
										/>
									</span>
								</td>
								<td className="text-right">
									<Digits value={formatDeltaSeconds(stint.degradationSecondsPerLap, 3)} />
								</td>
								<td className="text-right">
									<Digits
										className="text-muted-foreground"
										value={formatLapTime(Math.round(stint.newTyrePaceSeconds * 1000))}
									/>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
			<p className="text-muted-foreground text-xs">
				Fitted from clean laps in each stint, fuel-corrected. Values near zero or below it mean the
				tyre is not yet the limiting factor; short stints are noisy.
			</p>
		</>
	);
}
