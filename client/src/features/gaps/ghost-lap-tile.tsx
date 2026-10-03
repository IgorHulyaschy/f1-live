import { type Driver, pointOnTrack, type TrackOutline } from '@f1-live/shared';
import { PauseIcon, PlayIcon, RotateCcwIcon } from 'lucide-react';
import * as React from 'react';

import { Key, KeyGroup } from '@/components/console/keys';
import { Panel, PanelHeader } from '@/components/console/panel';
import { ProGate } from '@/components/pro-gate';
import { useRace } from '@/data/race-context';
import { ReplayClock } from '@/data/replay-clock';
import { useSessionTelemetry } from '@/data/telemetry-context';
import { cn } from '@/lib/utils';

import { useTileFill } from '../dashboard/tile-fill';
import { type CarLook, MapCanvas } from '../track/map-canvas';
import { useMapBodyClass, usePlacesNow } from '../track/map-parts';
import type { CarPlace } from '../track/track-frames';
import type { PlacesSampler, TrackReady } from '../track/use-track';
import { ghostDistance, ghostOrder, ghostTrack, type GhostTrack } from './ghost-lap';
import { defaultGapView, type GapView, gapViews, useGapFields } from './use-gap-field';

const RATES = [1, 4] as const;

type Rate = (typeof RATES)[number];

/** How often the order beside the map is read again while the ghosts run. */
const ORDER_EVERY_MS = 250;

const VIEW_LABEL: Record<Exclude<GapView, 'race'>, string> = {
	q1: 'Q1',
	q2: 'Q2',
	q3: 'Q3',
	best: 'Best'
};

function placeOf(track: GhostTrack, outline: TrackOutline, ms: number): CarPlace {
	const metres = ghostDistance(track, ms);
	const point = pointOnTrack(outline, metres);

	return {
		driverNumber: track.driverNumber,
		x: point.x,
		y: point.y,
		headingRad: point.headingRad,
		distanceM: metres,
		progress: metres / outline.lengthM,
		state: 'track'
	};
}

/** The ghosts as the maps read cars: every best lap from the same line, on the ghost clock. */
function ghostPlaces(
	tracks: readonly GhostTrack[],
	outline: TrackOutline,
	clock: ReplayClock,
	moving: boolean
): PlacesSampler {
	return {
		sample: (perf) => {
			const time = clock.now(perf);

			return {
				time,
				cars: tracks
					.map((track) => placeOf(track, outline, time))
					.toSorted((a, b) => b.progress - a.progress),
				source: 'positions',
				waiting: false
			};
		},
		source: 'positions',
		live: false,
		positionsLive: null,
		moving,
		subscribe: clock.subscribe,
		placeAt: (driverNumber, time) => {
			const track = tracks.find((candidate) => candidate.driverNumber === driverNumber);

			return track ? placeOf(track, outline, time) : null;
		}
	};
}

/**
 * Every driver's best lap run from the same line at once, so the gaps grow and shrink corner by
 * corner. Play, pause and scrub; the order beside the map gives each car's metres behind.
 * Embeddable: it needs the laps, the circuit and the session they came from.
 */
export function GhostLap({
	tracks,
	outline,
	sessionKey,
	drivers,
	className
}: {
	tracks: readonly GhostTrack[];
	outline: TrackOutline;
	sessionKey: string;
	drivers: ReadonlyMap<string, Driver>;
	className?: string;
}) {
	const [clock] = React.useState(() => new ReplayClock());
	const [playing, setPlaying] = React.useState(false);
	const [rate, setRate] = React.useState<Rate>(4);
	const endMs = Math.max(0, ...tracks.map((track) => track.lapMs));

	const track = React.useMemo(
		(): TrackReady => ({
			status: 'ready',
			sessionKey,
			outline,
			lane: null,
			telemetry: null,
			replay: null
		}),
		[sessionKey, outline]
	);

	const places = React.useMemo(
		() => ghostPlaces(tracks, outline, clock, playing),
		[tracks, outline, clock, playing]
	);

	const now = usePlacesNow(places, ORDER_EVERY_MS);
	const time = now?.time ?? 0;

	// The clock runs while playing and stops at the end of the slowest lap.
	React.useEffect(() => {
		clock.set(clock.now(), playing ? rate : 0);

		if (!playing) {
			return;
		}

		const timer = window.setTimeout(
			() => {
				clock.set(endMs, 0);
				setPlaying(false);
			},
			Math.max(0, (endMs - clock.now()) / rate)
		);

		return () => window.clearTimeout(timer);
	}, [clock, playing, rate, endMs]);

	const look = React.useCallback<CarLook>((driver) => ({ label: driver.code }), []);
	const order = ghostOrder(tracks, time).slice(0, 10);

	return (
		<div className={cn('flex min-h-0 flex-col', className)}>
			<div
				className="flex flex-wrap items-center gap-2 border-b px-4 py-2"
				data-testid="ghost-controls"
			>
				<Key
					aria-label={playing ? 'Pause the ghost lap' : 'Play the ghost lap'}
					pressed={playing}
					onClick={() => {
						if (!playing && clock.now() >= endMs) {
							clock.set(0, 0);
						}

						setPlaying(!playing);
					}}
				>
					{playing ? <PauseIcon /> : <PlayIcon />}
				</Key>
				<Key
					aria-label="Back to the line"
					onClick={() => {
						setPlaying(false);
						clock.set(0, 0);
					}}
				>
					<RotateCcwIcon />
				</Key>
				<KeyGroup
					label="Ghost speed"
					options={RATES.map((value) => ({ value: String(value), label: `${value}×` }))}
					value={String(rate)}
					onChange={(value) => setRate(value === '1' ? 1 : 4)}
				/>
				<input
					type="range"
					min={0}
					max={Math.round(endMs)}
					step={50}
					value={Math.round(Math.min(time, endMs))}
					onChange={(event) => clock.set(Number(event.target.value), playing ? rate : 0)}
					aria-label="Time into the lap"
					className="accent-foreground min-w-32 flex-1"
					data-testid="ghost-scrub"
				/>
				<span className="font-mono text-xs tabular-nums" data-testid="ghost-time">
					{(Math.min(time, endMs) / 1000).toFixed(1)}s
				</span>
			</div>
			<div className="flex min-h-0 flex-1">
				<MapCanvas
					track={track}
					places={places}
					label={`Ghost lap: ${tracks.length} best laps run together on ${outline.name}`}
					camera="full"
					look={look}
				/>
				<ol
					className="sr-only w-44 shrink-0 flex-col border-l py-1 @xl:not-sr-only @xl:flex"
					aria-label="Order on the ghost lap"
					data-testid="ghost-order"
				>
					{order.map((car, index) => {
						const driver = drivers.get(car.driverNumber);

						return (
							<li key={car.driverNumber} className="flex items-center gap-2 px-3 py-0.5 text-xs">
								<span className="text-muted-foreground w-4 font-mono">{index + 1}</span>
								<span
									aria-hidden
									className="bg-team h-3 w-0.75"
									style={{ '--team': `#${driver?.teamColour ?? '888888'}` }}
								/>
								<span className="type-wide font-bold">{driver?.code ?? car.driverNumber}</span>
								<span className="text-muted-foreground ml-auto font-mono tabular-nums">
									{index === 0 ? '' : `${Math.round(car.behindM)} m`}
								</span>
							</li>
						);
					})}
				</ol>
			</div>
		</div>
	);
}

/** The ghost lap of the session on screen: Pro. */
export function GhostLapTile() {
	const fill = useTileFill();

	return (
		<Panel
			aria-label="Ghost lap"
			className={cn('flex min-h-0 flex-col', fill && 'h-full')}
			data-testid="ghost-lap"
		>
			<ProGate
				feature="Ghost lap"
				teaser="Every driver's best lap from the same line, so the gaps grow and shrink corner by corner."
			>
				<GhostLapBody />
			</ProGate>
		</Panel>
	);
}

function GhostLapBody() {
	const { race, snapshot, sessionKey } = useRace();
	const session = useSessionTelemetry();
	const views = gapViews(snapshot).flatMap((view) => (view === 'race' ? [] : [view]));
	const [chosen, setChosen] = React.useState<Exclude<GapView, 'race'> | null>(null);
	const fallback = defaultGapView(views);
	const view = chosen && views.includes(chosen) ? chosen : fallback === 'race' ? 'best' : fallback;
	const fields = useGapFields(view);
	const bodyClass = useMapBodyClass();

	const drivers = React.useMemo(
		() => new Map(race.drivers.map((driver) => [driver.number, driver])),
		[race.drivers]
	);

	const tracks = React.useMemo(
		() =>
			fields.laps.slice(0, 10).flatMap((lap) => {
				const telemetry = fields.telemetry.get(lap.driverNumber);

				return telemetry ? [ghostTrack(telemetry, lap.lapTimeMs)] : [];
			}),
		[fields.laps, fields.telemetry]
	);

	const outline = session.status === 'ready' ? session.value.circuit : null;

	return (
		<>
			<PanelHeader title="Ghost lap" meta={VIEW_LABEL[view]}>
				{views.length > 1 ? (
					<KeyGroup
						label="Laps"
						options={views.map((value) => ({ value, label: VIEW_LABEL[value] }))}
						value={view}
						onChange={setChosen}
					/>
				) : null}
			</PanelHeader>
			{outline && tracks.length > 1 ? (
				<GhostLap
					tracks={tracks}
					outline={outline}
					sessionKey={sessionKey}
					drivers={drivers}
					className={bodyClass}
				/>
			) : (
				<p className="text-muted-foreground px-4 py-6 text-sm" data-testid="ghost-empty">
					{session.status === 'loading' || fields.loading
						? 'Reading the laps…'
						: 'The ghost lap needs the car telemetry of at least two best laps; this session has none yet.'}
				</p>
			)}
			<p className="text-muted-foreground border-t px-4 py-2 text-xs">
				The ten fastest laps of {VIEW_LABEL[view] === 'Best' ? 'the session' : VIEW_LABEL[view]},
				each from its own telemetry, run on one clock from the line.
			</p>
		</>
	);
}
