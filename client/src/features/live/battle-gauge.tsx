import type { Driver } from '@f1-live/shared';

import { Eyebrow } from '@/components/console/panel';
import { TeamStripe } from '@/components/driver-tag';
import { cn } from '@/lib/utils';

/** The gauge is full at this gap; the shaded start is the one-second DRS window. */
const GAUGE_SECONDS = 5;

const DRS_SECONDS = 1;

function trendCopy(closing: number | null, lapsToCatch: number | null): string {
	if (closing === null || Math.abs(closing) < 0.05) {
		return 'Holding the gap';
	}

	const rate = `${Math.abs(closing).toFixed(2)}s a lap`;

	if (closing < 0) {
		return `Gap growing ${rate}`;
	}

	return lapsToCatch === null
		? `Closing ${rate}`
		: `Closing ${rate} · catch in ~${lapsToCatch} laps`;
}

export function BattleGauge({
	label,
	driver,
	gapSeconds,
	closingSecondsPerLap,
	lapsToCatch = null
}: {
	label: string;
	driver: Driver;
	gapSeconds: number;
	/** Positive when the gap is shrinking. */
	closingSecondsPerLap: number | null;
	lapsToCatch?: number | null;
}) {
	const inDrs = gapSeconds < DRS_SECONDS;

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-3">
				<span className="flex items-center gap-2">
					<Eyebrow className="w-12">{label}</Eyebrow>
					<TeamStripe driver={driver} />
					<span className="font-display font-semibold tracking-wide">{driver.code}</span>
				</span>
				<span className={cn('font-mono text-lg font-semibold', inDrs && 'text-drs')}>
					{gapSeconds.toFixed(1)}s
				</span>
			</div>
			<div aria-hidden className="bg-muted relative h-1.5 overflow-hidden rounded-full">
				<span
					className="bg-drs/20 absolute inset-y-0 left-0 w-(--size)"
					style={{ '--size': `${(DRS_SECONDS / GAUGE_SECONDS) * 100}%` }}
				/>
				<span
					className={cn(
						'absolute inset-y-0 left-0 w-(--size) rounded-full transition-all duration-700',
						inDrs ? 'bg-drs' : 'bg-foreground/70'
					)}
					style={{ '--size': `${Math.min(gapSeconds / GAUGE_SECONDS, 1) * 100}%` }}
				/>
			</div>
			<span className="text-muted-foreground text-xs">
				{inDrs ? 'In DRS range · ' : null}
				{trendCopy(closingSecondsPerLap, lapsToCatch)}
			</span>
		</div>
	);
}
