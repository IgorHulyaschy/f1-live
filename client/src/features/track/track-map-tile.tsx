import type { Driver, Point } from '@f1-live/shared';
import * as React from 'react';

import { Key, KeyGroup } from '@/components/console/keys';
import { Panel, PanelHeader } from '@/components/console/panel';
import { useRace } from '@/data/race-context';
import { hasDrs } from '@/insights/rules';
import type { SectorMark } from '@/insights/standings';
import { cn } from '@/lib/utils';

import { useTileFill } from '../dashboard/tile-fill';
import type { MapCamera, TrackMapSettings } from './settings';
import { drsZones, lapsForZones, type Zone } from './drs-zones';
import { CarOrder, MapNote, MapPending, placesLabel, useMapBodyClass } from './map-parts';
import { TrackCanvas } from './track-canvas';
import {
	drawCars,
	drawCircuit,
	fitView,
	type MapTheme,
	outlineMiddle,
	type Overlay,
	toScreen,
	type View,
	zoomedView
} from './track-draw';
import type { CarPlace } from './track-frames';
import { type PlacesSampler, type TrackReady, usePlaces, useTrackData } from './use-track';

const CAMERA_OPTIONS = [
	{ value: 'full', label: 'Circuit' },
	{ value: 'follow', label: 'Follow' }
] as const;

const PAINT_OPTIONS = [
	{ value: 'plain', label: 'Plain' },
	{ value: 'sectors', label: 'Sectors' }
] as const;

/** How much closer the follow camera is than the whole circuit. */
const FOLLOW_ZOOM = 3.2;

/** The follow camera catches up with its car over about this long. */
const CAMERA_EASE_MS = 180;

/** Where a camera looks, in the feed's metres, and how close. */
type CameraAim = { centre: Point; zoom: number };

/** A tap within this of a car picks it. */
const PICK_RADIUS_PX = 16;

/** The DRS zones of the session's circuit, from its lap telemetry; null where they are not known. */
function useDrsZones(track: TrackReady): readonly Zone[] | null {
	const { race, telemetry } = useRace();
	const lapsPath = track.telemetry?.hasCarData ? track.telemetry.laps : null;
	const drs = hasDrs(race.session);
	const [zones, setZones] = React.useState<{ key: string; zones: Zone[] } | null>(null);

	React.useEffect(() => {
		if (!drs || !lapsPath) {
			return;
		}

		let cancelled = false;

		async function load(path: string) {
			const index = await telemetry.loadLapIndex(track.sessionKey, path);

			const laps = await Promise.all(
				lapsForZones(index).map((entry) => telemetry.loadLap(track.sessionKey, entry.file))
			);

			if (!cancelled) {
				setZones({ key: track.sessionKey, zones: drsZones(laps) });
			}
		}

		// Zones are a nicety: a failure leaves the map without them.
		load(lapsPath).catch(() => undefined);

		return () => {
			cancelled = true;
		};
	}, [drs, lapsPath, telemetry, track.sessionKey]);

	return drs && zones?.key === track.sessionKey && zones.zones.length > 0 ? zones.zones : null;
}

const MARK_COLOUR: Record<Exclude<SectorMark, 'none'>, keyof MapTheme> = {
	fastest: 'fastest',
	'personal-best': 'personalBest'
};

/** The followed driver's sectors in colour: the mini sectors of the lap in progress live, else the last lap's sectors. */
function useSectorPaint(
	track: TrackReady,
	active: boolean
): { overlays: (theme: MapTheme) => Overlay[]; note: string | null } {
	const { snapshot, standings, followedDriver, live } = useRace();

	return React.useMemo(() => {
		const row = standings.find((entry) => entry.driver.number === followedDriver);

		if (!active || !row) {
			return { overlays: () => [], note: null };
		}

		const { miniSectorStartsM, lengthM, sectorBoundariesM } = track.outline;

		const record = live.following
			? snapshot.miniSectors?.find((entry) => entry.driverNumber === followedDriver)
			: undefined;

		if (record) {
			return {
				note: `${row.driver.code}'s mini sectors on lap ${record.lap}`,
				overlays: (theme: MapTheme) =>
					record.marks.flatMap((mark, index): Overlay[] => {
						if (mark === null || mark === 'none') {
							return [];
						}

						const colour =
							mark === 'fastest'
								? theme.fastest
								: mark === 'personal_best'
									? theme.personalBest
									: theme.flag;

						return [
							{
								fromM: miniSectorStartsM[index] ?? 0,
								toM: miniSectorStartsM[index + 1] ?? lengthM,
								colour
							}
						];
					})
			};
		}

		const edges = [0, sectorBoundariesM[0], sectorBoundariesM[1], lengthM];

		return {
			note: row.lastLap ? `${row.driver.code}'s sectors on lap ${row.lastLap.lap}` : null,
			overlays: (theme: MapTheme) =>
				row.sectorMarks.flatMap((mark, index): Overlay[] =>
					mark === 'none'
						? []
						: [
								{
									fromM: edges[index] ?? 0,
									toM: edges[index + 1] ?? lengthM,
									colour: theme[MARK_COLOUR[mark]]
								}
							]
				)
		};
	}, [active, standings, followedDriver, track.outline, live.following, snapshot.miniSectors]);
}

export type CarLook = (driver: Driver, place: CarPlace) => { label: string; emphasis?: boolean };

/**
 * Draws the circuit and the cars, for every map tile: camera, colours and car looks vary, the
 * rest is the same. `focus` keeps a camera on a set of cars; `extra` draws over the cars.
 */
export function MapCanvas({
	track,
	places,
	label,
	overlays,
	zones,
	camera,
	focus,
	look,
	extra,
	marks = true
}: {
	track: TrackReady;
	places: PlacesSampler;
	label: string;
	overlays?: (theme: MapTheme) => Overlay[];
	zones?: readonly Zone[] | null;
	camera: MapCamera | 'battle';
	/** For the battle camera: the cars to keep in view. */
	focus?: readonly string[];
	look?: CarLook;
	extra?: (
		ctx: CanvasRenderingContext2D,
		view: View,
		cars: readonly CarPlace[],
		theme: MapTheme,
		rem: number,
		time: number
	) => void;
	marks?: boolean;
}) {
	const { race, snapshot, followedDriver, setFollowedDriver } = useRace();

	const drivers = React.useMemo(
		() => new Map(race.drivers.map((driver) => [driver.number, driver])),
		[race.drivers]
	);

	const middle = React.useMemo(() => outlineMiddle(track.outline), [track.outline]);
	const eased = React.useRef<CameraAim | null>(null);
	const drawn = React.useRef<{ view: View; cars: readonly CarPlace[] } | null>(null);
	const tint = snapshot.trackStatus;

	const draw = React.useCallback(
		({
			ctx,
			perf,
			width,
			height,
			rem,
			theme,
			reducedMotion,
			elapsed
		}: Parameters<React.ComponentProps<typeof TrackCanvas>['draw']>[0]) => {
			const frame = places.sample(perf);
			// Labels sit outside the track, so the circuit keeps room for them round its edge.
			const base = fitView(track.outline, width, height, 44 * (rem / 16));
			let view = base;

			let settling = false;

			if (camera !== 'full') {
				const watched = camera === 'follow' ? [followedDriver] : (focus ?? [followedDriver]);
				const cars = frame.cars.filter((car) => watched.includes(car.driverNumber));

				const target = cameraTarget(
					base,
					cars,
					camera === 'follow' ? FOLLOW_ZOOM : null,
					width,
					height,
					rem
				);

				if (target) {
					const last = eased.current;

					const share =
						reducedMotion || !last || elapsed === 0 ? 1 : 1 - Math.exp(-elapsed / CAMERA_EASE_MS);

					const next: CameraAim = last
						? {
								centre: [
									last.centre[0] + (target.centre[0] - last.centre[0]) * share,
									last.centre[1] + (target.centre[1] - last.centre[1]) * share
								],
								zoom: last.zoom + (target.zoom - last.zoom) * share
							}
						: target;

					// Still easing towards a car that has stopped: ask for another frame.
					settling =
						Math.hypot(target.centre[0] - next.centre[0], target.centre[1] - next.centre[1]) *
							view.scale *
							next.zoom >
						0.5;
					eased.current = next;
					view = zoomedView(base, next.centre, next.zoom);
				}
			}

			const neutralised = tint === 'vsc' || tint === 'safety_car' || tint === 'yellow';

			const reserved = drawCircuit(ctx, view, track.outline, theme, {
				rem,
				weight: camera === 'full' ? 1 : 1.6,
				overlays: overlays?.(theme) ?? [],
				zones: (zones ?? []).map((zone) => ({ ...zone, colour: theme.foreground })),
				marks,
				tint: tint === 'red' ? theme.danger : neutralised && tint !== 'yellow' ? theme.flag : null
			});

			const styled = frame.cars.flatMap((place) => {
				const driver = drivers.get(place.driverNumber);

				if (!driver) {
					return [];
				}

				const custom = look?.(driver, place);

				return [
					{
						place,
						style: {
							colour: `#${driver.teamColour}`,
							label: custom?.label ?? driver.code,
							followed: driver.number === followedDriver,
							estimated: frame.source === 'estimated',
							emphasis: custom?.emphasis
						}
					}
				];
			});

			// The followed car is drawn last, over the others.
			styled.sort((a, b) => Number(a.style.followed) - Number(b.style.followed));
			drawCars(ctx, view, styled, theme, rem, middle, reserved);
			extra?.(ctx, view, frame.cars, theme, rem, frame.time);
			drawn.current = { view, cars: frame.cars };

			return settling || frame.waiting;
		},
		[
			places,
			track.outline,
			camera,
			focus,
			followedDriver,
			overlays,
			zones,
			marks,
			tint,
			drivers,
			look,
			extra,
			middle
		]
	);

	const pick = (x: number, y: number) => {
		const last = drawn.current;

		if (!last) {
			return;
		}

		let nearest: { driverNumber: string; distance: number } | null = null;

		for (const car of last.cars) {
			const [cx, cy] = toScreen(last.view, [car.x, car.y]);
			const distance = Math.hypot(cx - x, cy - y);

			if (distance < PICK_RADIUS_PX && (!nearest || distance < nearest.distance)) {
				nearest = { driverNumber: car.driverNumber, distance };
			}
		}

		if (nearest) {
			setFollowedDriver(nearest.driverNumber);
		}
	};

	return (
		<TrackCanvas
			draw={draw}
			moving={places.moving}
			subscribe={places.subscribe}
			label={label}
			onPick={pick}
		/>
	);
}

/**
 * Where a camera on `cars` looks: one car at a fixed zoom, or several fitted with room round them.
 * Null with no car in view.
 */
function cameraTarget(
	base: View,
	cars: readonly CarPlace[],
	zoom: number | null,
	width: number,
	height: number,
	rem: number
): CameraAim | null {
	if (cars.length === 0) {
		return null;
	}

	const xs = cars.map((car) => car.x);
	const ys = cars.map((car) => car.y);

	const centre: Point = [
		(Math.min(...xs) + Math.max(...xs)) / 2,
		(Math.min(...ys) + Math.max(...ys)) / 2
	];

	if (zoom !== null) {
		return { centre, zoom };
	}

	// Fit the spread of the cars, measured in the view's turn, with room for labels.
	const turned = cars.map(
		(car) => [car.x * base.cos - car.y * base.sin, car.x * base.sin + car.y * base.cos] as const
	);

	const spanX = Math.max(...turned.map(([x]) => x)) - Math.min(...turned.map(([x]) => x));
	const spanY = Math.max(...turned.map(([, y]) => y)) - Math.min(...turned.map(([, y]) => y));
	const room = 90 * (rem / 16);

	const fit = Math.min(
		(width - room * 2) / Math.max(spanX * base.scale, 1),
		(height - room * 2) / Math.max(spanY * base.scale, 1)
	);

	return { centre, zoom: Math.min(6, Math.max(1.4, fit)) };
}

const NO_SETTINGS: TrackMapSettings = {};

/** Every car on the circuit, from the replay, the live feed, or estimated from timing. */
export function TrackMapTile({
	settings = NO_SETTINGS,
	onSettingsChange
}: {
	settings?: TrackMapSettings;
	onSettingsChange?: (settings: TrackMapSettings) => void;
}) {
	const track = useTrackData();
	const fill = useTileFill();

	return (
		<Panel
			aria-label="Track map"
			className={cn('min-h-0', fill && 'h-full')}
			data-testid="track-map"
		>
			{track.status === 'ready' ? (
				<TrackMapBody track={track} settings={settings} onSettingsChange={onSettingsChange} />
			) : (
				<>
					<PanelHeader title="Track map" />
					<MapPending data={track} />
				</>
			)}
		</Panel>
	);
}

function TrackMapBody({
	track,
	settings,
	onSettingsChange
}: {
	track: TrackReady;
	settings: TrackMapSettings;
	onSettingsChange?: (settings: TrackMapSettings) => void;
}) {
	const { race, followedDriver } = useRace();
	const places = usePlaces(track);
	const bodyClass = useMapBodyClass();
	const [local, setLocal] = React.useState(settings);
	const camera = local.camera ?? 'full';
	const paint = local.paint ?? 'plain';
	const labels = local.labels ?? 'code';
	const zones = useDrsZones(track);
	const showZones = (local.zones ?? true) && zones !== null;
	const sectors = useSectorPaint(track, paint === 'sectors');
	const followed = race.drivers.find((driver) => driver.number === followedDriver);

	const change = (next: TrackMapSettings) => {
		const merged = { ...local, ...next };

		setLocal(merged);
		onSettingsChange?.(merged);
	};

	const look = React.useCallback<CarLook>(
		(driver) => ({ label: labels === 'number' ? driver.number : driver.code }),
		[labels]
	);

	return (
		<>
			<PanelHeader title="Track map" meta={placesLabel(places)}>
				<KeyGroup
					label="Camera"
					options={CAMERA_OPTIONS}
					value={camera}
					onChange={(value) => change({ camera: value })}
				/>
				<KeyGroup
					label="Track colours"
					options={PAINT_OPTIONS}
					value={paint}
					onChange={(value) => change({ paint: value })}
				/>
				<Key
					pressed={labels === 'number'}
					aria-label="Label cars by number"
					onClick={() => change({ labels: labels === 'number' ? 'code' : 'number' })}
				>
					#
				</Key>
				{zones ? (
					<Key pressed={showZones} onClick={() => change({ zones: !showZones })}>
						DRS
					</Key>
				) : null}
			</PanelHeader>
			<div className={cn('flex min-h-0', bodyClass)}>
				<MapCanvas
					track={track}
					places={places}
					label={`Track map of ${track.outline.name}${camera === 'follow' && followed ? `, following ${followed.code}` : ''}`}
					overlays={sectors.overlays}
					zones={showZones ? zones : null}
					camera={camera}
					look={look}
				/>
				<div className="hidden w-36 shrink-0 @4xl:flex">
					<CarOrder places={places} visible />
				</div>
				<div className="@4xl:hidden">
					<CarOrder places={places} visible={false} />
				</div>
			</div>
			<MapNote places={places}>
				{paint === 'sectors' && sectors.note ? <span>{sectors.note}</span> : null}
				{showZones ? <span>Bands: DRS zones</span> : null}
			</MapNote>
		</>
	);
}
