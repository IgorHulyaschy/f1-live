import type { Driver, Point, TrackOutline } from '@f1-live/shared';
import * as React from 'react';

import { useRace } from '@/data/race-context';

import type { MapCamera } from './settings';
import { type DrawFrame, TrackCanvas } from './track-canvas';
import {
	type Box,
	drawCars,
	drawCircuit,
	fitView,
	type LabelRoom,
	type MapTheme,
	outlineMiddle,
	type Overlay,
	toScreen,
	type TrackStyle,
	type View,
	zoomedView
} from './track-draw';
import type { Zone } from './drs-zones';
import type { CarPlace } from './track-frames';
import type { PlacesSampler, TrackReady } from './use-track';

/** How much closer the follow camera is than the whole circuit. */
const FOLLOW_ZOOM = 3.2;

/** The follow camera catches up with its car over about this long. */
const CAMERA_EASE_MS = 180;

/** Where a camera looks, in the feed's metres, and how close. */
type CameraAim = { centre: Point; zoom: number };

/** The circuit drawn once for a camera that stands still, and what it was drawn for. */
type CircuitLayer = { canvas: HTMLCanvasElement; key: string; style: TrackStyle; reserved: Box[] };

/**
 * Copies the circuit from `layer`, drawing it there first when the size, theme or anything
 * painted on it changed since.
 */
function paintCircuit(
	layer: React.RefObject<CircuitLayer | null>,
	ctx: CanvasRenderingContext2D,
	frame: DrawFrame,
	view: View,
	outline: TrackOutline,
	style: TrackStyle
): Box[] {
	const ratio = window.devicePixelRatio || 1;

	const key = [
		frame.width,
		frame.height,
		ratio,
		frame.rem,
		view.scale,
		...view.centre,
		...Object.values(frame.theme)
	].join('/');

	const kept = layer.current;

	const same =
		kept?.key === key &&
		kept.style.tint === style.tint &&
		kept.style.marks === style.marks &&
		sameOverlays(kept.style.overlays, style.overlays) &&
		sameOverlays(kept.style.zones, style.zones);

	if (!same) {
		const canvas = kept?.canvas ?? document.createElement('canvas');
		const layerCtx = canvas.getContext('2d');

		canvas.width = Math.round(frame.width * ratio);
		canvas.height = Math.round(frame.height * ratio);

		if (!layerCtx) {
			return drawCircuit(ctx, view, outline, frame.theme, style);
		}

		layerCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
		layer.current = {
			canvas,
			key,
			style,
			reserved: drawCircuit(layerCtx, view, outline, frame.theme, style)
		};
	}

	const drawn = layer.current;

	if (!drawn) {
		return [];
	}

	ctx.drawImage(drawn.canvas, 0, 0, frame.width, frame.height);

	return drawn.reserved;
}

function sameOverlays(a: readonly Overlay[], b: readonly Overlay[]): boolean {
	return (
		a.length === b.length &&
		a.every((overlay, index) => {
			const other = b[index];

			return (
				other !== undefined &&
				overlay.fromM === other.fromM &&
				overlay.toM === other.toM &&
				overlay.colour === other.colour &&
				overlay.dashed === other.dashed &&
				overlay.width === other.width &&
				overlay.alpha === other.alpha
			);
		})
	);
}

/** What the camera aimed at last frame, how far off it still was, and where it looked. */
type CameraState = { key: string; target: CameraAim; offset: CameraAim; shown: CameraAim };

/**
 * A camera target that moves more than this in a frame jumped (a scrub) rather than followed a
 * car: at 60× a car covers about 80 m a frame.
 */
const JUMP_M = 400;

/** A frame at 60 Hz: a longer frame lets a followed car move further without it counting as a jump. */
const FRAME_MS = 1000 / 60;

/** Past a few frames' wait, a long move is a scrub, not a car followed. */
const MAX_FRAMES = 4;

/** A tap within this of a car picks it. */
const PICK_RADIUS_PX = 16;

/** How a tile wants a car drawn; null leaves it off the map. */
export type CarLook = (driver: Driver, place: CarPlace) => CarLabel | null;

export type CarLabel = { label: string; emphasis?: boolean; dashed?: boolean };

/** Whatever a tile draws over the cars, with the frame's view and places, and where labels went. */
export type ExtraDraw = (
	frame: DrawFrame,
	view: View,
	cars: readonly CarPlace[],
	time: number,
	room: LabelRoom
) => void;

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
	extra?: ExtraDraw;
	marks?: boolean;
}) {
	const { race, snapshot, followedDriver, setFollowedDriver } = useRace();

	const drivers = React.useMemo(
		() => new Map(race.drivers.map((driver) => [driver.number, driver])),
		[race.drivers]
	);

	const middle = React.useMemo(() => outlineMiddle(track.outline), [track.outline]);
	const eased = React.useRef<CameraState | null>(null);
	const layer = React.useRef<CircuitLayer | null>(null);
	const fitted = React.useRef<{ key: string; view: View } | null>(null);
	const drawn = React.useRef<{ view: View; cars: readonly CarPlace[] } | null>(null);
	const tint = snapshot.trackStatus;

	const draw = React.useCallback(
		(frameInput: DrawFrame) => {
			const { ctx, perf, width, height, rem, theme, reducedMotion, onScreen, elapsed } = frameInput;
			const frame = places.sample(perf);
			// Labels sit outside the track, so the circuit keeps room for them round its edge.
			const fitKey = `${track.outline.circuitKey}/${width}/${height}/${rem}`;

			if (fitted.current?.key !== fitKey) {
				fitted.current = {
					key: fitKey,
					view: fitView(track.outline, width, height, 44 * (rem / 16))
				};
			}

			const base = fitted.current.view;
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
					// The camera rides with its cars exactly. A jump (another driver, a scrub) leaves
					// an offset from where it was, which dies away.
					const last = eased.current;
					const key = watched.join(',');
					const decay = reducedMotion || !onScreen ? 0 : Math.exp(-elapsed / CAMERA_EASE_MS);

					const jumped =
						last !== null &&
						(last.key !== key ||
							Math.hypot(
								target.centre[0] - last.target.centre[0],
								target.centre[1] - last.target.centre[1]
							) >
								JUMP_M * Math.min(MAX_FRAMES, Math.max(1, elapsed / FRAME_MS)));

					const from: CameraAim = jumped
						? {
								centre: [
									last.shown.centre[0] - target.centre[0],
									last.shown.centre[1] - target.centre[1]
								],
								zoom: last.shown.zoom - target.zoom
							}
						: (last?.offset ?? { centre: [0, 0], zoom: 0 });

					const offset: CameraAim = {
						centre: [from.centre[0] * decay, from.centre[1] * decay],
						zoom: from.zoom * decay
					};

					const shown: CameraAim = {
						centre: [target.centre[0] + offset.centre[0], target.centre[1] + offset.centre[1]],
						zoom: target.zoom + offset.zoom
					};

					// Still easing after a jump: ask for another frame.
					settling = Math.hypot(...offset.centre) * base.scale * shown.zoom > 0.5;
					eased.current = { key, target, offset, shown };
					view = zoomedView(base, shown.centre, shown.zoom);
				}
			}

			const neutralised = tint === 'vsc' || tint === 'safety_car';

			const style = {
				rem,
				weight: camera === 'full' ? 1 : 1.6,
				overlays: overlays?.(theme) ?? [],
				zones: (zones ?? []).map((zone) => ({ ...zone, colour: theme.foreground })),
				marks,
				tint: tint === 'red' ? theme.danger : neutralised ? theme.flag : null
			};

			// A camera that stands still sees the same circuit every frame: it is drawn once and
			// copied, so a frame costs only the cars.
			const reserved =
				camera === 'full'
					? paintCircuit(layer, ctx, frameInput, view, track.outline, style)
					: drawCircuit(ctx, view, track.outline, theme, style);

			const styled = frame.cars.flatMap((place) => {
				const driver = drivers.get(place.driverNumber);
				const custom = driver && look ? look(driver, place) : undefined;

				if (!driver || custom === null) {
					return [];
				}

				return [
					{
						place,
						style: {
							colour: `#${driver.teamColour}`,
							label: custom?.label ?? driver.code,
							followed: driver.number === followedDriver,
							estimated: frame.source === 'estimated',
							emphasis: custom?.emphasis,
							dashed: custom?.dashed
						}
					}
				];
			});

			// The followed car is drawn last, over the others.
			styled.sort((a, b) => Number(a.style.followed) - Number(b.style.followed));
			const room = drawCars(ctx, view, styled, theme, rem, middle, reserved);

			extra?.(frameInput, view, frame.cars, frame.time, room);
			drawn.current = { view, cars: styled.map((car) => car.place) };

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

	// The spread of the cars, measured in the view's turn, with room for labels.
	const turned = cars.map(
		(car) => [car.x * base.cos - car.y * base.sin, car.x * base.sin + car.y * base.cos] as const
	);

	const minX = Math.min(...turned.map(([x]) => x));
	const maxX = Math.max(...turned.map(([x]) => x));
	const minY = Math.min(...turned.map(([, y]) => y));
	const maxY = Math.max(...turned.map(([, y]) => y));
	const [tx, ty] = [(minX + maxX) / 2, (minY + maxY) / 2];
	// Turn the middle back into the feed's frame.
	const centre: Point = [tx * base.cos + ty * base.sin, -tx * base.sin + ty * base.cos];

	if (zoom !== null) {
		return { centre, zoom };
	}

	const spanX = maxX - minX;
	const spanY = maxY - minY;
	const room = Math.min(90 * (rem / 16), Math.min(width, height) / 4);

	const fit = Math.min(
		(width - room * 2) / Math.max(spanX * base.scale, 1),
		(height - room * 2) / Math.max(spanY * base.scale, 1)
	);

	// Never wider than the whole circuit, which always holds every car.
	return { centre, zoom: Math.min(6, Math.max(1, fit)) };
}
