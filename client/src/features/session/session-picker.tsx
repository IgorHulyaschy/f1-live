import { EyeOffIcon } from 'lucide-react';
import * as React from 'react';

import { Key } from '@/components/console/keys';
import { SeasonSwitch } from '@/components/season-switch';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle
} from '@/components/ui/dialog';
import {
	availability,
	type CatalogMeeting,
	formatLocalStart,
	type SessionAvailability,
	type SessionEntry,
	sessionEntries
} from '@/data/catalog';
import { useRace } from '@/data/race-context';
import { revealSession, useIsRevealed } from '@/data/viewer-settings';
import { useNow } from '@/hooks/use-now';
import { cn } from '@/lib/utils';

/** A running session, printed like a lit "on air" key. */
export function LiveBadge({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				'type-label bg-foreground text-background inline-flex items-center px-1 leading-4 font-bold',
				className
			)}
		>
			Live
		</span>
	);
}

function AvailabilityNote({
	entry,
	state,
	hidden
}: {
	entry: SessionEntry;
	state: SessionAvailability;
	hidden: boolean;
}) {
	if (state === 'live') {
		return <LiveBadge />;
	}

	if (state === 'upcoming') {
		return <span className="type-label">{formatLocalStart(entry.session.startsAt)}</span>;
	}

	if (state === 'missing') {
		return <span className="type-label">No data</span>;
	}

	return hidden ? (
		<span className="type-label inline-flex items-center gap-1">
			<EyeOffIcon aria-hidden className="size-3" />
			Results hidden
		</span>
	) : null;
}

function dateRange(meeting: CatalogMeeting): string {
	const first = meeting.sessions[0]?.startsAt;
	const last = meeting.sessions.at(-1)?.startsAt;

	if (!first || !last) {
		return '';
	}

	const format = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

	return format.formatRange(new Date(first), new Date(last));
}

/**
 * Season, then meeting, then session. Sessions with nothing to show yet are listed with their
 * start in the viewer's time, so the picker doubles as the weekend's timetable.
 */
export function SessionPicker({ onPicked }: { onPicked?: () => void }) {
	const { catalog, sessionKey, setSession, live, switchingTo, spoilers } = useRace();
	const entries = React.useMemo(() => (catalog ? sessionEntries(catalog) : []), [catalog]);
	const current = entries.find((entry) => entry.key === sessionKey);
	const years = catalog?.seasons.map((season) => season.year) ?? [];
	const [year, setYear] = React.useState(current?.year ?? years.at(-1) ?? 0);
	const meetings = catalog?.seasons.find((season) => season.year === year)?.meetings ?? [];
	const [meetingKey, setMeetingKey] = React.useState(current?.meeting.key ?? null);
	const meeting = meetings.find((entry) => entry.key === meetingKey) ?? meetings.at(-1);
	const now = useNow();
	const isRevealed = useIsRevealed();

	// The list opens scrolled to the meeting on screen, which is usually near the season's end.
	const scrollToSelected = React.useCallback((element: HTMLButtonElement | null) => {
		element?.scrollIntoView({ block: 'nearest' });
	}, []);

	const pick = (key: string) => {
		if (key !== sessionKey) {
			setSession(key);
		}

		onPicked?.();
	};

	// Revealed first, so the session opens at its finish.
	const showResults = (key: string) => {
		if (key === sessionKey) {
			spoilers.reveal();
		} else {
			revealSession(key);
		}

		pick(key);
	};

	return (
		<div className="flex min-h-0 flex-col gap-3" data-testid="session-picker">
			<div className="flex flex-wrap items-center justify-between gap-2">
				{years.length > 1 ? (
					<SeasonSwitch
						years={years}
						value={year}
						onChange={(value) => {
							setYear(value);
							setMeetingKey(null);
						}}
					/>
				) : (
					<span />
				)}
				<Key
					role="switch"
					aria-checked={spoilers.protect}
					pressed={spoilers.protect}
					onClick={() => spoilers.setProtect(!spoilers.protect)}
					title="Open finished sessions at the start and keep results hidden until you ask"
				>
					Spoiler protection
				</Key>
			</div>
			<div className="grid min-h-0 gap-x-4 gap-y-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
				<section aria-label="Meetings" className="flex min-h-0 flex-col">
					<h3 className="type-label border-rule-strong border-b-2 pb-1">Meeting</h3>
					<ul className="max-h-[22svh] overflow-y-auto sm:max-h-[50svh]">
						{meetings.map((entry) => {
							const selected = entry.key === meeting?.key;

							const running = entry.sessions.some(
								(session) => String(session.key) === live.liveKey
							);

							return (
								<li key={entry.key} className="border-b">
									<button
										type="button"
										ref={selected ? scrollToSelected : undefined}
										aria-pressed={selected}
										onClick={() => setMeetingKey(entry.key)}
										className={cn(
											'hover:bg-accent focus-visible:bg-accent flex w-full items-center gap-3 px-2 py-2 text-left transition-colors focus-visible:outline-none',
											selected && 'bg-accent'
										)}
									>
										<span className="flex min-w-0 flex-1 flex-col">
											<span className="type-wide truncate text-xs font-bold">
												{entry.name.replace(/ Grand Prix$/, '')}
											</span>
											<span className="text-muted-foreground truncate text-xs">
												{entry.location}
											</span>
										</span>
										{running ? <LiveBadge /> : null}
										<span className="type-label shrink-0">{dateRange(entry)}</span>
									</button>
								</li>
							);
						})}
					</ul>
				</section>
				<section aria-label="Sessions" className="flex min-h-0 flex-col">
					<h3 className="type-label border-rule-strong border-b-2 pb-1">Session</h3>
					<ul>
						{entries
							.filter((entry) => entry.meeting.key === meeting?.key && entry.year === year)
							.map((entry) => {
								const state = availability(entry, live.liveKey, now);
								const selected = entry.key === sessionKey;
								const hidden = state === 'saved' && !isRevealed(entry.key);

								return (
									<li key={entry.key} className="flex items-center gap-1 border-b">
										<button
											type="button"
											disabled={state === 'missing'}
											aria-current={selected ? 'true' : undefined}
											onClick={() => pick(entry.key)}
											data-testid={`session-${entry.key}`}
											className={cn(
												'hover:bg-accent focus-visible:bg-accent relative flex min-w-0 flex-1 items-center gap-3 px-2 py-2.5 text-left transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40',
												selected && 'bg-accent'
											)}
										>
											{selected ? (
												<span aria-hidden className="bg-focus absolute inset-y-0 left-0 w-0.75" />
											) : null}
											<span className="type-wide min-w-0 flex-1 truncate text-xs font-bold">
												{entry.session.name}
											</span>
											{switchingTo === entry.key ? (
												<span className="type-label">Loading</span>
											) : (
												<AvailabilityNote entry={entry} state={state} hidden={hidden} />
											)}
										</button>
										{hidden ? (
											<Key
												onClick={() => showResults(entry.key)}
												aria-label={`Show results of ${entry.session.name}`}
												data-testid={`show-results-${entry.key}`}
											>
												Show
											</Key>
										) : null}
									</li>
								);
							})}
					</ul>
				</section>
			</div>
		</div>
	);
}

export function SessionPickerDialog({
	open,
	onOpenChange
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="top-[8%] sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>Sessions</DialogTitle>
					<DialogDescription>
						A running session opens live. Start times are in your time zone.
					</DialogDescription>
				</DialogHeader>
				{open ? <SessionPicker onPicked={() => onOpenChange(false)} /> : null}
			</DialogContent>
		</Dialog>
	);
}
