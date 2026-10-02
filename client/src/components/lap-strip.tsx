import type { TrackStatus } from '@f1-live/shared';
import * as React from 'react';

import { useRace } from '@/data/race-context';
import { isCleanLap } from '@/insights/clean-laps';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<TrackStatus, string> = {
	green: '',
	yellow: ', yellow flag',
	vsc: ', VSC',
	safety_car: ', Safety Car',
	red: ', red flag'
};

/**
 * The race barcode: one bar per lap. Height carries pit-stop traffic, colour carries the flag,
 * a purple cap marks a new fastest lap. Click a bar to jump the replay there.
 */
export function LapStrip() {
	const { race, lap, setLap } = useRace();
	const totalLaps = race.session.totalLaps;

	const laps = React.useMemo(() => {
		const status = new Map<number, TrackStatus>();
		const stops = new Map<number, number>();
		const fastestLaps = new Set<number>();
		let best = Infinity;

		for (const entry of race.laps) {
			if (entry.trackStatus !== 'green') {
				status.set(entry.lap, entry.trackStatus);
			}
		}

		for (const entry of race.laps.toSorted((a, b) => a.lap - b.lap)) {
			if (entry.lap > 1 && isCleanLap(entry) && entry.lapTimeMs < best) {
				best = entry.lapTimeMs;
				fastestLaps.add(entry.lap);
			}
		}

		for (const stop of race.pitStops) {
			stops.set(stop.lap, (stops.get(stop.lap) ?? 0) + 1);
		}

		return Array.from({ length: totalLaps }, (_, index) => ({
			lap: index + 1,
			status: status.get(index + 1) ?? ('green' as const),
			stops: stops.get(index + 1) ?? 0,
			fastest: fastestLaps.has(index + 1)
		}));
	}, [race, totalLaps]);

	return (
		<fieldset className="flex min-w-0 flex-col gap-1">
			<legend className="sr-only">Race laps</legend>
			<div className="flex h-8 items-end gap-px">
				{laps.map((entry) => {
					const raced = entry.lap <= race.currentLap;
					const selected = entry.lap === lap;
					const passed = entry.lap < lap;

					return (
						<button
							key={entry.lap}
							type="button"
							tabIndex={-1}
							disabled={!raced}
							onClick={() => setLap(entry.lap)}
							aria-label={`Go to lap ${entry.lap}`}
							title={`Lap ${entry.lap}${STATUS_LABEL[entry.status]}${entry.stops ? `, ${entry.stops} pit ${entry.stops === 1 ? 'stop' : 'stops'}` : ''}`}
							className="group relative flex h-full flex-1 cursor-pointer flex-col justify-end disabled:cursor-default"
						>
							{entry.fastest && entry.lap <= lap ? (
								<span aria-hidden className="bg-fastest absolute inset-x-0 top-0 h-0.5" />
							) : null}
							<span
								aria-hidden
								className={cn(
									'block w-full transition-all duration-200',
									!raced && 'bg-border h-px',
									raced &&
										(selected
											? 'h-full'
											: entry.stops > 2
												? 'h-5'
												: entry.stops > 0
													? 'h-3.5'
													: 'h-2'),
									raced && entry.status !== 'green' && 'bg-flag',
									raced && entry.status === 'green' && selected && 'bg-focus',
									raced &&
										entry.status === 'green' &&
										passed &&
										'bg-foreground/55 group-hover:bg-foreground',
									raced &&
										entry.status === 'green' &&
										!passed &&
										!selected &&
										'bg-foreground/15 group-hover:bg-foreground/40'
								)}
							/>
						</button>
					);
				})}
			</div>
			<div aria-hidden className="relative h-4 font-mono text-xs">
				{[
					1,
					...Array.from({ length: Math.floor(totalLaps / 10) }, (_, index) => (index + 1) * 10)
				].map((mark) => (
					<span
						key={mark}
						className={cn(
							'text-muted-foreground absolute left-(--offset) -translate-x-1/2',
							mark === 1 && 'translate-x-0',
							mark === totalLaps && '-translate-x-full',
							mark % 20 !== 0 && mark !== 1 && mark !== totalLaps && 'hidden sm:inline'
						)}
						style={{ '--offset': `${((mark - 0.5) / totalLaps) * 100}%` }}
					>
						L{mark}
					</span>
				))}
			</div>
		</fieldset>
	);
}
