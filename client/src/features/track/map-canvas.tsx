import type { Driver, Point } from '@f1-live/shared';
import * as React from 'react';

import { useRace } from '@/data/race-context';

import type { MapCamera } from './settings';
import { type DrawFrame, TrackCanvas } from './track-canvas';
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
import type { Zone } from './drs-zones';
import type { CarPlace } from './track-frames';
import type { PlacesSampler, TrackReady } from './use-track';

/** How much closer the follow camera is than the whole circuit. */
const FOLLOW_ZOOM = 3.2;

/** The follow camera catches up with its car over about this long. */
const CAMERA_EASE_MS = 180;

/** Where a camera looks, in the feed's metres, and how close. */
type CameraAim = { centre: Point; zoom: number };

/** A tap within this of a car picks it. */
const PICK_RADIUS_PX = 16;

/** How a tile wants a car drawn; null leaves it off the map. */
export type CarLook = (driver: Driver, place: CarPlace) => CarLabel | null;

export type CarLabel = { label: string; emphasis?: boolean; dashed?: boolean };

/** Whatever a tile draws over the cars, with the frame's view and places. */
export type ExtraDraw = (
	frame: DrawFrame,
	view: View,
	cars: readonly CarPlace[],
	time: number
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
	const eased = React.useRef<CameraAim | null>(null);
	const drawn = React.useRef<{ view: View; cars: readonly CarPlace[] } | null>(null);
	const tint = snapshot.trackStatus;

	const draw = React.useCallback(
		(frameInput: DrawFrame) => {
			const { ctx, perf, width, height, rem, theme, reducedMotion, elapsed } = frameInput;
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
			drawCars(ctx, view, styled, theme, rem, middle, reserved);
			extra?.(frameInput, view, frame.cars, frame.time);
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
