import { m } from 'motion/react';
import * as React from 'react';

import { Digits } from '@/components/console/digits';
import { EmptyNote } from '@/components/console/empty-note';
import { Panel, PanelHeader } from '@/components/console/panel';
import { WholeRows } from '@/components/console/whole-rows';
import { DriverTag } from '@/components/driver-tag';
import { RaceOnly } from '@/components/race-only';
import { TyreBadge } from '@/components/tyre-badge';
import { useRace } from '@/data/race-context';
import { pausingFlag } from '@/insights/clean-laps';
import { PACE_NOW_LAPS, type PaceNow, paceNow } from '@/insights/pace-now';
import { cn } from '@/lib/utils';

import { usePair, usePairShown } from './pair-context';

/** Bars run to this many seconds a lap at least, so a field a tenth apart does not look spread. */
const MIN_SCALE_SECONDS = 1;

/** A change per lap smaller than this is no trend. */
const TREND_SECONDS_PER_LAP = 0.05;

function Trend({ entry }: { entry: PaceNow }) {
	const trend = entry.trendSecondsPerLap;

	if (trend === null || Math.abs(trend) < TREND_SECONDS_PER_LAP) {
		return <span aria-hidden className="w-4" />;
	}

	const quicker = trend < 0;

	return (
		<span
			className="text-muted-foreground w-4 text-center text-xs"
			title={`${quicker ? 'Quicker' : 'Slower'} by ${Math.abs(trend).toFixed(2)} s each lap`}
		>
			<span aria-hidden>{quicker ? '▼' : '▲'}</span>
			<span className="sr-only">
				{quicker ? 'getting quicker' : 'getting slower'} by {Math.abs(trend).toFixed(2)} seconds a
				lap
			</span>
		</span>
	);
}

/**
 * Who is fast right now: every running car's last clean laps, fuel taken out, as seconds a lap off
 * the fastest car. Pit laps and laps under a flag are left out, so a stop does not read as slow.
 * Picking a row puts the car in the duel.
 */
export function PaceNowTile() {
	const { snapshot, standings } = useRace();
	const { pick } = usePair();
	const shown = usePairShown();
	const list = React.useMemo(() => paceNow(snapshot, standings), [snapshot, standings]);
	const scale = Math.max(...list.map((entry) => entry.deltaSeconds), MIN_SCALE_SECONDS);
	const fastest = list[0]?.row.driver.code;
	const flag = pausingFlag(snapshot);

	return (
		<Panel aria-label="Pace now" data-testid="pace-now" className="h-full min-h-0">
			<PanelHeader title="Pace now" meta={flag ? 'paused' : `last ${PACE_NOW_LAPS} clean laps`} />
			<RaceOnly what="Pace now">
				{list.length === 0 ? (
					<EmptyNote>
						{snapshot.laps.length === 0
							? undefined
							: flag
								? `Pace is paused under the ${flag}; it fills in after a few green-flag laps.`
								: 'This fills in after a few green-flag laps.'}
					</EmptyNote>
				) : (
					<WholeRows rows="li" className="snap-y snap-mandatory">
						<ol className="py-1">
							{list.map((entry) => (
								<m.li
									key={entry.row.driver.number}
									layout="position"
									className="snap-start"
									transition={{ duration: 0.25, ease: 'easeOut' }}
								>
									<button
										type="button"
										onClick={() => pick(entry.row.driver.number)}
										data-testid={`pace-row-${entry.row.driver.code}`}
										data-state={shown.has(entry.row.driver.number) ? 'selected' : undefined}
										title={`Compare ${entry.row.driver.code} in the duel`}
										className="hover:bg-accent/70 data-[state=selected]:bg-accent grid w-full cursor-pointer grid-cols-[1.5rem_3.5rem_3rem_minmax(0,1fr)_3.5rem_1rem] items-center gap-2 px-4 py-1 text-left"
									>
										<span className="text-muted-foreground text-right font-mono text-xs">
											{entry.row.position}
										</span>
										<DriverTag driver={entry.row.driver} />
										{entry.row.compound ? (
											<TyreBadge compound={entry.row.compound} age={entry.row.tyreAge} />
										) : (
											<span />
										)}
										<span className="border-rule-strong flex h-4 items-center border-l">
											<m.span
												className={cn(
													'h-2.5',
													entry.deltaSeconds === 0 ? 'bg-fastest' : 'bg-foreground/45'
												)}
												initial={false}
												animate={{
													width: `max(2px, ${(entry.deltaSeconds / scale) * 100}%)`
												}}
												transition={{ duration: 0.4, ease: 'easeOut' }}
											/>
										</span>
										<span className="text-right text-sm">
											{entry.deltaSeconds === 0 ? (
												<span className="type-label text-fastest font-bold">Fastest</span>
											) : (
												<Digits value={`+${entry.deltaSeconds.toFixed(2)}`} tick />
											)}
										</span>
										<Trend entry={entry} />
									</button>
								</m.li>
							))}
						</ol>
					</WholeRows>
				)}
				<p className="text-muted-foreground border-t px-4 py-2 text-xs">
					Seconds a lap off {fastest ?? 'the fastest car'}, fuel taken out. Pit laps and laps under
					a flag are left out; ▼ is getting quicker.
				</p>
			</RaceOnly>
		</Panel>
	);
}
