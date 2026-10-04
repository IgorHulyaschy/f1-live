import type { Driver } from '@f1-live/shared';
import * as React from 'react';

import { Key } from '@/components/console/keys';
import { TeamStripe } from '@/components/driver-tag';
import { Skeleton } from '@/components/ui/skeleton';
import { describeFetch, describeStage } from '@/data/archive-fetch';
import { useRace } from '@/data/race-context';
import { useDrill } from '@/features/drill/use-drill';
import { isTimedSession } from '@/insights/qualifying';
import { cn } from '@/lib/utils';

import { useTileFill } from '../dashboard/tile-fill';
import type { CarPlace } from './track-frames';
import { type Places, type PlacesSampler, type TrackData, useTrackFetch } from './use-track';

const NO_CARS: readonly CarPlace[] = [];

/**
 * A map fills its tile on a dashboard; stacked on a phone it takes a height from its width, so the
 * circuit is as large as the column allows.
 */
export function useMapBodyClass(): string {
	const fill = useTileFill();

	return fill ? 'min-h-48 flex-1' : 'aspect-[4/3] @3xl:aspect-[16/9]';
}

/** The server's progress with the session's positions from the archive, and a retry once it failed. */
function FetchProgress({ centered = false }: { centered?: boolean }) {
	const { status, retry } = useTrackFetch();
	const text = describeFetch(status);

	if (text === null) {
		return null;
	}

	const failed = status?.state === 'failed';

	return (
		<span data-testid="map-fetch" role={failed ? 'alert' : undefined}>
			{text}
			{/* Announced once per stage, not on every percent. */}
			<span className="sr-only" aria-live="polite">
				{failed ? '' : describeStage(status)}
			</span>
			{failed ? (
				<Key onClick={retry} className={cn('mt-2 flex w-fit', centered && 'mx-auto')}>
					Try again
				</Key>
			) : null}
		</span>
	);
}

/** What a map shows before its circuit is ready: loading, nothing to draw, or a failure. */
export function MapPending({ data }: { data: Exclude<TrackData, { status: 'ready' }> }) {
	const bodyClass = useMapBodyClass();
	const fetching = describeFetch(useTrackFetch().status) !== null;

	if (data.status === 'loading') {
		return (
			<div className={cn('flex flex-col gap-3 p-4', bodyClass)} aria-busy data-testid="map-loading">
				<Skeleton className="h-3 w-1/3" />
				<Skeleton className="w-full flex-1" />
			</div>
		);
	}

	return (
		<div className={cn('flex items-center justify-center p-6', bodyClass)}>
			<p
				role={data.status === 'error' ? 'alert' : undefined}
				data-testid={data.status === 'error' ? 'map-error' : 'map-empty'}
				className={cn(
					'max-w-sm text-center text-sm',
					data.status === 'error' ? 'text-danger' : 'text-muted-foreground'
				)}
			>
				{data.status === 'error' ? (
					`The circuit could not be loaded: ${data.message}`
				) : fetching ? (
					<FetchProgress centered />
				) : (
					'No circuit outline for this session yet. It appears once any session here has been saved with car positions.'
				)}
			</p>
		</div>
	);
}

/** Positions the session has, but not for this moment: its chunk failed, so places are estimated. */
function positionsMissing(now: Places | null | undefined): boolean {
	return now?.source === 'estimated' && !now.waiting;
}

/** Where the cars come from, in a word for the panel header. */
export function placesLabel(places: PlacesSampler, now?: Places | null): string {
	if (places.source === 'estimated' || positionsMissing(now)) {
		return 'Estimated';
	}

	return places.live ? 'Live' : 'Replay';
}

/**
 * The line under a map saying what the picture is: estimated places and why, or the feed's
 * positions. Live without positions names the login the feed needs.
 */
export function MapNote({
	places,
	now,
	children
}: {
	places: PlacesSampler;
	/** The places on screen, which may be estimated where the session's positions failed to load. */
	now?: Places | null;
	children?: React.ReactNode;
}) {
	const fetching = describeFetch(useTrackFetch().status) !== null && !places.live;
	let note: string | null = null;

	if (places.source === 'estimated' && fetching) {
		note = 'Estimated from timing until the car positions are in.';
	} else if (places.source === 'estimated') {
		note =
			places.live && places.positionsLive === false
				? 'Estimated from timing: live car positions need an F1 TV login on the server.'
				: 'Estimated from timing: this session has no car positions.';
	} else if (positionsMissing(now)) {
		note = 'Estimated from timing: the car positions for this moment did not load.';
	}

	if (!note && !fetching && React.Children.toArray(children).length === 0) {
		return null;
	}

	return (
		<p
			className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-2 text-xs"
			data-testid="map-note"
		>
			{note ? <span>{note}</span> : null}
			{fetching ? <FetchProgress /> : null}
			{children}
		</p>
	);
}

const LIST_EVERY_MS = 2000;

/**
 * The places a reading beside a map shows, read again every `everyMs` while the cars move and
 * whenever a still picture changes; text never redraws every frame.
 */
export function usePlacesNow(places: PlacesSampler, everyMs: number): Places | null {
	const [now, setNow] = React.useState<Places | null>(null);
	const { sample, moving, subscribe } = places;

	React.useEffect(() => {
		const read = () => setNow(sample(performance.now()));

		read();

		const timer = moving ? window.setInterval(read, everyMs) : undefined;
		const stop = subscribe(read);

		return () => {
			window.clearInterval(timer);
			stop();
		};
	}, [sample, moving, subscribe, everyMs]);

	return now;
}

/**
 * The text alternative to a map: cars in their order on the road, refreshed every couple of
 * seconds rather than every frame. Wide tiles show it as a legend whose rows follow a driver.
 */
export function CarOrder({ places }: { places: PlacesSampler }) {
	const { race, followedDriver, standings } = useRace();
	const { open } = useDrill();
	const timed = isTimedSession(race.session.type);
	const sampled = usePlacesNow(places, LIST_EVERY_MS)?.cars ?? NO_CARS;

	// Off a race the cars run different numbers of laps: the order is round the lap, from the line.
	const cars = timed
		? sampled.toSorted((a, b) => (b.distanceM ?? -1) - (a.distanceM ?? -1))
		: sampled;

	const drivers = new Map<string, Driver>(race.drivers.map((driver) => [driver.number, driver]));
	const placed = new Set(cars.map((car) => car.driverNumber));
	const out = new Set(standings.flatMap((row) => (row.state === 'out' ? [row.driver.number] : [])));

	// Cars not on the circuit close the list: out of the session, or in the garage.
	const absent = race.drivers.flatMap((driver) =>
		placed.has(driver.number) ? [] : [{ driver, label: out.has(driver.number) ? 'Out' : 'Garage' }]
	);

	return (
		<ol
			aria-label={timed ? 'Cars round the lap, furthest first' : 'Cars in order on the road'}
			className="sr-only @4xl:not-sr-only @4xl:flex @4xl:w-36 @4xl:shrink-0 @4xl:flex-col @4xl:overflow-y-auto @4xl:border-l @4xl:py-1"
			data-testid="map-car-list"
		>
			{cars.map((car, index) => {
				const driver = drivers.get(car.driverNumber);

				if (!driver) {
					return null;
				}

				const where =
					car.state === 'pit' ? 'in the pit lane' : car.state === 'off' ? 'off the track' : null;

				return (
					<li key={car.driverNumber}>
						<button
							type="button"
							onClick={() => open({ kind: 'driver', driverNumber: driver.number })}
							aria-current={driver.number === followedDriver ? 'true' : undefined}
							className={cn(
								'hover:bg-accent focus-visible:ring-ring grid w-full grid-cols-[1.5rem_auto_1fr] items-center gap-2 px-3 py-0.5 text-left focus-visible:ring-2 focus-visible:outline-none',
								driver.number === followedDriver && 'bg-accent'
							)}
						>
							<span className="text-muted-foreground font-mono text-xs">{index + 1}</span>
							<TeamStripe driver={driver} />
							<span className="flex items-baseline gap-2">
								<span className="type-wide text-xs font-bold">{driver.code}</span>
								{where ? (
									<span className="type-label">{where === 'in the pit lane' ? 'Pit' : 'Off'}</span>
								) : null}
								<span className="sr-only">{where ?? ''}</span>
							</span>
						</button>
					</li>
				);
			})}
			{absent.map(({ driver, label }) => (
				<li
					key={driver.number}
					className="text-muted-foreground grid grid-cols-[1.5rem_auto_1fr] items-center gap-2 px-3 py-0.5"
				>
					<span className="font-mono text-xs">-</span>
					<TeamStripe driver={driver} />
					<span className="flex items-baseline gap-2">
						<span className="type-wide text-xs font-bold">{driver.code}</span>
						<span className="type-label">{label}</span>
					</span>
				</li>
			))}
		</ol>
	);
}
