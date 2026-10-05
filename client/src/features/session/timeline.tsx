import { ChevronsLeftIcon, ChevronsRightIcon } from 'lucide-react';
import * as React from 'react';

import { Key, KeyGroup } from '@/components/console/keys';
import { LapStrip } from '@/components/lap-strip';
import { DelayControl, LapCounter, Transport } from '@/components/race-clock';
import { useRaceView, useVisibleRace } from '@/data/race-context';
import { nextSpeed } from '@/data/replay-clock';
import { eventFilterStore, timelineHintStore } from '@/data/viewer-settings';
import { sessionMinutes } from '@/insights/qualifying';
import {
	adjacentEventStep,
	EVENT_FILTER_LABEL,
	EVENT_FILTER_TITLE,
	EVENT_FILTERS,
	type EventFilter,
	markKind,
	type MarkKind,
	matchesFilter,
	type TimelineEvent,
	timelineEvents
} from '@/insights/timeline';
import { cn } from '@/lib/utils';

import { useTileRows } from '../dashboard/tile-fill';

/** A replay tile this many grid rows tall or shorter leaves out the line that says what happened. */
const COMPACT_ROWS = 3;

const FILTER_OPTIONS = EVENT_FILTERS.map((value) => ({
	value,
	label: EVENT_FILTER_LABEL[value],
	title: EVENT_FILTER_TITLE[value]
}));

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
 * Moves the replay to the previous or next event that passes the viewer's filter. The events are
 * worked out on the key press, not on every update of a live session.
 */
export function useEventJump(): (direction: 1 | -1) => void {
	const source = useVisibleRace();
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
			<span className="type-label hidden @5xl:inline">Events</span>
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
	const { speed, setSpeed } = useRaceView();
	const next = nextSpeed(speed);

	return (
		<Key
			aria-label={`Playback speed ${speed}×; press for ${next}×`}
			title="Playback speed"
			className="w-11 justify-center font-mono"
			onClick={() => setSpeed(next)}
			data-testid="speed"
		>
			{speed}×
		</Key>
	);
}

/** Each kind of marker as the legend names it, with the colour it is drawn in. */
const MARK_LEGEND: Record<Exclude<MarkKind, 'start'>, { label: string; className: string }> = {
	flag: { label: 'Yellow, VSC or safety car', className: 'bg-flag' },
	red: { label: 'Red flag, penalty or car out', className: 'bg-danger' },
	stop: { label: 'Pit stop', className: 'bg-blue-flag' },
	lead: { label: 'New leader', className: 'border-foreground border' },
	fastest: { label: 'Fastest lap', className: 'bg-fastest' }
};

const LEGEND_ORDER = ['flag', 'red', 'stop', 'lead', 'fastest'] as const;

/** The colours on the track, named, for the kinds of marker it holds. */
function Legend({ kinds }: { kinds: ReadonlySet<MarkKind> }) {
	return (
		<ul
			className="flex min-w-0 basis-full flex-wrap gap-x-4 gap-y-1 text-sm"
			data-testid="timeline-legend"
		>
			<li className="text-muted-foreground">Dark bars played, light to come, handle is now</li>
			{/* The colours stay together, so a narrow tile wraps the whole group and never strands one. */}
			<li>
				<ul className="flex flex-wrap gap-x-4 gap-y-1">
					{LEGEND_ORDER.flatMap((kind) =>
						kinds.has(kind) ? (
							<li key={kind} className="flex items-center gap-1.5 whitespace-nowrap">
								<span aria-hidden className={cn('block h-3.5 w-2', MARK_LEGEND[kind].className)} />
								{MARK_LEGEND[kind].label}
							</li>
						) : (
							[]
						)
					)}
				</ul>
			</li>
		</ul>
	);
}

/** The keys that move the replay, shown while the pointer is over the track. */
function KeysNote() {
	return (
		<span className="text-muted-foreground whitespace-nowrap" data-testid="timeline-keys">
			<kbd className="text-foreground font-mono">← →</kbd> lap ·{' '}
			<kbd className="text-foreground font-mono">⇧← →</kbd> event ·{' '}
			<kbd className="text-foreground font-mono">Space</kbd> play
		</span>
	);
}

/**
 * Hides the first-visit hint once the viewer has moved the replay themselves: dragged, clicked,
 * stepped or played. A live session moving on its own does not count.
 */
function useHintDismissal(show: boolean): void {
	const { lap, playing, live } = useRaceView();
	const seenLap = React.useRef(lap);

	React.useEffect(() => {
		const moved = lap !== seenLap.current && !live.following;

		seenLap.current = lap;

		if (show && (moved || (playing && !live.isLive))) {
			timelineHintStore.set(false);
		}
	}, [show, lap, playing, live.following, live.isLive]);
}

/**
 * The barcode as a scrubber: a playhead with its lap on it to drag, a click anywhere to jump,
 * the events marked over it in colours its legend names; the line under it says what happened
 * where the pointer or the replay is.
 */
function Track({ events, compact }: { events: readonly TimelineEvent[]; compact: boolean }) {
	const { race, lap, setLap, steps, stepUnit, followedDriver } = useRaceView();
	const filter = eventFilterStore.useValue();
	const hint = timelineHintStore.useValue();
	const [hovered, setHovered] = React.useState<number | null>(null);
	const timed = stepUnit === 'minute';
	const total = timed ? sessionMinutes(race.session.type, steps) : race.session.totalLaps;
	const done = timed ? steps : race.currentLap;

	useHintDismissal(hint);

	const byStep = React.useMemo(() => {
		const grouped = new Map<number, TimelineEvent[]>();

		for (const event of events) {
			if (markKind(event) !== null) {
				grouped.set(event.step, [...(grouped.get(event.step) ?? []), event]);
			}
		}

		return grouped;
	}, [events]);

	const kinds = React.useMemo(
		() => new Set(events.flatMap((event) => markKind(event) ?? [])),
		[events]
	);

	if (total === 0) {
		return null;
	}

	const position = (step: number) => `${((step - 0.5) / total) * 100}%`;

	const stepAt = (event: React.PointerEvent<HTMLDivElement>) => {
		const box = event.currentTarget.getBoundingClientRect();

		return Math.min(
			Math.max(Math.ceil(((event.clientX - box.left) / box.width) * total), 1),
			total
		);
	};

	const scrub = (event: React.PointerEvent<HTMLDivElement>) => {
		setLap(Math.min(stepAt(event), Math.max(done, 1)));
	};

	const allEvents = (step: number) => events.filter((event) => event.step === step);

	// With nothing on the replay's own step, the line keeps what happened last before it.
	const shownStep =
		hovered ??
		(allEvents(lap).length > 0 ? lap : (events.findLast((event) => event.step < lap)?.step ?? lap));

	// Flags, cars out and stops before passes, so a cut line loses the least.
	const shown = allEvents(shownStep).toSorted(
		(a, b) => LANE_ORDER.indexOf(a.lane) - LANE_ORDER.indexOf(b.lane)
	);

	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col justify-end gap-1" data-testid="timeline">
			<div
				className="has-focus-visible:outline-ring relative flex min-h-0 min-w-0 flex-1 cursor-pointer touch-none flex-col justify-end gap-0.5 pt-1 has-focus-visible:outline-2"
				data-testid="timeline-track"
				onPointerDown={(event) => {
					event.currentTarget.setPointerCapture(event.pointerId);
					scrub(event);
				}}
				onPointerMove={(event) => {
					if (event.buttons === 1) {
						scrub(event);
					} else if (event.pointerType === 'mouse') {
						setHovered(stepAt(event));
					}
				}}
				onPointerLeave={() => setHovered(null)}
			>
				{/* The track for keys and screen readers; the pointer uses the drawing over it. */}
				<input
					type="range"
					className="sr-only"
					aria-label={timed ? 'Session minute' : 'Race lap'}
					aria-valuetext={`${stepWord(stepUnit, lap)} of ${total}`}
					min={1}
					max={Math.max(done, 1)}
					value={lap}
					onChange={(event) => setLap(Number(event.currentTarget.value))}
					data-testid="timeline-slider"
				/>
				<div className="relative h-3">
					{[...byStep].map(([step, stepEvents]) => {
						const lane = LANE_ORDER.find((entry) =>
							stepEvents.some((event) => event.lane === entry)
						);

						const lead = stepEvents.find((event) => event.lane === lane) ?? stepEvents[0];

						const kind = lead ? markKind(lead) : null;
						const picked = stepEvents.some((event) => matchesFilter(event, filter, followedDriver));

						const summary = allEvents(step)
							.map((event) => event.text)
							.join('; ');

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
								{kind === null || kind === 'start' ? (
									<span className="type-label text-foreground leading-3 font-bold">
										{timed ? lead.text.split(' ')[0] : 'Start'}
									</span>
								) : (
									<span
										aria-hidden
										className={cn('block h-2.5 w-1.5', MARK_LEGEND[kind].className)}
									/>
								)}
							</button>
						) : null;
					})}
				</div>
				<div className="relative flex max-h-56 min-h-0 flex-1 flex-col">
					<LapStrip plain />
					{events
						.filter((event) => event.lane === 'start' && event.step > 1)
						.map((event) => (
							<span
								key={event.id}
								aria-hidden
								className="bg-rule-strong pointer-events-none absolute top-0 bottom-5 left-(--offset) w-px"
								style={{ '--offset': `${((event.step - 1) / total) * 100}%` }}
							/>
						))}
					{hovered !== null && hovered !== lap ? (
						<span
							aria-hidden
							className="bg-foreground/50 pointer-events-none absolute -top-4 bottom-5 left-(--offset) w-px"
							style={{ '--offset': position(hovered) }}
						/>
					) : null}
					<span
						aria-hidden
						data-testid="timeline-playhead"
						className="pointer-events-none absolute -top-4 bottom-5 left-(--offset) flex -translate-x-1/2 flex-col items-center"
						style={{ '--offset': position(lap) }}
					>
						<span className="bg-foreground text-background -mt-3 cursor-grab px-1 font-mono text-xs leading-4 font-bold whitespace-nowrap shadow-sm">
							{timed ? `${lap}m` : `L${lap}`}
						</span>
						<span className="bg-foreground w-0.5 flex-1" />
					</span>
				</div>
			</div>
			{compact ? null : (
				<div className="flex min-h-4 min-w-0 shrink-0 flex-col gap-1 text-sm">
					{/* The note has its own line above the legend, and wraps on a phone, so the hint is never squeezed out. */}
					<p className="min-w-0 shrink-0 py-0.5 leading-5 @md:truncate" data-testid="timeline-note">
						{hint ? (
							<span className="font-medium" data-testid="timeline-hint">
								Drag or click to move through the {timed ? 'session' : 'race'}, Space plays
							</span>
						) : (
							<>
								<span className="type-label mr-2">{stepWord(stepUnit, shownStep)}</span>
								{shown.map((event) => event.text).join('; ')}
							</>
						)}
					</p>
					{hovered === null ? <Legend kinds={kinds} /> : <KeysNote />}
				</div>
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
	const source = useVisibleRace();
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
