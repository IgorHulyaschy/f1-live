import type { Lap } from '@f1-live/shared';

import { isCleanLap } from '@/insights/clean-laps';
import { formatLapTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Laps shown per driver. */
export const TREND_LAPS = 5;

/** A lap this much slower than the driver's best draws at the minimum height. */
const RANGE_MS = 1500;

/** The last few laps per driver, oldest first. */
export function recentLaps(laps: readonly Lap[]): Map<string, Lap[]> {
	const recent = new Map<string, Lap[]>();

	for (const lap of laps.toSorted((a, b) => a.lap - b.lap)) {
		const list = recent.get(lap.driverNumber) ?? [];

		list.push(lap);

		if (list.length > TREND_LAPS) {
			list.shift();
		}

		recent.set(lap.driverNumber, list);
	}

	return recent;
}

/**
 * The driver's last five laps as bars: taller is quicker, measured against their own best lap.
 * Green marks the personal best, yellow a lap that was not clean (pit or neutralised).
 */
export function LapTrend({ laps, bestLapMs }: { laps: readonly Lap[]; bestLapMs: number | null }) {
	return (
		<span
			className="flex h-5 w-20 items-end gap-0.5"
			title={laps.map((lap) => `L${lap.lap} ${formatLapTime(lap.lapTimeMs)}`).join(', ')}
		>
			{laps.map((lap) => {
				const clean = isCleanLap(lap);
				const best = clean && lap.lapTimeMs === bestLapMs;
				const slower = bestLapMs === null ? RANGE_MS : lap.lapTimeMs - bestLapMs;
				const height = clean ? 100 - Math.min(Math.max(slower, 0) / RANGE_MS, 1) * 80 : 20;

				return (
					<span
						key={lap.lap}
						className={cn(
							'h-(--size) flex-1',
							best ? 'bg-personal-best' : clean ? 'bg-foreground/55' : 'bg-flag/70'
						)}
						style={{ '--size': `${height}%` }}
					/>
				);
			})}
		</span>
	);
}
