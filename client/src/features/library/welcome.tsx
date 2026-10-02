import { XIcon } from 'lucide-react';
import * as React from 'react';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';

import { DriverPortrait } from '@/components/driver-media';
import { Key } from '@/components/console/keys';
import { useRace } from '@/data/race-context';
import { dashboardPath } from '@/features/dashboard/paths';
import { useCarriedSearch } from '@/features/dashboard/use-carried-search';
import { createLocalStore } from '@/lib/local-store';
import { cn } from '@/lib/utils';

/** Whether this browser has been through first run, or waved it away. */
export const welcomedStore = createLocalStore('pitwall-welcomed', z.boolean(), false);

/** Where each kind of viewer starts. Each is a ready-made dashboard they can change later. */
const STARTS = [
	{ id: 'live', title: 'Race day', detail: 'The order, your driver and the flags, on one screen.' },
	{
		id: 'drivers',
		title: 'Faces and cars',
		detail: 'The grid as pictures and your driver up close.'
	},
	{ id: 'battle', title: 'Your driver’s fight', detail: 'The car ahead and behind, lap by lap.' },
	{ id: 'strategy', title: 'Strategy calls', detail: 'Tyres, stints and what a stop would cost.' },
	{
		id: 'analysis',
		title: 'Lap charts',
		detail: 'Compare any drivers, with fuel and tyres taken out.'
	},
	{ id: 'wall', title: 'TV or second monitor', detail: 'Fills the screen; pick text size TV.' }
] as const;

type StartId = (typeof STARTS)[number]['id'];

/**
 * First run: pick a driver and a starting dashboard. Two choices, both changeable later, so a
 * new viewer lands on a screen that already looks like theirs.
 */
export function WelcomePage() {
	const { race, followedDriver, setFollowedDriver } = useRace();
	const navigate = useNavigate();
	const search = useCarriedSearch();
	const [start, setStart] = React.useState<StartId>('live');
	const drivers = race.drivers.toSorted((a, b) => a.team.localeCompare(b.team));

	return (
		<div className="flex max-w-6xl flex-col gap-8" data-testid="welcome">
			<header className="flex flex-col gap-2">
				<h1 className="type-wide text-2xl leading-none font-black italic md:text-4xl">
					Set up Pitwall
				</h1>
				<p className="text-muted-foreground max-w-2xl text-sm">
					Two choices, both easy to change later. Your driver is tinted through every screen; your
					starting dashboard is one you can move, resize and add to.
				</p>
			</header>
			<section aria-labelledby="welcome-driver" className="flex flex-col gap-3">
				<h2 id="welcome-driver" className="flex items-baseline gap-3">
					<span className="text-muted-foreground font-mono text-sm">01</span>
					<span className="type-wide text-sm font-bold">Who do you follow?</span>
				</h2>
				<ul className="grid grid-cols-4 border-t border-l sm:grid-cols-5 xl:grid-cols-10">
					{drivers.map((driver) => {
						const chosen = driver.number === followedDriver;

						return (
							<li key={driver.number} className="border-r border-b">
								<button
									type="button"
									aria-pressed={chosen}
									onClick={() => setFollowedDriver(driver.number)}
									className={cn(
										'hover:bg-accent focus-visible:bg-accent flex w-full flex-col text-left transition-colors focus-visible:outline-none',
										chosen && 'bg-accent'
									)}
								>
									<DriverPortrait
										driver={driver}
										tinted={chosen}
										className="h-16 w-full sm:aspect-square sm:h-auto"
									/>
									<span className="flex items-baseline justify-between gap-2 px-2 py-1.5">
										<span className="type-wide truncate text-xs font-bold">{driver.lastName}</span>
										{chosen ? <span aria-hidden className="bg-focus size-2 shrink-0" /> : null}
									</span>
									<span className="type-label hidden truncate px-2 pb-2 sm:block">
										{driver.team}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			</section>
			<section aria-labelledby="welcome-start" className="flex flex-col gap-3">
				<h2 id="welcome-start" className="flex items-baseline gap-3">
					<span className="text-muted-foreground font-mono text-sm">02</span>
					<span className="type-wide text-sm font-bold">How do you watch?</span>
				</h2>
				<div className="grid border-t border-l sm:grid-cols-2 lg:grid-cols-3">
					{STARTS.map((option) => (
						<button
							key={option.id}
							type="button"
							aria-pressed={start === option.id}
							onClick={() => setStart(option.id)}
							className={cn(
								'hover:bg-accent focus-visible:bg-accent flex flex-col gap-1 border-r border-b px-3 py-2.5 text-left transition-colors focus-visible:outline-none',
								start === option.id && 'bg-accent'
							)}
						>
							<span className="type-wide flex items-center gap-2 text-xs font-bold">
								{start === option.id ? <span aria-hidden className="bg-focus h-3 w-1" /> : null}
								{option.title}
							</span>
							<span className="text-muted-foreground text-xs">{option.detail}</span>
						</button>
					))}
				</div>
			</section>
			<div className="flex flex-wrap items-center gap-3">
				<Key
					pressed
					onClick={() => {
						welcomedStore.set(true);
						void navigate({ pathname: dashboardPath(start), search });
					}}
				>
					Start watching
				</Key>
				<Link
					to={{ pathname: '/library', search }}
					className="type-label hover:text-foreground underline-offset-4 hover:underline"
				>
					Or browse dashboards fans built
				</Link>
			</div>
		</div>
	);
}

/** One line over the first dashboard a new viewer sees, until they set up or wave it away. */
export function WelcomeBanner() {
	const welcomed = welcomedStore.useValue();
	const search = useCarriedSearch();

	if (welcomed) {
		return null;
	}

	return (
		<aside
			aria-label="Get started"
			className="border-focus mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 py-1 pl-3"
		>
			<p className="text-sm">New here? Pick your driver and a dashboard that fits how you watch.</p>
			<Link
				to={{ pathname: '/welcome', search }}
				className="type-label text-foreground inline-flex h-9 items-center border border-b-2 px-2.5 sm:h-7"
			>
				Set up
			</Link>
			<Key aria-label="Dismiss" className="ml-auto" onClick={() => welcomedStore.set(true)}>
				<XIcon />
			</Key>
		</aside>
	);
}
