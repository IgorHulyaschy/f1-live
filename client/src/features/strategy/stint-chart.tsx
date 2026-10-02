import type { Stint } from '@f1-live/shared';

import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { COMPOUND_FILL_CLASS, compoundName } from '@/components/tyre-badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRace } from '@/data/race-context';
import { standingsAt } from '@/insights/standings';
import { cn } from '@/lib/utils';

const LEGEND = ['SOFT', 'MEDIUM', 'HARD'] as const;

/** Wide enough to print the compound letter and lap count inside the bar. */
const LABEL_MIN_LAPS = 5;

const LETTER = { SOFT: 'S', MEDIUM: 'M', HARD: 'H', INTERMEDIATE: 'I', WET: 'W', UNKNOWN: '?' };

function percent(laps: number, total: number): string {
	return `${(laps / total) * 100}%`;
}

function StintBar({
	stint,
	totalLaps,
	ongoing
}: {
	stint: Stint;
	totalLaps: number;
	ongoing: boolean;
}) {
	const laps = stint.endLap - stint.startLap + 1;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span
					className={cn(
						'absolute inset-y-0 left-(--offset) w-(--size) border-x border-(--color-panel) transition-all duration-500',
						COMPOUND_FILL_CLASS[stint.compound],
						ongoing && 'rounded-r-none'
					)}
					style={{
						'--offset': percent(stint.startLap - 1, totalLaps),
						'--size': percent(laps, totalLaps)
					}}
				>
					{laps >= LABEL_MIN_LAPS ? (
						<span className="text-background font-display absolute inset-y-0 left-1.5 flex items-center text-xs font-bold">
							{LETTER[stint.compound]} {laps}
						</span>
					) : null}
				</span>
			</TooltipTrigger>
			<TooltipContent>
				{compoundName(stint.compound)} · laps {stint.startLap}–{stint.endLap} · {laps} laps
				{ongoing ? ' so far' : ''}
			</TooltipContent>
		</Tooltip>
	);
}

export function StintChart() {
	const { snapshot } = useRace();
	const rows = standingsAt(snapshot);
	const totalLaps = snapshot.session.totalLaps;
	const now = snapshot.currentLap;

	const rulerMarks = Array.from(
		{ length: Math.floor(totalLaps / 10) },
		(_, index) => (index + 1) * 10
	);

	return (
		<Panel aria-label="Tyre strategies" data-testid="stint-timeline">
			<PanelHeader title="Tyre strategies" meta={`lap ${now} of ${totalLaps}`}>
				<span className="text-muted-foreground hidden items-center gap-3 text-xs sm:flex">
					{LEGEND.map((compound) => (
						<span key={compound} className="flex items-center gap-1.5">
							<span
								aria-hidden
								className={cn('size-2 rounded-full', COMPOUND_FILL_CLASS[compound])}
							/>
							{compoundName(compound)}
						</span>
					))}
				</span>
			</PanelHeader>
			<div className="flex flex-col gap-1.5 p-4">
				<div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3">
					<span />
					<div aria-hidden className="text-muted-foreground relative h-4 font-mono text-xs">
						{rulerMarks.map((mark) => (
							<span
								key={mark}
								className="absolute left-(--offset) -translate-x-full"
								style={{ '--offset': percent(mark, totalLaps) }}
							>
								{mark}
							</span>
						))}
					</div>
				</div>
				<div className="relative flex flex-col gap-1.5">
					{rows.map((row) => {
						const stints = snapshot.stints.filter(
							(stint) => stint.driverNumber === row.driver.number
						);

						const last = stints.at(-1);

						return (
							<div
								key={row.driver.number}
								className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3"
							>
								<DriverTag
									driver={row.driver}
									className={cn(row.state === 'out' && 'opacity-40')}
								/>
								<div className="bg-muted/50 relative h-6 overflow-hidden rounded-sm">
									{rulerMarks.map((mark) => (
										<span
											key={mark}
											aria-hidden
											className="bg-border absolute inset-y-0 left-(--offset) w-px"
											style={{ '--offset': percent(mark, totalLaps) }}
										/>
									))}
									{stints.map((stint) => (
										<StintBar
											key={stint.stint}
											stint={stint}
											totalLaps={totalLaps}
											ongoing={stint === last && row.state !== 'out' && stint.endLap >= now}
										/>
									))}
									{row.state === 'out' && last ? (
										<span
											className="text-muted-foreground font-display absolute inset-y-0 left-(--offset) flex items-center pl-2 text-xs font-semibold tracking-wider uppercase"
											style={{ '--offset': percent(last.endLap, totalLaps) }}
										>
											Retired
										</span>
									) : null}
								</div>
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
					<div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 left-17">
						<span
							className="bg-foreground absolute -inset-y-1 left-(--offset) w-0.5 rounded-full"
							style={{ '--offset': percent(now, totalLaps) }}
						/>
					</div>
				</div>
			</div>
		</Panel>
	);
}
