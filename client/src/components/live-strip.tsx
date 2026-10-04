import { ChevronsUpDownIcon, EyeIcon, SkipBackIcon } from 'lucide-react';
import * as React from 'react';

import { Key } from '@/components/console/keys';
import { LapCounter, LiveKey, Transport } from '@/components/race-clock';
import { TrackStatusBadge } from '@/components/track-status-badge';
import { findSession, formatUntil, SESSION_TYPE_LABEL } from '@/data/catalog';
import type { LiveConnection } from '@/data/live-feed';
import { useRace } from '@/data/race-context';
import { sessionKind } from '@/features/dashboard/dashboards';
import { sessionTitle } from '@/features/home/latest-weekend';
import { SessionPickerDialog } from '@/features/session/session-picker';
import { useShownDashboard } from '@/features/library/shown-dashboard';
import { useFeedLabel } from '@/features/session/session-tiles';
import { useNow } from '@/hooks/use-now';
import { useScreenTime } from '@/hooks/use-screen-time';
import { type Knockout, knockout } from '@/insights/knockout';
import { isSessionOver } from '@/insights/qualifying';
import { clockAt, formatCountdown } from '@/insights/session-clock';
import { cn } from '@/lib/utils';

/** A reading in the bar: one line, its label printed small before the value on wider screens. */
function Reading({
	label,
	children,
	className,
	testId
}: {
	label: string;
	children: React.ReactNode;
	className?: string;
	testId?: string;
}) {
	return (
		<span
			className={cn('flex min-w-0 shrink-0 items-baseline gap-1.5', className)}
			data-testid={testId}
		>
			<span className="type-label max-lg:sr-only">{label}</span>
			<span className="flex min-w-0 items-baseline gap-1 text-sm font-medium">{children}</span>
		</span>
	);
}

const CONNECTION_LABEL: Record<Exclude<LiveConnection, 'live'>, string> = {
	connecting: 'Connecting',
	stale: 'Stale',
	reconnecting: 'Reconnecting'
};

/**
 * Replay, Upcoming or No data, or why a live feed stopped. A live session's key sits with the
 * transport instead, in the Replay tile or the bar's clock, so going back to live is where play
 * and the lap are.
 */
function StateMark() {
	const { live } = useRace();
	const feed = useFeedLabel();

	if (live.isLive && live.connection === 'live') {
		return null;
	}

	return (
		<output
			aria-live="polite"
			data-testid={live.isLive ? 'live-connection' : 'live-key'}
			className={cn(
				'type-wide inline-flex h-7 shrink-0 items-center self-center border px-2 text-xs font-black italic',
				live.isLive
					? 'border-dashed'
					: // A phone's bar has no room for the word; the strip keeps the finish key clear instead.
						'text-muted-foreground max-sm:sr-only'
			)}
		>
			{live.isLive && live.connection !== 'live' ? CONNECTION_LABEL[live.connection] : feed}
		</output>
	);
}

/** Time left in the session or the part, or why the clock is not running. */
function ClockReading({ state }: { state: Knockout | null }) {
	const { snapshot } = useRace();
	const time = useScreenTime({ tick: true });
	const status = snapshot.status ?? 'inactive';
	const reading = clockAt(snapshot, time);
	const part = state?.part ? `${state.prefix}${state.part}` : null;

	if (isSessionOver(status) || state?.finished || (state === null && status === 'finished')) {
		return (
			<Reading label="Session">
				<span className="type-wide text-xs font-bold">Finished</span>
			</Reading>
		);
	}

	if (state && part && !state.running) {
		return (
			<Reading label={`${part} over`}>
				<span className="type-wide text-xs font-bold">Break</span>
			</Reading>
		);
	}

	if (!reading) {
		return null;
	}

	return (
		<Reading label={part ? `${part} left` : 'Time left'} testId="strip-time">
			<span className="font-mono text-base font-bold">{formatCountdown(reading.remainingMs)}</span>
			{reading.running || reading.remainingMs === 0 ? null : (
				<span className="type-label">Held</span>
			)}
		</Reading>
	);
}

/**
 * The transport, for pages whose dashboard has no Replay tile: on wider screens the session can
 * always be moved, whatever a viewer took off their screen. Phones keep the strip to one line,
 * with the live key alone.
 */
function StripClock() {
	const dashboard = useShownDashboard();

	if (dashboard?.tiles.some((tile) => tile.kind === 'replay')) {
		return null;
	}

	return (
		<div className="flex shrink-0 items-center gap-2" data-testid="header-clock">
			<span className="flex items-center gap-3 max-sm:hidden">
				<LapCounter />
				<Transport live={false} />
			</span>
			<LiveKey />
		</div>
	);
}

/** The session that is live, when it is not the one on screen. */
function Elsewhere() {
	const { catalog, live, sessionKey, setSession } = useRace();
	const liveEntry = catalog && live.liveKey ? findSession(catalog, live.liveKey) : null;

	if (!liveEntry || liveEntry.key === sessionKey) {
		return null;
	}

	return (
		<Key
			pressed
			onClick={() => setSession(liveEntry.key)}
			title={`Live now: ${sessionTitle(liveEntry)}`}
			data-testid="strip-live-elsewhere"
		>
			Watch live
			<span className="sr-only">: {sessionTitle(liveEntry)}</span>
		</Key>
	);
}

/**
 * The session on screen, in the top bar: live or not, which session (it opens the picker), the
 * lap or the time left, and the flag when it is not green. Everything else about the session is
 * a tile's job.
 */
export function LiveStrip({ compact = false }: { compact?: boolean }) {
	const { race, snapshot, standings, spoilers, live, lap, setLap, sessionError } = useRace();
	const [picking, setPicking] = React.useState(false);
	const now = useNow();
	const kind = sessionKind(race.session.type);
	const state = knockout(snapshot, standings);
	const upcoming = race.laps.length === 0 && Date.parse(race.session.startsAt) > now;
	const name = race.session.name ?? SESSION_TYPE_LABEL[race.session.type];
	const meeting = race.session.meetingName.replace(/ Grand Prix$/, ' GP');

	return (
		<section
			aria-label="Session status"
			data-testid="live-strip"
			className="flex min-w-0 items-center gap-2 sm:gap-3"
		>
			<StateMark />
			<Key
				onClick={() => setPicking(true)}
				aria-haspopup="dialog"
				aria-label={`Sessions: ${meeting}, ${name}`}
				title="Pick a session"
				className="min-w-0 normal-case max-sm:px-1.5"
				data-testid="strip-session"
			>
				<span className={cn('type-wide truncate font-bold', compact ? 'hidden' : 'max-xl:hidden')}>
					{meeting} · {name}
				</span>
				<ChevronsUpDownIcon aria-hidden />
			</Key>
			{state?.part ? (
				<span className="type-wide shrink-0 text-sm font-black" data-testid="strip-part">
					{state.prefix}
					{state.part}
				</span>
			) : null}
			{upcoming ? (
				<Reading label="Starts in">{formatUntil(now, Date.parse(race.session.startsAt))}</Reading>
			) : kind === 'race' ? (
				<Reading label="Lap">
					<span className="sr-only" data-testid="lap-counter">
						Lap {lap}
						{race.session.totalLaps > 0 ? `/${race.session.totalLaps}` : null}
					</span>
					<span aria-hidden className="font-mono text-base font-bold">
						{lap}
					</span>
					{race.session.totalLaps > 0 ? (
						<span aria-hidden className="text-muted-foreground font-mono text-xs">
							/{race.session.totalLaps}
						</span>
					) : null}
				</Reading>
			) : (
				<ClockReading state={state} />
			)}
			{snapshot.trackStatus === 'green' || upcoming ? null : (
				<TrackStatusBadge status={snapshot.trackStatus} labelClassName="max-sm:sr-only" />
			)}
			<Elsewhere />
			<StripClock />
			{spoilers.hidden ? (
				<Key
					onClick={spoilers.reveal}
					aria-label="Jump to the finish (shows results)"
					title="Results are hidden; this shows them"
				>
					<EyeIcon aria-hidden />
					<span className="max-2xl:hidden">Jump to the finish</span>
				</Key>
			) : null}
			{live.isLive && lap > 1 ? (
				<Key
					onClick={() => setLap(1)}
					aria-label="From the start"
					title="Watch this session from its start"
				>
					<SkipBackIcon aria-hidden />
				</Key>
			) : null}
			{sessionError ? (
				<p role="alert" className="text-danger max-w-48 truncate text-xs" title={sessionError}>
					{sessionError}
				</p>
			) : null}
			<SessionPickerDialog open={picking} onOpenChange={setPicking} />
		</section>
	);
}
