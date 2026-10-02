import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';

import { DriverTag } from '@/components/driver-tag';
import { TyreBadge } from '@/components/tyre-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@/components/ui/table';
import { useRace } from '@/data/race-context';
import { type SectorMark, type StandingRow, standingsAt } from '@/insights/standings';
import { formatGap, formatLapTime, formatSectorTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const SECTOR_CLASS: Record<SectorMark, string> = {
	fastest: 'text-fastest',
	'personal-best': 'text-personal-best',
	none: ''
};

function PositionChange({ gained }: { gained: number | null }) {
	if (!gained) {
		return null;
	}

	return gained > 0 ? (
		<span className="text-personal-best inline-flex items-center text-xs">
			<ChevronUpIcon className="size-3" aria-hidden />
			{gained}
			<span className="sr-only">places gained</span>
		</span>
	) : (
		<span className="text-primary inline-flex items-center text-xs">
			<ChevronDownIcon className="size-3" aria-hidden />
			{-gained}
			<span className="sr-only">places lost</span>
		</span>
	);
}

function GapCell({ row, kind }: { row: StandingRow; kind: 'gap' | 'interval' }) {
	if (row.state === 'out') {
		return <Badge variant="outline">OUT</Badge>;
	}

	if (row.position === 1) {
		return <span className="text-muted-foreground">{kind === 'gap' ? 'Leader' : '—'}</span>;
	}

	if (row.lapsDown > 0) {
		return <span>+{row.lapsDown} lap</span>;
	}

	const value = kind === 'gap' ? row.gapToLeaderMs : row.intervalMs;

	return <span>{value === null ? '—' : formatGap(value)}</span>;
}

export function TimingTable() {
	const { snapshot, followedDriver, setFollowedDriver } = useRace();
	const rows = standingsAt(snapshot);

	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle>Classification</CardTitle>
				<CardDescription>
					Sector colours: purple is fastest overall, green is a personal best.
				</CardDescription>
			</CardHeader>
			<CardContent bleed>
				<Table inset>
					<TableHeader>
						<TableRow>
							<TableHead>Pos</TableHead>
							<TableHead>Driver</TableHead>
							<TableHead numeric>Gap</TableHead>
							<TableHead numeric className="hidden sm:table-cell">
								Int
							</TableHead>
							<TableHead numeric className="hidden md:table-cell">
								Last lap
							</TableHead>
							<TableHead numeric className="hidden xl:table-cell">
								Best
							</TableHead>
							<TableHead numeric className="hidden lg:table-cell">
								S1
							</TableHead>
							<TableHead numeric className="hidden lg:table-cell">
								S2
							</TableHead>
							<TableHead numeric className="hidden lg:table-cell">
								S3
							</TableHead>
							<TableHead>Tyre</TableHead>
							<TableHead numeric className="hidden md:table-cell">
								Pits
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => {
							const followed = row.driver.number === followedDriver;

							return (
								<TableRow
									key={row.driver.number}
									data-state={followed ? 'selected' : undefined}
									data-testid={`timing-row-${row.driver.code}`}
									interactive
									muted={row.state === 'out'}
									onClick={() => setFollowedDriver(row.driver.number)}
								>
									<TableCell>
										<span className="flex items-center gap-1.5">
											<span className="w-5 text-right font-semibold">{row.position}</span>
											<PositionChange gained={row.state === 'out' ? null : row.positionsGained} />
										</span>
									</TableCell>
									<TableCell>
										<span className="flex items-center gap-2">
											<DriverTag driver={row.driver} />
											{row.state === 'pit' ? <Badge variant="warning">PIT</Badge> : null}
										</span>
									</TableCell>
									<TableCell numeric>
										<GapCell row={row} kind="gap" />
									</TableCell>
									<TableCell numeric className="hidden sm:table-cell">
										{row.state === 'out' ? null : <GapCell row={row} kind="interval" />}
									</TableCell>
									<TableCell numeric className="hidden md:table-cell">
										{row.lastLap ? formatLapTime(row.lastLap.lapTimeMs) : '—'}
									</TableCell>
									<TableCell numeric className="hidden xl:table-cell">
										<span className={cn(row.hasFastestLap && 'text-fastest')}>
											{row.bestLapMs === null ? '—' : formatLapTime(row.bestLapMs)}
										</span>
									</TableCell>
									{([0, 1, 2] as const).map((sector) => (
										<TableCell key={sector} numeric className="hidden lg:table-cell">
											<span className={SECTOR_CLASS[row.sectorMarks[sector]]}>
												{row.lastLap ? formatSectorTime(row.lastLap.sectorTimesMs[sector]) : '—'}
											</span>
										</TableCell>
									))}
									<TableCell>
										{row.compound ? <TyreBadge compound={row.compound} age={row.tyreAge} /> : null}
									</TableCell>
									<TableCell numeric className="hidden md:table-cell">
										{row.pitStops}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
