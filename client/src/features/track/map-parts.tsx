import type { Driver } from '@f1-live/shared';
import * as React from 'react';

import { TeamStripe } from '@/components/driver-tag';
import { Skeleton } from '@/components/ui/skeleton';
import { useRace } from '@/data/race-context';
import { cn } from '@/lib/utils';

import { useTileFill } from '../dashboard/tile-fill';
import type { CarPlace } from './track-frames';
import type { PlacesSampler, TrackData } from './use-track';

/**
 * A map fills its tile on a dashboard; stacked on a phone it takes a height from its width, so the
 * circuit is as large as the column allows.
 */
export function useMapBodyClass(): string {
	const fill = useTileFill();

	return fill ? 'min-h-48 flex-1' : 'aspect-[4/3] @3xl:aspect-[16/9]';
}

/** What a map shows before its circuit is ready: loading, nothing to draw, or a failure. */
export function MapPending({ data }: { data: Exclude<TrackData, { status: 'ready' }> }) {
	const bodyClass = useMapBodyClass();

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
				{data.status === 'error'
					? `The circuit could not be loaded: ${data.message}`
					: 'No circuit outline for this session yet. It appears once any session here has been saved with car positions.'}
			</p>
		</div>
	);
}

/** Where the cars come from, in a word for the panel header. */
export function placesLabel(places: PlacesSampler): string {
	if (places.source === 'estimated') {
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
	children
}: {
	places: PlacesSampler;
	children?: React.ReactNode;
}) {
	let note: string | null = null;

	if (places.source === 'estimated') {
		note =
			places.live && places.positionsLive === false
				? 'Estimated from timing: live car positions need an F1 TV login on the server.'
				: 'Estimated from timing: this session has no car positions.';
	}

	if (!note && !children) {
		return null;
	}

	return (
		<p
			className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-2 text-xs"
			data-testid="map-note"
		>
			{note ? <span>{note}</span> : null}
			{children}
		</p>
	);
}

const LIST_EVERY_MS = 2000;

/**
 * The text alternative to a map: cars in their order on the road, refreshed every couple of
 * seconds rather than every frame. Wide tiles show it as a legend whose rows follow a driver.
 */
export function CarOrder({ places, visible }: { places: PlacesSampler; visible: boolean }) {
	const { race, followedDriver, setFollowedDriver } = useRace();
	const [cars, setCars] = React.useState<readonly CarPlace[]>([]);
	const { sample, moving, subscribe } = places;

	React.useEffect(() => {
		const read = () => setCars(sample(performance.now()).cars);

		read();

		const timer = moving ? window.setInterval(read, LIST_EVERY_MS) : undefined;
		const stop = subscribe(read);

		return () => {
			window.clearInterval(timer);
			stop();
		};
	}, [sample, moving, subscribe]);

	const drivers = new Map<string, Driver>(race.drivers.map((driver) => [driver.number, driver]));

	return (
		<ol
			aria-label="Cars in order on the road"
			className={cn(visible ? 'flex flex-col overflow-y-auto border-l py-1' : 'sr-only')}
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
							onClick={() => setFollowedDriver(driver.number)}
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
		</ol>
	);
}
