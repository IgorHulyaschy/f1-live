import type { RaceControlMessage } from '@f1-live/shared';
import * as React from 'react';

import { Panel, PanelHeader } from '@/components/console/panel';
import { TrackStatusBadge } from '@/components/track-status-badge';
import { useRace } from '@/data/race-context';
import { isTimedSession } from '@/insights/qualifying';
import { cn } from '@/lib/utils';

import { useTileFill } from '../dashboard/tile-fill';
import { flagOf, marshalSectorCount, marshalSpan, type SectorFlag, sectorFlags } from './flags';
import { MapCanvas } from './map-canvas';
import { MapNote, MapPending, usePlacesNow } from './map-parts';
import type { MapTheme, Overlay } from './track-draw';
import { type TrackReady, usePlaces, useTrackData } from './use-track';

/** Flags are read again this often while the replay runs. */
const READ_EVERY_MS = 500;

/** Earlier flags listed under the ones out now. */
const EARLIER_SHOWN = 4;

const LEVEL_LABEL = { yellow: 'Yellow', double: 'Double yellow' } as const;

/** Where a message fell: its lap in a race, its minute of the session on the clock. */
function when(message: RaceControlMessage, startMs: number | null): string {
	if (startMs === null || message.at === undefined) {
		return `L${message.lap}`;
	}

	return `${Math.max(0, Math.ceil((Date.parse(message.at) - startMs) / 60_000))}m`;
}

/**
 * Race control can repeat a message on the same lap. The list is newest first, so the older copies
 * below are counted: a new copy never takes an old one's key.
 */
function messageKey(messages: readonly RaceControlMessage[], index: number): string {
	const message = messages[index];

	if (!message) {
		return String(index);
	}

	const repeat = messages
		.slice(index + 1)
		.filter((other) => other.lap === message.lap && other.message === message.message).length;

	return `${message.lap}-${message.message}-${repeat}`;
}

/** Yellow and double-yellow marshal sectors painted on the circuit, with the messages that raised them. */
export function FlagMapTile() {
	const track = useTrackData();
	const fill = useTileFill();

	return (
		<Panel aria-label="Flag map" className={cn('min-h-0', fill && 'h-full')} data-testid="flag-map">
			{track.status === 'ready' ? (
				<FlagMapBody track={track} />
			) : (
				<>
					<PanelHeader title="Flag map" />
					<MapPending data={track} />
				</>
			)}
		</Panel>
	);
}

function FlagMapBody({ track }: { track: TrackReady }) {
	const { race, snapshot, live } = useRace();

	const startMs =
		isTimedSession(race.session.type) && race.startedAt ? Date.parse(race.startedAt) : null;

	const places = usePlaces(track);
	const fill = useTileFill();
	const now = usePlacesNow(places, READ_EVERY_MS);

	const count = React.useMemo(
		() => marshalSectorCount(race.raceControl, track.outline.lengthM),
		[race.raceControl, track.outline.lengthM]
	);

	// Live shows what race control has said; a replay, what it had said by the moment drawn.
	const time = now?.time ?? null;

	const said = React.useMemo(() => {
		if (live.following || time === null) {
			return snapshot.raceControl;
		}

		const until = new Date(time).toISOString();

		return race.raceControl.filter((message) =>
			message.at === undefined ? message.lap <= snapshot.currentLap : message.at <= until
		);
	}, [live.following, time, race.raceControl, snapshot]);

	const flags = React.useMemo(() => sectorFlags(said), [said]);

	const earlier = said
		.filter((message) => flagOf(message) !== null)
		.slice(-EARLIER_SHOWN - flags.length)
		.toReversed();

	const overlays = React.useCallback(
		(theme: MapTheme): Overlay[] =>
			flags.map((flag) => ({
				...marshalSpan(flag.sector, count, track.outline.lengthM),
				colour: theme.flag,
				width: flag.level === 'double' ? 2.2 : 1.5
			})),
		[flags, count, track.outline.lengthM]
	);

	return (
		<>
			<PanelHeader title="Flag map">
				<TrackStatusBadge status={snapshot.trackStatus} />
			</PanelHeader>
			<div
				className={cn(
					'flex flex-col @3xl:flex-row',
					fill ? 'min-h-48 flex-1' : '@3xl:aspect-[16/9]'
				)}
			>
				<div
					className={cn(
						'flex',
						fill ? 'min-h-40 flex-1' : 'aspect-[4/3] @3xl:aspect-auto @3xl:flex-1'
					)}
				>
					<MapCanvas
						track={track}
						places={places}
						label={`Flag map of ${track.outline.name}: ${flags.length === 0 ? 'no sector flags out' : flags.map((flag) => `${LEVEL_LABEL[flag.level]} in sector ${flag.sector}`).join(', ')}`}
						camera="full"
						overlays={overlays}
					/>
				</div>
				<section
					aria-label="Flags"
					className="flex shrink-0 flex-col border-t @3xl:w-72 @3xl:border-t-0 @3xl:border-l"
					data-testid="flag-list"
				>
					<h3 className="type-label px-4 pt-2.5">Out now</h3>
					{flags.length === 0 ? (
						<p className="text-muted-foreground px-4 py-2 text-sm">No sector flags.</p>
					) : (
						<ol className="flex flex-col">
							{flags.map((flag) => (
								<FlagRow key={flag.sector} flag={flag} stamp={when(flag.message, startMs)} />
							))}
						</ol>
					)}
					{earlier.length > 0 ? (
						<>
							<h3 className="type-label border-t px-4 pt-2.5">Messages</h3>
							<ol className="flex flex-col pb-1">
								{earlier.map((message, index) => (
									<li
										key={messageKey(earlier, index)}
										className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2 px-4 py-1"
									>
										<span className="text-muted-foreground font-mono text-xs leading-5">
											{when(message, startMs)}
										</span>
										<span className="text-xs leading-5">
											{message.message.toLowerCase().replace(/^\w/, (first) => first.toUpperCase())}
										</span>
									</li>
								))}
							</ol>
						</>
					) : null}
				</section>
			</div>
			<MapNote places={places} now={now}>
				<span>
					Marshal sectors are placed by distance from the line; the feed does not say where each one
					is.
				</span>
			</MapNote>
		</>
	);
}

function FlagRow({ flag, stamp }: { flag: SectorFlag; stamp: string }) {
	return (
		<li className="flex items-start gap-3 border-b px-4 py-2 last:border-b-0">
			<span className="type-label bg-flag text-background mt-0.5 shrink-0 px-1 font-bold">
				{flag.level === 'double' ? 'YY' : 'Y'}
			</span>
			<span className="flex min-w-0 flex-col">
				<span className="text-sm font-medium">
					{LEVEL_LABEL[flag.level]} in sector {flag.sector}
				</span>
				<span className="text-muted-foreground font-mono text-xs">since {stamp}</span>
			</span>
		</li>
	);
}
