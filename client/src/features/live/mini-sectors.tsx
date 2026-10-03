import type { Lap } from '@f1-live/shared';

import type { SectorMark } from '@/insights/standings';
import { formatSectorTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const BAR_CLASS: Record<SectorMark, string> = {
	fastest: 'bg-fastest',
	'personal-best': 'bg-personal-best',
	none: 'bg-foreground/15'
};

const TEXT_CLASS: Record<SectorMark, string> = {
	fastest: 'text-fastest',
	'personal-best': 'text-personal-best',
	none: 'text-muted-foreground'
};

const SECTORS = [0, 1, 2] as const;

/**
 * Sectors coloured only when they improved; everything else stays quiet. A race's first lap has
 * no sector times; outside races any lap with them shows.
 */
export function MiniSectors({
	lap,
	marks,
	timed = false
}: {
	lap: Lap | null;
	marks: readonly [SectorMark, SectorMark, SectorMark];
	timed?: boolean;
}) {
	if (!lap || (timed ? lap.sectorTimesMs.every((time) => time === 0) : lap.lap === 1)) {
		return <span className="text-muted-foreground">-</span>;
	}

	return (
		<span className="grid grid-cols-3 gap-0.5">
			{SECTORS.map((sector) => (
				<span key={sector} className="flex min-w-0 flex-col gap-1">
					<span
						className={cn(
							'hidden text-right font-mono text-xs @4xl:block',
							TEXT_CLASS[marks[sector]]
						)}
					>
						{lap.sectorTimesMs[sector] > 0 ? formatSectorTime(lap.sectorTimesMs[sector]) : '-'}
					</span>
					<span aria-hidden className={cn('h-0.75 w-full min-w-4', BAR_CLASS[marks[sector]])} />
				</span>
			))}
		</span>
	);
}
