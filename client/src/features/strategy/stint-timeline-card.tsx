import type { TyreCompound } from '@f1-live/shared';

import { DriverTag } from '@/components/driver-tag';
import { compoundName } from '@/components/tyre-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRace } from '@/data/race-context';
import { standingsAt } from '@/insights/standings';
import { cn } from '@/lib/utils';

const COMPOUND_FILL: Record<TyreCompound, string> = {
	SOFT: 'fill-tyre-soft',
	MEDIUM: 'fill-tyre-medium',
	HARD: 'fill-tyre-hard',
	INTERMEDIATE: 'fill-tyre-intermediate',
	WET: 'fill-tyre-wet',
	UNKNOWN: 'fill-muted-foreground'
};

const LEGEND: readonly TyreCompound[] = ['SOFT', 'MEDIUM', 'HARD'];

export function StintTimelineCard() {
	const { snapshot } = useRace();
	const rows = standingsAt(snapshot);
	const totalLaps = snapshot.session.totalLaps;

	return (
		<Card size="sm" data-testid="stint-timeline">
			<CardHeader>
				<CardTitle>Tyre strategies</CardTitle>
				<CardDescription>Stints by lap, in running order.</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-2">
					{rows.map((row) => {
						const stints = snapshot.stints.filter(
							(stint) => stint.driverNumber === row.driver.number
						);

						return (
							<div
								key={row.driver.number}
								className="grid grid-cols-[3.5rem_1fr] items-center gap-3"
							>
								<DriverTag
									driver={row.driver}
									className={cn(row.state === 'out' && 'opacity-50')}
								/>
								<svg
									viewBox={`0 0 ${totalLaps} 10`}
									preserveAspectRatio="none"
									className="bg-muted h-5 w-full rounded-sm"
									aria-hidden
								>
									{stints.map((stint) => (
										<rect
											key={stint.stint}
											x={stint.startLap - 1 + 0.08}
											y={0}
											width={stint.endLap - stint.startLap + 1 - 0.16}
											height={10}
											rx={0.4}
											className={COMPOUND_FILL[stint.compound]}
										/>
									))}
								</svg>
								<span className="sr-only">
									{stints
										.map(
											(stint) =>
												`${compoundName(stint.compound)} laps ${stint.startLap} to ${stint.endLap}`
										)
										.join(', ')}
								</span>
							</div>
						);
					})}
					<div className="text-muted-foreground flex flex-wrap items-center gap-4 pt-2 text-xs">
						{LEGEND.map((compound) => (
							<span key={compound} className="flex items-center gap-1.5">
								<svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
									<rect width={10} height={10} rx={2} className={COMPOUND_FILL[compound]} />
								</svg>
								{compoundName(compound)}
							</span>
						))}
						<span className="ml-auto font-mono">Lap 1–{totalLaps}</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
