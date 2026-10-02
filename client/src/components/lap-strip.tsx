import type { TrackStatus } from '@f1-live/shared';
import * as React from 'react';

import { useRace } from '@/data/race-context';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<TrackStatus, string> = {
	green: '',
	yellow: ' · yellow flag',
	vsc: ' · VSC',
	safety_car: ' · Safety Car',
	red: ' · red flag'
};

/**
 * The whole race as one strip of laps: neutralised laps in yellow, pit stops as dots, the
 * selected lap raised. Clicking a lap jumps the replay there.
 */
export function LapStrip() {
	const { race, lap, setLap } = useRace();
	const totalLaps = race.session.totalLaps;

	const { statusByLap, stopsByLap } = React.useMemo(() => {
		const status = new Map<number, TrackStatus>();
		const stops = new Map<number, number>();

		for (const entry of race.laps) {
			if (entry.trackStatus !== 'green') {
				status.set(entry.lap, entry.trackStatus);
			}
		}

		for (const stop of race.pitStops) {
			stops.set(stop.lap, (stops.get(stop.lap) ?? 0) + 1);
		}

		return { statusByLap: status, stopsByLap: stops };
	}, [race]);

	return (
		<fieldset className="flex min-w-0 flex-col gap-1">
			<legend className="sr-only">Race laps</legend>
			<div className="flex h-5 items-end gap-px sm:gap-0.5">
				{Array.from({ length: totalLaps }, (_, index) => {
					const lapNumber = index + 1;
					const status = statusByLap.get(lapNumber) ?? 'green';
					const stops = stopsByLap.get(lapNumber) ?? 0;
					const raced = lapNumber <= race.currentLap;
					const selected = lapNumber === lap;
					const passed = lapNumber < lap;

					return (
						<button
							key={lapNumber}
							type="button"
							tabIndex={-1}
							disabled={!raced}
							onClick={() => setLap(lapNumber)}
							aria-label={`Go to lap ${lapNumber}`}
							title={`Lap ${lapNumber}${STATUS_LABEL[status]}${stops ? ` · ${stops} pit ${stops === 1 ? 'stop' : 'stops'}` : ''}`}
							className="group flex h-full flex-1 cursor-pointer flex-col justify-end gap-0.5 disabled:cursor-default"
						>
							<span
								aria-hidden
								className={cn(
									'mx-auto size-1 rounded-full',
									stops > 0 && raced ? 'bg-muted-foreground' : 'bg-transparent'
								)}
							/>
							<span
								aria-hidden
								className={cn(
									'block w-full rounded-xs transition-all duration-300',
									selected ? 'h-2.5' : 'h-1.5 group-hover:h-2',
									!raced && 'bg-muted',
									raced && status !== 'green' && 'bg-safety-car',
									raced && status === 'green' && selected && 'bg-primary',
									raced && status === 'green' && passed && 'bg-foreground/60',
									raced && status === 'green' && !passed && !selected && 'bg-foreground/15'
								)}
							/>
						</button>
					);
				})}
			</div>
			<div aria-hidden className="text-muted-foreground relative h-4 font-mono text-xs">
				{[
					1,
					...Array.from({ length: Math.floor(totalLaps / 10) }, (_, index) => (index + 1) * 10)
				].map((mark) => (
					<span
						key={mark}
						className={cn(
							'absolute left-(--offset) -translate-x-1/2',
							mark === 1 && 'translate-x-0',
							mark === totalLaps && '-translate-x-full',
							mark % 20 !== 0 && mark !== 1 && mark !== totalLaps && 'hidden sm:inline'
						)}
						style={{ '--offset': `${((mark - 0.5) / totalLaps) * 100}%` }}
					>
						{mark === 1 ? 'L1' : mark}
					</span>
				))}
			</div>
		</fieldset>
	);
}
