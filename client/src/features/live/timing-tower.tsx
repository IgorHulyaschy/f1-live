import type { Lap } from '@f1-live/shared';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { motion } from 'motion/react';
import * as React from 'react';

import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { TyreBadge } from '@/components/tyre-badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useRace } from '@/data/race-context';
import { type StandingRow, standingsAt } from '@/insights/standings';
import { formatGap, formatLapTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import { MiniSectors } from './mini-sectors';

type GapMode = 'interval' | 'leader';

/** An interval bar is full at this gap; DRS opens inside one second. */
const INTERVAL_SCALE_MS = 3000;

const DRS_WINDOW_MS = 1000;

const FLASH = {
	gain: ['rgba(34, 197, 94, 0.22)', 'rgba(34, 197, 94, 0)'],
	loss: ['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0)']
} as const;

function previousPositions(laps: readonly Lap[], lap: number): Map<string, number> {
	return new Map(
		laps.flatMap((entry) =>
			entry.lap === lap - 1 ? [[entry.driverNumber, entry.position] as const] : []
		)
	);
}

function Movement({ gained }: { gained: number | null }) {
	if (!gained) {
		return <span className="w-6" />;
	}

	const Icon = gained > 0 ? ChevronUpIcon : ChevronDownIcon;

	return (
		<span
			className={cn(
				'flex w-6 items-center font-mono text-xs',
				gained > 0 ? 'text-personal-best' : 'text-primary'
			)}
		>
			<Icon className="size-3" aria-hidden />
			{Math.abs(gained)}
			<span className="sr-only">{gained > 0 ? 'places gained' : 'places lost'}</span>
		</span>
	);
}

function GapReading({ row, mode }: { row: StandingRow; mode: GapMode }) {
	if (row.state === 'out') {
		return (
			<span className="text-muted-foreground font-display font-semibold tracking-wider">OUT</span>
		);
	}

	if (row.position === 1) {
		return (
			<span className="text-muted-foreground font-display font-semibold tracking-wider uppercase">
				Leader
			</span>
		);
	}

	if (row.lapsDown > 0) {
		return <span>+{row.lapsDown} lap</span>;
	}

	const value = mode === 'leader' ? row.gapToLeaderMs : row.intervalMs;

	if (value === null) {
		return <span>—</span>;
	}

	const inDrs = mode === 'interval' && value < DRS_WINDOW_MS;

	return (
		<span className="flex flex-col items-end gap-1">
			<span className={cn(inDrs && 'text-drs')}>{formatGap(value)}</span>
			{mode === 'interval' ? (
				<span aria-hidden className="bg-muted relative h-0.5 w-16 overflow-hidden rounded-full">
					<span
						className={cn(
							'absolute inset-y-0 right-0 w-(--size) rounded-full transition-all duration-500',
							inDrs ? 'bg-drs' : 'bg-muted-foreground/60'
						)}
						style={{ '--size': `${Math.min(value / INTERVAL_SCALE_MS, 1) * 100}%` }}
					/>
				</span>
			) : null}
		</span>
	);
}

function LastLap({ row }: { row: StandingRow }) {
	if (!row.lastLap) {
		return <span className="text-muted-foreground">—</span>;
	}

	const isBest = row.lastLap.lap > 1 && row.lastLap.lapTimeMs === row.bestLapMs;

	return (
		<span
			className={cn(
				isBest && row.hasFastestLap && 'text-fastest',
				isBest && !row.hasFastestLap && 'text-personal-best'
			)}
		>
			{formatLapTime(row.lastLap.lapTimeMs)}
		</span>
	);
}

export function TimingTower() {
	const { snapshot, lap, followedDriver, setFollowedDriver } = useRace();
	const [mode, setMode] = React.useState<GapMode>('interval');
	const rows = standingsAt(snapshot);
	const before = previousPositions(snapshot.laps, lap);

	return (
		<Panel aria-label="Classification">
			<PanelHeader
				title="Classification"
				meta={`${rows.filter((row) => row.state !== 'out').length} running`}
			>
				<ToggleGroup
					type="single"
					size="sm"
					variant="outline"
					value={mode}
					onValueChange={(value) => {
						if (value === 'interval' || value === 'leader') {
							setMode(value);
						}
					}}
					aria-label="Gap shown"
				>
					<ToggleGroupItem value="interval">
						<span className="text-xs">Interval</span>
					</ToggleGroupItem>
					<ToggleGroupItem value="leader">
						<span className="text-xs">Leader</span>
					</ToggleGroupItem>
				</ToggleGroup>
			</PanelHeader>
			<table className="w-full text-sm">
				<thead className="text-muted-foreground font-display text-xs tracking-wider uppercase">
					<tr className="h-8 border-b">
						<th scope="col" className="pl-4 text-left font-medium">
							Pos
						</th>
						<th scope="col" className="text-left font-medium">
							Driver
						</th>
						<th scope="col" className="pr-4 text-right font-medium">
							{mode === 'interval' ? 'Interval' : 'Gap'}
						</th>
						<th scope="col" className="hidden pr-4 text-right font-medium md:table-cell">
							Last lap
						</th>
						<th
							scope="col"
							className="hidden w-32 pr-4 text-right font-medium md:table-cell xl:w-56"
						>
							Sectors
						</th>
						<th scope="col" className="pr-4 text-left font-medium">
							Tyre
						</th>
						<th scope="col" className="hidden pr-4 text-right font-medium sm:table-cell">
							Stops
						</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => {
						const followed = row.driver.number === followedDriver;
						const previous = before.get(row.driver.number);

						const moved =
							previous === undefined || row.state === 'out' ? 0 : previous - row.position;

						return (
							<motion.tr
								key={row.driver.number}
								layout="position"
								transition={{ type: 'spring', stiffness: 400, damping: 38 }}
								initial={false}
								animate={{
									backgroundColor:
										moved > 0 ? [...FLASH.gain] : moved < 0 ? [...FLASH.loss] : FLASH.gain[1]
								}}
								data-state={followed ? 'selected' : undefined}
								data-testid={`timing-row-${row.driver.code}`}
								onClick={() => setFollowedDriver(row.driver.number)}
								className={cn(
									'hover:bg-accent/60 data-[state=selected]:bg-accent h-11 cursor-pointer border-b font-mono last:border-b-0',
									row.state === 'out' && 'opacity-45'
								)}
							>
								<td className="pl-4">
									<span className="flex items-center gap-1">
										<span className="font-display w-6 text-right text-base font-bold">
											{row.position}
										</span>
										<Movement gained={row.state === 'out' ? null : row.positionsGained} />
									</span>
								</td>
								<td>
									<span className="flex items-center gap-2">
										<DriverTag driver={row.driver} showName />
										{row.state === 'pit' ? (
											<span className="bg-warning text-background font-display rounded-sm px-1.5 text-xs font-bold tracking-wider">
												PIT
											</span>
										) : null}
									</span>
								</td>
								<td className="pr-4 text-right">
									<GapReading row={row} mode={mode} />
								</td>
								<td className="hidden pr-4 text-right md:table-cell">
									<LastLap row={row} />
								</td>
								<td className="hidden pr-4 md:table-cell">
									<MiniSectors lap={row.lastLap} marks={row.sectorMarks} />
								</td>
								<td className="pr-4">
									{row.compound ? <TyreBadge compound={row.compound} age={row.tyreAge} /> : null}
								</td>
								<td className="hidden pr-4 text-right sm:table-cell">{row.pitStops}</td>
							</motion.tr>
						);
					})}
				</tbody>
			</table>
		</Panel>
	);
}
