import { ChevronsLeftIcon, ChevronsRightIcon } from 'lucide-react';
import * as React from 'react';

import { Key, KeyGroup } from '@/components/console/keys';
import { LapStrip } from '@/components/lap-strip';
import { DelayControl, LapCounter, Transport } from '@/components/race-clock';
import { useRaceView } from '@/data/race-context';
import { nextSpeed } from '@/data/replay-clock';
import { eventFilterStore } from '@/data/viewer-settings';
import { sessionMinutes } from '@/insights/qualifying';
import {
	adjacentEventStep,
	EVENT_FILTER_LABEL,
	EVENT_FILTERS,
	type EventFilter,
	matchesFilter,
	type TimelineEvent,
	timelineEvents
} from '@/insights/timeline';
import { cn } from '@/lib/utils';

import { useTileRows } from '../dashboard/tile-fill';
import { TONE_CLASS } from '../story/story-ribbon';

/** A replay tile this many grid rows tall or shorter leaves out the line that says what happened. */
const COMPACT_ROWS = 3;

const FILTER_OPTIONS = EVENT_FILTERS.map((value) => ({ value, label: EVENT_FILTER_LABEL[value] }));

/** The lane a step's marker takes the colour of when several things happened in it. */
const LANE_ORDER: readonly TimelineEvent['lane'][] = [
	'start',
	'flags',
	'out',
	'penalties',
	'stops',
	'lead',
	'passes'
];

/**
 * The session the events come from: spoiler-free, only what has been shown; otherwise the whole
 * of a saved session, so a replay can jump ahead.
 */
function useEventSource() {
	const { race, snapshot, spoilers } = useRaceView();

	return spoilers.hidden ? snapshot : race;
}

/**
 * Moves the replay to the previous or next event that passes the viewer's filter. The events are
 * worked out on the key press, not on every update of a live session.
 */
export function useEventJump(): (direction: 1 | -1) => void {
	const source = useEventSource();
	const { lap, setLap, followedDriver } = useRaceView();
	const filter = eventFilterStore.useValue();

	return (direction) => {
		const step = adjacentEventStep(timelineEvents(source), lap, direction, filter, followedDriver);

		if (step !== null) {
			setLap(step);
		}
	};
}

function stepWord(unit: 'lap' | 'minute', step: number): string {
	return unit === 'lap' ? `Lap ${step}` : `Minute ${step}`;
}

/** Previous and next event, with what counts as one. */
function EventKeys({ events, compact }: { events: readonly TimelineEvent[]; compact: boolean }) {
	const { lap, followedDriver } = useRaceView();
	const jump = useEventJump();
	const filter = eventFilterStore.useValue();

	const has = (direction: 1 | -1) =>
		adjacentEventStep(events, lap, direction, filter, followedDriver) !== null;

	return (
		<div className="flex items-center gap-2">
			<span className="type-label hidden @md:inline">Events</span>
			<Key
				aria-label="Previous event"
				title="Previous event (Shift+←)"
				disabled={!has(-1)}
				onClick={() => jump(-1)}
			>
				<ChevronsLeftIcon />
			</Key>
			{compact ? null : (
				<KeyGroup<EventFilter>
					label="Events to step through"
					options={FILTER_OPTIONS}
					value={filter}
					onChange={eventFilterStore.set}
				/>
			)}
			<Key
				aria-label="Next event"
				title="Next event (Shift+→)"
				disabled={!has(1)}
				onClick={() => jump(1)}
			>
				<ChevronsRightIcon />
			</Key>
		</div>
	);
}

/** One key that cycles the playback speed, as multiples of real time: 1×, 10×, 60×. */
function SpeedKey() {
	const { speed, setSpeed, live } = useRaceView();
	const next = nextSpeed(speed);

	return (
		<Key
			aria-label={`Playback speed ${speed}×; press for ${next}×`}
			title="Playback speed"
			className="w-11 justify-center font-mono"
			disabled={live.following}
			onClick={() => setSpeed(next)}
			data-testid="speed"
		>
			{speed}×
		</Key>
	);
}

/**
 * The barcode as a scrubber: event markers over it, part starts across it, click or drag to move
 * the replay; the line under it says what happened where the pointer or the replay is.
 */
function Track({ events, compact }: { events: readonly TimelineEvent[]; compact: boolean }) {
	const { race, lap, setLap, steps, stepUnit, followedDriver } = useRaceView();
	const filter = eventFilterStore.useValue();
	const [hovered, setHovered] = React.useState<number | null>(null);
	const timed = stepUnit === 'minute';
	const total = timed ? sessionMinutes(race.session.type, steps) : race.session.totalLaps;
	const done = timed ? steps : race.currentLap;

	const byStep = React.useMemo(() => {
		const grouped = new Map<number, TimelineEvent[]>();

		for (const event of events) {
			grouped.set(event.step, [...(grouped.get(event.step) ?? []), event]);
		}

		return grouped;
	}, [events]);

	if (total === 0) {
		return null;
	}

	const position = (step: number) => `${((step - 0.5) / total) * 100}%`;

	const scrub = (event: React.PointerEvent<HTMLDivElement>) => {
		const box = event.currentTarget.getBoundingClientRect();
		const step = Math.ceil(((event.clientX - box.left) / box.width) * total);

		setLap(Math.min(Math.max(step, 1), Math.max(done, 1)));
	};

	const shownStep = hovered ?? lap;
	const shown = byStep.get(shownStep) ?? [];

	return (
		<div className="flex min-w-0 flex-col gap-1" data-testid="timeline">
			<div
				className="relative flex min-w-0 cursor-pointer touch-none flex-col gap-0.5"
				onPointerDown={(event) => {
					event.currentTarget.setPointerCapture(event.pointerId);
					scrub(event);
				}}
				onPointerMove={(event) => {
					if (event.buttons === 1) {
						scrub(event);
					}
				}}
			>
				<div className="relative h-3">
					{[...byStep].map(([step, stepEvents]) => {
						const lane = LANE_ORDER.find((entry) =>
							stepEvents.some((event) => event.lane === entry)
						);

						const lead = stepEvents.find((event) => event.lane === lane) ?? stepEvents[0];
						const picked = stepEvents.some((event) => matchesFilter(event, filter, followedDriver));
						const summary = stepEvents.map((event) => event.text).join('; ');
						const first = step === 1;

						return lead ? (
							<button
								key={step}
								type="button"
								tabIndex={-1}
								disabled={step > done}
								onClick={() => setLap(step)}
								// The marker's own step, not the one under the pointer, as a scrub would take.
								onPointerDown={(event) => event.stopPropagation()}
								onMouseEnter={() => setHovered(step)}
								onMouseLeave={() => setHovered(null)}
								aria-label={`${stepWord(stepUnit, step)}: ${summary}`}
								title={`${stepWord(stepUnit, step)}: ${summary}`}
								data-testid={`timeline-event-${step}`}
								className={cn(
									'absolute top-0 left-(--offset) flex h-3 items-end justify-center disabled:cursor-default',
									first ? 'translate-x-0' : '-translate-x-1/2',
									!picked && 'opacity-30'
								)}
								style={{ '--offset': first ? '0%' : position(step) }}
							>
								{lead.lane === 'start' ? (
									<span className="type-label text-foreground leading-3 font-bold">
										{timed ? lead.text.split(' ')[0] : 'Start'}
									</span>
								) : (
									<span
										aria-hidden
										className={cn(
											'block h-2.5 w-1.5',
											lead.tone === 'start' ? 'bg-foreground' : TONE_CLASS[lead.tone]
										)}
									/>
								)}
							</button>
						) : null;
					})}
				</div>
				<div className="relative">
					<LapStrip />
					{events
						.filter((event) => event.lane === 'start' && event.step > 1)
						.map((event) => (
							<span
								key={event.id}
								aria-hidden
								className="bg-rule-strong pointer-events-none absolute top-0 left-(--offset) h-8 w-px"
								style={{ '--offset': `${((event.step - 1) / total) * 100}%` }}
							/>
						))}
				</div>
			</div>
			{compact ? null : (
				<p className="min-h-4 truncate text-xs" data-testid="timeline-note">
					<span className="type-label mr-2">{stepWord(stepUnit, shownStep)}</span>
					{shown.length > 0 ? (
						shown.map((event) => event.text).join('; ')
					) : (
						<span className="text-muted-foreground">
							Shift + ← → for events, Space plays, L goes live
						</span>
					)}
				</p>
			)}
		</div>
	);
}

/**
 * The replay as one timeline: play, speed and steps, the events to jump between, and the
 * session's barcode to scrub through. On a live session it also holds the broadcast delay.
 */
export function Timeline() {
	const rows = useTileRows();
	const compact = rows !== null && rows <= COMPACT_ROWS;
	const source = useEventSource();
	const events = React.useMemo(() => timelineEvents(source), [source]);

	return (
		<section
			aria-label="Replay"
			className="@container flex h-full min-w-0 flex-col justify-end gap-2 py-1"
		>
			<div className="flex flex-wrap items-end gap-x-4 gap-y-2">
				<span className="flex gap-2">
					<Transport />
					{compact ? null : <SpeedKey />}
				</span>
				<EventKeys events={events} compact={compact} />
				<DelayControl />
				<span className="ml-auto">
					<LapCounter />
				</span>
			</div>
			<Track events={events} compact={compact} />
		</section>
	);
}
