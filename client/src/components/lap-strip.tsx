import { TRACK_STATUSES, type RaceSnapshot, type TrackStatus } from '@f1-live/shared';
import * as React from 'react';

import { useRace } from '@/data/race-context';
import { minuteTime, sessionClock } from '@/data/snapshot-at-time';
import { isCleanLap } from '@/insights/clean-laps';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<TrackStatus, string> = {
	green: '',
	yellow: ', yellow flag',
	vsc: ', VSC',
	safety_car: ', Safety Car',
	red: ', red flag'
};

/** One bar: a lap of a race, or a minute of practice or qualifying. */
type Slot = {
	step: number;
	status: TrackStatus;
	/** 0 to 3: how busy it was, in pit stops (a race) or laps completed (on the clock). */
	traffic: number;
	fastest: boolean;
	note: string;
};

function lapSlots(race: RaceSnapshot): Slot[] {
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

	return Array.from({ length: race.session.totalLaps }, (_, index) => {
		const count = stops.get(index + 1) ?? 0;

		return {
			step: index + 1,
			status: status.get(index + 1) ?? 'green',
			traffic: count > 2 ? 3 : count > 0 ? 2 : 1,
			fastest: fastestLaps.has(index + 1),
			note: count ? `, ${count} pit ${count === 1 ? 'stop' : 'stops'}` : ''
		};
	});
}

function severity(status: TrackStatus): number {
	return TRACK_STATUSES.indexOf(status);
}

/** Minutes of a session on the clock: the worst flag in each, and how many laps were done. */
function minuteSlots(race: RaceSnapshot, minutes: number): Slot[] {
	const clock = sessionClock(race);
	const log = race.trackStatusLog ?? [];
	const lapsIn = Array.from({ length: minutes }, () => 0);
	const fastest = new Set<number>();
	let best = Infinity;

	const timedLaps = race.laps
		.filter((lap) => lap.completedAt !== undefined && lap.lapTimeMs > 0)
		.toSorted((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''));

	for (const lap of timedLaps) {
		const minute = Math.ceil((Date.parse(lap.completedAt ?? '') - clock.startMs) / 60_000);

		if (minute >= 1 && minute <= minutes) {
			lapsIn[minute - 1] = (lapsIn[minute - 1] ?? 0) + 1;

			if (lap.lapTimeMs < best) {
				best = lap.lapTimeMs;
				fastest.add(minute);
			}
		}
	}

	return Array.from({ length: minutes }, (_, index) => {
		const from = minuteTime(clock, index);
		const to = minuteTime(clock, index + 1);
		let status: TrackStatus = 'green';

		for (const change of log) {
			const at = Date.parse(change.at);

			if (at <= from) {
				status = change.status;
			} else if (at < to && severity(change.status) > severity(status)) {
				status = change.status;
			}
		}

		const laps = lapsIn[index] ?? 0;

		return {
			step: index + 1,
			status,
			traffic: laps > 8 ? 3 : laps > 3 ? 2 : laps > 0 ? 1 : 0,
			fastest: fastest.has(index + 1),
			note: laps ? `, ${laps} ${laps === 1 ? 'lap' : 'laps'} done` : ''
		};
	});
}

const HEIGHT = ['h-px', 'h-2', 'h-3.5', 'h-5'] as const;

/**
 * The race barcode: one bar per lap. Height carries pit-stop traffic, colour carries the flag,
 * a purple cap marks a new fastest lap. Practice and qualifying get one bar per minute, its
 * height the laps completed in it. Click a bar to jump the replay there.
 */
export function LapStrip() {
	const { race, lap, setLap, stepUnit, steps } = useRace();
	const timed = stepUnit === 'minute';
	const total = timed ? steps : race.session.totalLaps;
	const done = timed ? steps : race.currentLap;
	const unit = timed ? 'minute' : 'lap';

	const slots = React.useMemo(
		() => (timed ? minuteSlots(race, steps) : lapSlots(race)),
		[race, timed, steps]
	);

	if (total === 0) {
		return null;
	}

	return (
		<fieldset className="flex min-w-0 flex-col gap-1">
			<legend className="sr-only">{timed ? 'Session minutes' : 'Race laps'}</legend>
			<div className="flex h-8 items-end gap-px">
				{slots.map((entry) => {
					const raced = entry.step <= done;
					const selected = entry.step === lap;
					const passed = entry.step < lap;

					return (
						<button
							key={entry.step}
							type="button"
							tabIndex={-1}
							disabled={!raced}
							onClick={() => setLap(entry.step)}
							aria-label={`Go to ${unit} ${entry.step}`}
							title={`${timed ? 'Minute' : 'Lap'} ${entry.step}${STATUS_LABEL[entry.status]}${entry.note}`}
							className="group relative flex h-full flex-1 cursor-pointer flex-col justify-end disabled:cursor-default"
						>
							{entry.fastest && entry.step <= lap ? (
								<span aria-hidden className="bg-fastest block h-0.5 w-full" />
							) : null}
							<span
								aria-hidden
								className={cn(
									'block w-full transition-all duration-200',
									!raced && 'bg-foreground/25 h-px',
									raced && (selected ? 'h-full' : HEIGHT[entry.traffic]),
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
				{[1, ...Array.from({ length: Math.floor(total / 10) }, (_, index) => (index + 1) * 10)].map(
					(mark) => (
						<span
							key={mark}
							className={cn(
								'text-muted-foreground absolute left-(--offset) -translate-x-1/2',
								mark === 1 && 'translate-x-0',
								mark === total && '-translate-x-full',
								mark % 20 !== 0 && mark !== 1 && mark !== total && 'hidden sm:inline'
							)}
							style={{ '--offset': `${((mark - 0.5) / total) * 100}%` }}
						>
							{timed ? `${mark}m` : `L${mark}`}
						</span>
					)
				)}
			</div>
		</fieldset>
	);
}
