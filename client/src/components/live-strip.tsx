import type { Driver } from '@f1-live/shared';
import { ChevronsUpDownIcon, EyeIcon } from 'lucide-react';
import * as React from 'react';

import { Key } from '@/components/console/keys';
import { LapCounter, Transport } from '@/components/race-clock';
import { TeamStripe } from '@/components/driver-tag';
import { TrackStatusBadge } from '@/components/track-status-badge';
import {
	findSession,
	formatLocalStart,
	formatUntil,
	nextSession,
	SESSION_TYPE_LABEL,
	type SessionEntry
} from '@/data/catalog';
import type { LiveConnection } from '@/data/live-feed';
import { useRace } from '@/data/race-context';
import { sessionKind } from '@/features/dashboard/dashboards';
import { SessionPickerDialog } from '@/features/session/session-picker';
import { useShownDashboard } from '@/features/library/shown-dashboard';
import { useFeedLabel } from '@/features/session/session-tiles';
import { useNow } from '@/hooks/use-now';
import { useScreenTime } from '@/hooks/use-screen-time';
import { type Knockout, knockout, onTrack, stillToRun } from '@/insights/knockout';
import { isSessionOver } from '@/insights/qualifying';
import { clockAt, formatCountdown } from '@/insights/session-clock';
import type { StandingRow } from '@/insights/standings';
import { formatLapTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/** A reading on the strip: its printed label above, the value below; phones drop the label. */
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
		<div className={cn('flex min-w-0 flex-col justify-end', className)} data-testid={testId}>
			<span className="type-label max-sm:sr-only">{label}</span>
			<span className="flex min-w-0 items-center gap-2 text-sm leading-6 font-medium">
				{children}
			</span>
		</div>
	);
}

const CONNECTION_LABEL: Record<Exclude<LiveConnection, 'live'>, string> = {
	connecting: 'Connecting',
	stale: 'Stale',
	reconnecting: 'Reconnecting'
};

/** "Live" lit like an on-air sign while the screen follows a running session. */
function StateMark() {
	const { live } = useRace();
	const feed = useFeedLabel();

	if (live.isLive && !live.following) {
		return (
			<Key onClick={live.backToLive} data-testid="live-key">
				Back to live
			</Key>
		);
	}

	const lit = live.isLive && live.connection === 'live';

	return (
		<output
			aria-live="polite"
			data-testid="live-key"
			className={cn(
				'type-wide inline-flex h-7 shrink-0 items-center self-center border px-2 text-xs font-black italic',
				lit && 'border-foreground bg-foreground text-background',
				!lit && live.isLive && 'border-dashed',
				!live.isLive && 'text-muted-foreground'
			)}
		>
			{live.isLive && live.connection !== 'live' ? CONNECTION_LABEL[live.connection] : feed}
		</output>
	);
}

function Codes({ rows, followed }: { rows: readonly StandingRow[]; followed: string }) {
	return (
		<span className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-2.5">
			{rows.map((row) => (
				<span
					key={row.driver.number}
					className={cn(
						'flex items-center gap-1',
						row.out && 'text-muted-foreground',
						row.driver.number === followed &&
							'decoration-focus underline decoration-2 underline-offset-4'
					)}
				>
					<TeamStripe driver={row.driver} className="h-3.5" />
					<span className="type-wide text-xs font-bold">{row.driver.code}</span>
				</span>
			))}
		</span>
	);
}

function DriverReading({ driver, children }: { driver: Driver; children?: React.ReactNode }) {
	return (
		<>
			<TeamStripe driver={driver} className="h-3.5" />
			<span className="type-wide text-xs font-bold">{driver.code}</span>
			{children}
		</>
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
			<span className="font-mono text-2xl leading-7 font-bold">
				{formatCountdown(reading.remainingMs)}
			</span>
			{reading.running || reading.remainingMs === 0 ? null : (
				<span className="type-label">Held</span>
			)}
		</Reading>
	);
}

/**
 * The transport, for pages whose dashboard has no Replay tile: on wider screens the session can
 * always be moved, whatever a viewer took off their screen. Phones keep the strip to one line.
 */
function StripClock() {
	const dashboard = useShownDashboard();

	if (dashboard?.tiles.some((tile) => tile.kind === 'replay')) {
		return null;
	}

	return (
		<div className="flex items-center gap-3 max-sm:hidden" data-testid="header-clock">
			<LapCounter />
			<Transport />
		</div>
	);
}

function sessionTitle(entry: SessionEntry): string {
	return `${entry.meeting.name.replace(/ Grand Prix$/, '')} ${entry.session.name}`;
}

/** Where to go when this session is not the one that matters now: the live one, or the next. */
function Elsewhere() {
	const { catalog, live, sessionKey, setSession } = useRace();
	const now = useNow();
	const liveEntry = catalog && live.liveKey ? findSession(catalog, live.liveKey) : null;
	const next = catalog && !live.liveKey ? nextSession(catalog, now) : null;

	if (liveEntry && liveEntry.key !== sessionKey) {
		return (
			<span className="flex items-center gap-3" data-testid="strip-live-elsewhere">
				<Reading label="Live now" className="max-sm:hidden">
					{sessionTitle(liveEntry)}
				</Reading>
				<Key pressed onClick={() => setSession(liveEntry.key)}>
					Watch live
				</Key>
			</span>
		);
	}

	if (!next || next.key === sessionKey) {
		return null;
	}

	return (
		<span className="flex items-end gap-4" data-testid="strip-next">
			<Reading label="Next">{sessionTitle(next)}</Reading>
			<Reading label="Starts" className="max-lg:hidden">
				{formatLocalStart(next.session.startsAt)}
			</Reading>
			<Reading label="In">{formatUntil(now, Date.parse(next.session.startsAt))}</Reading>
		</span>
	);
}

/**
 * Which session is on screen and how it stands, in one always-visible line under the top bar:
 * live or not, the part and the time left, the flag, and who is in danger or in front. When
 * the session on screen is not live, it points to the one that is, or to the next.
 */
export function LiveStrip() {
	const { race, snapshot, standings, followedDriver, spoilers, lap, sessionError } = useRace();
	const [picking, setPicking] = React.useState(false);
	const time = useScreenTime();
	const now = useNow();
	const kind = sessionKind(race.session.type);
	const state = knockout(snapshot, standings);
	const upcoming = race.laps.length === 0 && Date.parse(race.session.startsAt) > now;
	const toRun = state ? stillToRun(state, onTrack(snapshot, standings, time)) : [];
	const leader = standings.find((row) => row.out === null);
	const fastest = standings.find((row) => row.bestLapMs !== null);
	const name = race.session.name ?? SESSION_TYPE_LABEL[race.session.type];

	return (
		<section
			aria-label="Session status"
			data-testid="live-strip"
			className="flex flex-wrap items-end gap-x-3 gap-y-1.5 border-t px-3 py-1.5 sm:gap-x-5 sm:px-4 md:px-6"
		>
			<StateMark />
			<Reading
				label={race.session.meetingName.replace(/ Grand Prix$/, ' GP')}
				// A phone shows only the part here; the first tab already names the session.
				className={state?.part ? undefined : 'max-sm:hidden'}
				testId="strip-session"
			>
				<span className="type-wide text-xs font-bold max-sm:hidden">{name}</span>
				{state?.part ? (
					<span className="type-wide text-sm font-black" data-testid="strip-part">
						{state.prefix}
						{state.part}
					</span>
				) : null}
			</Reading>
			{upcoming ? (
				<>
					<Reading label="Starts">{formatLocalStart(race.session.startsAt)}</Reading>
					<Reading label="In">{formatUntil(now, Date.parse(race.session.startsAt))}</Reading>
				</>
			) : (
				<>
					{kind === 'race' ? (
						<Reading label="Lap">
							<span className="sr-only" data-testid="lap-counter">
								Lap {lap}
								{race.session.totalLaps > 0 ? `/${race.session.totalLaps}` : null}
							</span>
							<span aria-hidden className="font-mono text-2xl leading-7 font-bold">
								{lap}
							</span>
							{race.session.totalLaps > 0 ? (
								<span aria-hidden className="text-muted-foreground font-mono text-sm">
									/{race.session.totalLaps}
								</span>
							) : null}
						</Reading>
					) : (
						<ClockReading state={state} />
					)}
					<Reading label="Track">
						<TrackStatusBadge status={snapshot.trackStatus} />
					</Reading>
					{kind === 'race' && leader ? (
						<Reading label="Leader" className="max-sm:hidden" testId="strip-leader">
							<DriverReading driver={leader.driver} />
						</Reading>
					) : null}
					{kind === 'practice' && fastest?.bestLapMs ? (
						<Reading label="Fastest" className="max-sm:hidden">
							<DriverReading driver={fastest.driver}>
								<span className="font-mono text-xs">{formatLapTime(fastest.bestLapMs)}</span>
							</DriverReading>
						</Reading>
					) : null}
					{state?.running ? (
						<Reading label="To run" className="max-sm:hidden">
							<span
								className="font-mono"
								title="Cars still in this part that are out on track or yet to set a time"
							>
								{toRun.length}
							</span>
						</Reading>
					) : null}
					{state && state.dropZone.length > 0 ? (
						<Reading
							label={`${state.prefix}${state.part} drop zone`}
							className="max-sm:order-last max-sm:basis-full"
							testId="strip-drop-zone"
						>
							<span className="type-label text-danger sm:hidden">Out</span>
							<Codes rows={state.dropZone} followed={followedDriver} />
						</Reading>
					) : null}
				</>
			)}
			<div className="ml-auto flex items-end gap-3">
				<Elsewhere />
				<StripClock />
				{spoilers.hidden ? (
					<Key onClick={spoilers.reveal} title="Spoiler-free: results are hidden">
						<EyeIcon aria-hidden />
						<span className="max-sm:hidden">Show results</span>
					</Key>
				) : null}
				<Key onClick={() => setPicking(true)} aria-haspopup="dialog" aria-label="Sessions">
					<span className="max-md:hidden">Sessions</span>
					<ChevronsUpDownIcon aria-hidden />
				</Key>
			</div>
			{sessionError ? (
				<p role="alert" className="text-danger basis-full text-xs">
					{sessionError}
				</p>
			) : null}
			<SessionPickerDialog open={picking} onOpenChange={setPicking} />
		</section>
	);
}
