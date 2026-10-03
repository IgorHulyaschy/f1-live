import { type LapIndex, type LapTelemetry, pointOnTrack } from '@f1-live/shared';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import * as React from 'react';

import { Field, Panel, PanelHeader } from '@/components/console/panel';
import { Key, KeyGroup } from '@/components/console/keys';
import { ProGate } from '@/components/pro-gate';
import { Digits } from '@/components/console/digits';
import { useRace } from '@/data/race-context';
import { stepTime } from '@/data/session-time';
import { formatLapTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import { useTileFill } from '../dashboard/tile-fill';
import { type CarLook, type ExtraDraw, MapCanvas } from './map-canvas';
import { MapPending, useMapBodyClass } from './map-parts';
import { type Channel, channelAlong, channelRange, speedMarks } from './speed';
import { type MapTheme, type Overlay, toScreen } from './track-draw';
import { type TrackReady, usePlaces, useTrackData } from './use-track';

const CHANNEL_OPTIONS = [
	{ value: 'speed', label: 'Speed' },
	{ value: 'gear', label: 'Gear' },
	{ value: 'throttle', label: 'Throttle' },
	{ value: 'brake', label: 'Brake' }
] as const;

const CHANNEL_UNIT: Record<Channel, (value: number) => string> = {
	speed: (value) => `${Math.round(value)} km/h`,
	gear: (value) => `Gear ${Math.round(value)}`,
	throttle: (value) => `${Math.round(value)}%`,
	brake: (value) => (value > 0 ? 'Braking' : 'Off the brakes')
};

/** The lap is painted in stretches this long. */
const STRETCH_M = 12;

/** The faintest stretch, so the slowest part of the lap still reads as track. */
const FAINTEST = 0.12;

const SCALE_STEPS = [
	'opacity-15',
	'opacity-35',
	'opacity-55',
	'opacity-75',
	'opacity-100'
] as const;

/** No other car is drawn: the map is about one lap. */
const NO_CARS: CarLook = () => null;

type LapEntry = LapIndex['laps'][number];

type Loaded = { key: string; lap: LapTelemetry | null; failed: boolean };

type ChosenLap = {
	laps: readonly LapEntry[];
	entry: LapEntry | null;
	lap: LapTelemetry | null;
	status: 'loading' | 'ready' | 'none' | 'error';
};

/** The followed driver's laps with telemetry done by the moment on screen, and the one chosen. */
function useLap(track: TrackReady, choice: number | null): ChosenLap {
	const { telemetry, followedDriver, timeline, lap: step } = useRace();
	const lapsPath = track.telemetry?.hasCarData ? track.telemetry.laps : null;
	const until = timeline ? stepTime(timeline, step) : 0;

	const [index, setIndex] = React.useState<{
		key: string;
		index: LapIndex | null;
		failed: boolean;
	} | null>(null);

	const [loaded, setLoaded] = React.useState<Loaded | null>(null);

	React.useEffect(() => {
		if (!lapsPath) {
			return;
		}

		let cancelled = false;

		async function load(path: string) {
			try {
				const next = await telemetry.loadLapIndex(track.sessionKey, path);

				if (!cancelled) {
					setIndex({ key: track.sessionKey, index: next, failed: false });
				}
			} catch {
				if (!cancelled) {
					setIndex({ key: track.sessionKey, index: null, failed: true });
				}
			}
		}

		void load(lapsPath);

		return () => {
			cancelled = true;
		};
	}, [lapsPath, telemetry, track.sessionKey]);

	const laps = React.useMemo(
		() =>
			(index?.key === track.sessionKey ? (index.index?.laps ?? []) : []).filter(
				(entry) =>
					entry.driverNumber === followedDriver &&
					!entry.partial &&
					Date.parse(entry.startedAt) + entry.lapTimeMs <= until
			),
		[index, track.sessionKey, followedDriver, until]
	);

	const fastest = laps
		.filter((entry) => !entry.pitIn && !entry.pitOut)
		.reduce<LapEntry | null>(
			(best, entry) => (!best || entry.lapTimeMs < best.lapTimeMs ? entry : best),
			null
		);

	const entry =
		(choice === null ? fastest : laps.find((candidate) => candidate.lap === choice)) ?? fastest;

	const file = entry?.file ?? null;

	React.useEffect(() => {
		if (!file) {
			return;
		}

		let cancelled = false;

		async function load(path: string) {
			let next: Loaded;

			try {
				next = { key: path, lap: await telemetry.loadLap(track.sessionKey, path), failed: false };
			} catch {
				next = { key: path, lap: null, failed: true };
			}

			if (!cancelled) {
				setLoaded(next);
			}
		}

		void load(file);

		return () => {
			cancelled = true;
		};
	}, [file, telemetry, track.sessionKey]);

	if (!lapsPath) {
		return { laps, entry: null, lap: null, status: 'none' };
	}

	if (index?.failed || (loaded?.key === file && loaded.failed)) {
		return { laps, entry, lap: null, status: 'error' };
	}

	const lap = loaded?.lap ?? null;

	return { laps, entry, lap, status: index && (!file || lap) ? 'ready' : 'loading' };
}

/** Speed, gear, throttle or braking painted round the circuit for one lap of the followed driver. */
export function SpeedMapTile({
	channel: initialChannel = 'speed',
	onChannelChange
}: {
	channel?: Channel;
	onChannelChange?: (channel: Channel) => void;
}) {
	const track = useTrackData();
	const fill = useTileFill();
	const [channel, setLocalChannel] = React.useState<Channel>(initialChannel);

	const setChannel = (next: Channel) => {
		setLocalChannel(next);
		onChannelChange?.(next);
	};

	return (
		<Panel
			aria-label="Speed on the circuit"
			className={cn('min-h-0', fill && 'h-full')}
			data-testid="speed-map"
		>
			<PanelHeader title="Speed map">
				<KeyGroup label="Channel" options={CHANNEL_OPTIONS} value={channel} onChange={setChannel} />
			</PanelHeader>
			<ProGate
				feature="Speed and gear on the circuit"
				teaser="Any lap painted by speed, gear, throttle or braking, with the top speed and the slowest corners marked."
			>
				{track.status === 'ready' ? (
					<SpeedMapBody track={track} channel={channel} />
				) : (
					<MapPending data={track} />
				)}
			</ProGate>
		</Panel>
	);
}

function SpeedMapBody({ track, channel }: { track: TrackReady; channel: Channel }) {
	const { race, followedDriver, snapshot } = useRace();
	const places = usePlaces(track);
	const bodyClass = useMapBodyClass();
	const [choice, setChoice] = React.useState<number | null>(null);
	const { laps, entry, lap, status } = useLap(track, choice);
	const driver = race.drivers.find((candidate) => candidate.number === followedDriver);

	const stretches = React.useMemo(
		() => (lap ? channelAlong(lap, channel, STRETCH_M) : []),
		[lap, channel]
	);

	const range = React.useMemo(() => channelRange(channel, stretches), [channel, stretches]);

	const marks = React.useMemo(
		() => (lap && channel === 'speed' ? speedMarks(lap, 3) : []),
		[lap, channel]
	);

	const trap =
		snapshot.personalBests?.find((best) => best.driverNumber === followedDriver)?.topSpeedsKph
			.speedTrap ?? null;

	const overlays = React.useCallback(
		(theme: MapTheme): Overlay[] =>
			stretches.flatMap((stretch): Overlay[] => {
				const share =
					range.max > range.min ? (stretch.value - range.min) / (range.max - range.min) : 1;

				return channel === 'brake' && stretch.value <= 0
					? []
					: [
							{
								fromM: stretch.fromM,
								toM: stretch.toM,
								colour: theme.focus,
								alpha: FAINTEST + (1 - FAINTEST) * share,
								width: 1.2
							}
						];
			}),
		[stretches, range, channel]
	);

	// The top speed and the slowest corners, printed beside the track.
	const extra = React.useCallback<ExtraDraw>(
		({ ctx, rem, theme }, view) => {
			const unit = rem / 16;

			ctx.font = `700 ${Math.round(10 * unit)}px "Martian Mono Variable", ui-monospace, monospace`;
			ctx.textBaseline = 'middle';
			ctx.textAlign = 'center';

			for (const mark of marks) {
				const point = pointOnTrack(track.outline, mark.distanceM);
				const [x, y] = toScreen(view, [point.x, point.y]);

				const text =
					mark.kind === 'top' ? `TOP ${Math.round(mark.speed)}` : String(Math.round(mark.speed));

				ctx.beginPath();
				ctx.arc(x, y, 3 * unit, 0, Math.PI * 2);
				ctx.fillStyle = theme.foreground;
				ctx.fill();
				ctx.lineWidth = 4 * unit;
				ctx.strokeStyle = theme.panel;
				ctx.strokeText(text, x, y - 12 * unit);
				ctx.fillStyle = mark.kind === 'top' ? theme.foreground : theme.muted;
				ctx.fillText(text, x, y - 12 * unit);
			}
		},
		[marks, track.outline]
	);

	const position = entry ? laps.indexOf(entry) : -1;

	if (status === 'none' || status === 'error') {
		return (
			<p className="text-muted-foreground px-4 py-6 text-sm" data-testid="speed-map-empty">
				{status === 'none'
					? 'This session has no car data to paint a lap with.'
					: 'The lap could not be loaded.'}
			</p>
		);
	}

	return (
		<>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2">
				<span className="type-wide text-sm font-bold">{driver?.code ?? '-'}</span>
				<div className="flex">
					<Key
						aria-label="Lap before"
						disabled={position <= 0}
						onClick={() => setChoice(laps[position - 1]?.lap ?? null)}
					>
						<ChevronLeftIcon />
					</Key>
					<Key pressed={choice === null} onClick={() => setChoice(null)} className="-ml-px">
						{entry ? `Lap ${entry.lap}` : 'No lap'}
					</Key>
					<Key
						aria-label="Lap after"
						disabled={position < 0 || position >= laps.length - 1}
						onClick={() => setChoice(laps[position + 1]?.lap ?? null)}
						className="-ml-px"
					>
						<ChevronRightIcon />
					</Key>
				</div>
				{choice === null && entry ? <span className="type-label">Fastest so far</span> : null}
			</div>
			<div className={cn('flex min-h-0 flex-col', bodyClass)}>
				{status === 'loading' && !lap ? (
					<p className="text-muted-foreground p-4 text-sm" aria-busy>
						Loading the lap…
					</p>
				) : (
					<MapCanvas
						track={track}
						places={places}
						label={`${driver?.code ?? 'Driver'}'s lap ${entry?.lap ?? ''} painted by ${channel} on ${track.outline.name}`}
						camera="full"
						overlays={overlays}
						look={NO_CARS}
						extra={extra}
					/>
				)}
			</div>
			<div
				className="flex flex-wrap items-end gap-x-6 gap-y-2 border-t px-4 py-2.5"
				data-testid="speed-map-legend"
			>
				<div className="flex flex-col gap-1">
					<span className="type-label">Scale</span>
					<span className="flex items-center gap-2 font-mono text-xs">
						{channel === 'brake' || stretches.length === 0 ? null : (
							<span>{CHANNEL_UNIT[channel](range.min)}</span>
						)}
						<span className="flex" aria-hidden>
							{SCALE_STEPS.map((step) => (
								<span
									key={step}
									className={cn(
										'bg-focus h-2 w-5',
										channel === 'brake' && step !== 'opacity-100' ? 'hidden' : step
									)}
								/>
							))}
						</span>
						{stretches.length === 0 ? null : <span>{CHANNEL_UNIT[channel](range.max)}</span>}
					</span>
				</div>
				{entry ? (
					<Field label="Lap time">
						<Digits value={formatLapTime(entry.lapTimeMs)} />
					</Field>
				) : null}
				{marks[0] ? <Field label="Top speed">{`${Math.round(marks[0].speed)} km/h`}</Field> : null}
				{trap !== null ? <Field label="Trap best">{`${Math.round(trap)} km/h`}</Field> : null}
			</div>
		</>
	);
}
