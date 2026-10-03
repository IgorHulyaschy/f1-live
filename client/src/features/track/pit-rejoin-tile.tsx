import { miniSectorAt } from '@f1-live/shared';
import * as React from 'react';

import { Digits } from '@/components/console/digits';
import { EmptyNote } from '@/components/console/empty-note';
import { Panel, PanelHeader } from '@/components/console/panel';
import { TeamStripe } from '@/components/driver-tag';
import { ProGate } from '@/components/pro-gate';
import { RaceOnly } from '@/components/race-only';
import { useRace } from '@/data/race-context';
import { pitLossOf } from '@/insights/pit-window';
import { isTimedSession } from '@/insights/qualifying';
import { cn } from '@/lib/utils';

import { useTileFill } from '../dashboard/tile-fill';
import { typicalLap } from './estimate';
import { type CarLook, type ExtraDraw, MapCanvas } from './map-canvas';
import { MapNote, MapPending, useMapBodyClass, usePlacesNow } from './map-parts';
import { type Rejoin, rejoinAmong } from './rejoin';
import { toScreen } from './track-draw';
import { type PlacesSampler, type TrackReady, usePlaces, useTrackData } from './use-track';

/** A car within this of the rejoin point means coming out in traffic. */
const TRAFFIC_MS = 1500;

/** The prediction is read again at least this often, and each time the car starts a mini sector. */
const READ_EVERY_MS = 400;

type Prediction = Rejoin & {
	/** The followed car's place in the order on the road now. */
	from: number;
	ghostProgress: number;
	lapMs: number;
};

/**
 * Where the followed car would come out if it boxed now: where it was one pit loss ago is where
 * the field will be relative to it after the stop. Read each mini sector, as the timing screens
 * update.
 */
function usePrediction(
	places: PlacesSampler,
	track: TrackReady,
	lossMs: number,
	lapMs: number
): Prediction | null {
	const { followedDriver } = useRace();
	const now = usePlacesNow(places, READ_EVERY_MS);
	const subject = now?.cars.find((car) => car.driverNumber === followedDriver);

	const miniSector =
		subject?.distanceM === null || !subject ? null : miniSectorAt(track.outline, subject.distanceM);

	const key = `${followedDriver}/${miniSector ?? 'pit'}/${lossMs}/${subject ? Math.floor(subject.progress) : ''}`;
	const [prediction, setPrediction] = React.useState<Prediction | null>(null);
	const readFor = React.useRef<string | null>(null);
	const { placeAt } = places;

	// The ghost moves smoothly on the map; the words beside it are read once a mini sector, and
	// again while the moment the ghost needs is still loading.
	React.useEffect(() => {
		if (!now || (readFor.current === key && prediction !== null)) {
			return;
		}

		const ghost = placeAt(followedDriver, now.time - lossMs);
		const from = now.cars.findIndex((car) => car.driverNumber === followedDriver) + 1;

		readFor.current = key;
		setPrediction(
			ghost && from > 0
				? {
						...rejoinAmong(now.cars, followedDriver, ghost.progress),
						from,
						ghostProgress: ghost.progress,
						lapMs
					}
				: null
		);
	}, [now, key, prediction, placeAt, followedDriver, lossMs, lapMs]);

	return prediction;
}

/** Seconds between two places on the road, from how far apart they are and the pace of a lap. */
function secondsApart(prediction: Prediction, progress: number): number {
	return (Math.abs(progress - prediction.ghostProgress) * prediction.lapMs) / 1000;
}

/** The pit stop prediction on the circuit: a ghost of the followed car where it would rejoin. */
export function PitRejoinTile() {
	const track = useTrackData();
	const fill = useTileFill();
	const { snapshot, followedDriver } = useRace();
	const code = snapshot.drivers.find((driver) => driver.number === followedDriver)?.code;

	return (
		<Panel
			aria-label="Pit rejoin"
			className={cn('min-h-0', fill && 'h-full')}
			data-testid="pit-rejoin"
		>
			<PanelHeader title="Pit rejoin" meta={code} />
			{isTimedSession(snapshot.session.type) ? (
				// A gated tile: hatched, with the line that says why.
				<div className="relative flex min-h-24 flex-1 items-start p-4">
					<span aria-hidden className="hatch text-foreground/10 absolute inset-0" />
					<div className="bg-panel relative px-2 py-1">
						<RaceOnly what="Pit rejoin">{null}</RaceOnly>
					</div>
				</div>
			) : (
				<ProGate
					feature="Pit rejoin"
					teaser={`Where ${code ?? 'your driver'} would come out if they boxed now, drawn among the cars on the circuit.`}
				>
					{track.status === 'ready' ? <PitRejoinBody track={track} /> : <MapPending data={track} />}
				</ProGate>
			)}
		</Panel>
	);
}

function PitRejoinBody({ track }: { track: TrackReady }) {
	const { race, snapshot, followedDriver } = useRace();
	const places = usePlaces(track);
	const bodyClass = useMapBodyClass();

	const lapMs = React.useMemo(() => typicalLap(snapshot, track.outline), [snapshot, track.outline]);

	// The stops made by the moment on screen: a replay must not learn from stops still to come.
	const loss = React.useMemo(() => pitLossOf(snapshot), [snapshot]);

	const neutralised = snapshot.trackStatus === 'vsc' || snapshot.trackStatus === 'safety_car';
	const lossMs = neutralised ? loss.neutralisedMs : loss.greenMs;
	const prediction = usePrediction(places, track, lossMs, lapMs);
	const drivers = new Map(race.drivers.map((driver) => [driver.number, driver]));
	const followed = drivers.get(followedDriver);
	// The neighbours change once a mini sector; their numbers say when.
	const neighbours = `${prediction?.ahead?.driverNumber ?? ''},${prediction?.behind?.driverNumber ?? ''}`;

	const look = React.useCallback<CarLook>(
		(driver) => ({ label: driver.code, emphasis: neighbours.split(',').includes(driver.number) }),
		[neighbours]
	);

	// The ghost: where the car would be after its stop, drawn dashed with the place it would hold.
	const extra = React.useCallback<ExtraDraw>(
		({ ctx, rem, theme }, view, _cars, time) => {
			const ghost = places.placeAt(followedDriver, time - lossMs);

			if (!ghost || !followed) {
				return;
			}

			const unit = rem / 16;
			const [x, y] = toScreen(view, [ghost.x, ghost.y]);
			const colour = `#${followed.teamColour}`;
			const label = prediction ? `BOX P${prediction.position}` : 'BOX';

			ctx.setLineDash([3 * unit, 2 * unit]);
			ctx.lineWidth = 2 * unit;
			ctx.strokeStyle = colour;
			ctx.beginPath();
			ctx.arc(x, y, 8 * unit, 0, Math.PI * 2);
			ctx.stroke();
			ctx.setLineDash([]);
			ctx.font = `800 ${Math.round(10 * unit)}px "Martian Mono Variable", ui-monospace, monospace`;

			const width = ctx.measureText(label).width + 10 * unit;
			const height = 15 * unit;
			// Beside the ghost, on whichever side keeps the label inside the map.
			const left = x + 12 * unit + width > view.width ? x - 12 * unit - width : x + 12 * unit;
			const top = Math.max(2, y - 20 * unit);

			ctx.fillStyle = theme.panel;
			ctx.fillRect(left, top, width, height);
			ctx.setLineDash([3 * unit, 2 * unit]);
			ctx.strokeStyle = colour;
			ctx.lineWidth = 1.5 * unit;
			ctx.strokeRect(left, top, width, height);
			ctx.setLineDash([]);
			ctx.fillStyle = theme.foreground;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(label, left + width / 2, top + height / 2 + 0.5);
		},
		[places, followedDriver, lossMs, followed, prediction]
	);

	if (!followed) {
		return <EmptyNote />;
	}

	const traffic =
		prediction !== null &&
		[prediction.ahead, prediction.behind].some(
			(car) => car !== null && secondsApart(prediction, car.progress) * 1000 < TRAFFIC_MS
		);

	return (
		<>
			<div className={cn('flex min-h-0 flex-col', bodyClass)}>
				<MapCanvas
					track={track}
					places={places}
					label={`Pit rejoin: where ${followed.code} would come out if they boxed now`}
					camera="full"
					look={look}
					extra={extra}
				/>
			</div>
			{prediction ? (
				<div
					className="grid grid-cols-2 border-t @lg:grid-cols-4 @lg:divide-x"
					data-testid="rejoin-reading"
				>
					<div className="flex flex-col gap-1 px-4 py-2.5">
						<span className="type-label">Box now</span>
						<span className="type-wide text-lg leading-none font-black italic">
							P{prediction.position}
						</span>
						<span className="type-label">from P{prediction.from}</span>
					</div>
					{(['ahead', 'behind'] as const).map((side) => {
						const car = prediction[side];
						const driver = car ? drivers.get(car.driverNumber) : undefined;

						return (
							<div key={side} className="flex flex-col gap-1 px-4 py-2.5">
								<span className="type-label">{side === 'ahead' ? 'Ahead' : 'Behind'}</span>
								{car && driver ? (
									<span className="flex items-center gap-2">
										<TeamStripe driver={driver} />
										<span className="type-wide text-sm font-bold">{driver.code}</span>
										<Digits
											value={`${side === 'ahead' ? '−' : '+'}${secondsApart(prediction, car.progress).toFixed(1)}`}
											className="text-sm"
										/>
									</span>
								) : (
									<span className="text-sm">Clear</span>
								)}
							</div>
						);
					})}
					<div className="flex flex-col gap-1 px-4 py-2.5">
						<span className="type-label">Air</span>
						<span className={traffic ? 'text-flag-ink text-sm font-bold' : 'text-sm'}>
							{traffic ? 'Traffic' : 'Free'}
						</span>
					</div>
				</div>
			) : null}
			<MapNote places={places}>
				<span data-testid="pit-loss">
					{loss.stops > 0
						? `A stop costs ${(lossMs / 1000).toFixed(1)}s here${neutralised ? ' under the VSC or Safety Car' : ''}: measured from ${loss.stops} ${loss.stops === 1 ? 'stop' : 'stops'} this session.`
						: `Assumes a typical ${(lossMs / 1000).toFixed(1)}s stop${neutralised ? ' under the VSC or Safety Car' : ''} until this session’s stops measure one here.`}
				</span>
			</MapNote>
		</>
	);
}
