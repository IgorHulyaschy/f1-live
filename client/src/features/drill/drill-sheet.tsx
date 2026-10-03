import type { Driver } from '@f1-live/shared';
import { ChevronRightIcon } from 'lucide-react';
import * as React from 'react';

import { Key } from '@/components/console/keys';
import { TeamStripe } from '@/components/driver-tag';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { SESSION_TYPE_LABEL } from '@/data/catalog';
import { useRaceView } from '@/data/race-context';
import { SessionPickerDialog } from '@/features/session/session-picker';
import { cn } from '@/lib/utils';

import { CompareView } from './compare-view';
import { ACTIONABLE } from './drill-parts';
import type { DrillView } from './drill-url';
import { DriverView } from './driver-view';
import { LapView } from './lap-view';
import {
	returnFocusToOpener,
	useDrill,
	useKeepReplayOnBack,
	useLinkedViewOverSession
} from './use-drill';

/** Nobody picked yet, in the Compare with picker. */
const PICK = 'pick';

type Crumb = { label: string; onSelect?: () => void };

/** Season › Event › Session › Driver › Lap: each level above the open one goes there. */
function Breadcrumbs({ crumbs }: { crumbs: readonly Crumb[] }) {
	return (
		<nav aria-label="Breadcrumb" className="min-w-0 pr-10">
			<ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
				{crumbs.map((crumb, index) => {
					const last = index === crumbs.length - 1;

					return (
						<li key={crumb.label} className="flex min-w-0 items-center gap-1">
							{last || !crumb.onSelect ? (
								<span
									className={cn('type-label truncate', last && 'text-foreground')}
									aria-current={last ? 'page' : undefined}
								>
									{crumb.label}
								</span>
							) : (
								<button
									type="button"
									onClick={crumb.onSelect}
									className={cn(
										ACTIONABLE,
										'type-label truncate px-0.5 underline-offset-2 hover:underline'
									)}
								>
									{crumb.label}
								</button>
							)}
							{last ? null : (
								<ChevronRightIcon aria-hidden className="text-muted-foreground size-3 shrink-0" />
							)}
						</li>
					);
				})}
			</ol>
		</nav>
	);
}

function DriverTitle({ driver, suffix }: { driver: Driver; suffix?: string }) {
	return (
		<span className="flex min-w-0 items-center gap-2">
			<TeamStripe driver={driver} className="h-6" />
			<span className="type-wide text-xl font-black">{driver.code}</span>
			<span className="truncate text-sm font-medium">
				{driver.firstName} {driver.lastName}
			</span>
			{suffix ? <span className="type-label text-foreground shrink-0">{suffix}</span> : null}
		</span>
	);
}

/** Follow and Compare with, for the driver on screen. */
function DriverActions({ driver }: { driver: Driver }) {
	const { race, followedDriver, setFollowedDriver } = useRaceView();
	const { open } = useDrill();
	const followed = followedDriver === driver.number;

	return (
		<div className="flex flex-wrap items-center gap-2">
			<Key
				pressed={followed}
				aria-pressed={followed}
				onClick={() => setFollowedDriver(driver.number)}
				title="Follow them across the app: the tint, the pit board and Mine events"
			>
				{followed ? 'Following' : 'Follow'}
			</Key>
			<Select
				value={PICK}
				onValueChange={(vs) => open({ kind: 'compare', driverNumber: driver.number, vs })}
			>
				<SelectTrigger size="sm" aria-label="Compare with another driver">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={PICK} disabled>
						Compare with…
					</SelectItem>
					{race.drivers
						.filter((entry) => entry.number !== driver.number)
						.map((entry) => (
							<SelectItem key={entry.number} value={entry.number}>
								{entry.code} {entry.lastName}
							</SelectItem>
						))}
				</SelectContent>
			</Select>
		</div>
	);
}

function DrillContent({ view, onPickSession }: { view: DrillView; onPickSession: () => void }) {
	const { race } = useRaceView();
	const { open, close } = useDrill();
	const driver = race.drivers.find((entry) => entry.number === view.driverNumber);

	const vs =
		view.kind === 'compare' ? race.drivers.find((entry) => entry.number === view.vs) : null;

	const year = new Date(race.session.startsAt).getUTCFullYear();
	const session = race.session.name ?? SESSION_TYPE_LABEL[race.session.type];
	const openDriver = () => open({ kind: 'driver', driverNumber: view.driverNumber });

	const crumbs: Crumb[] = [
		{ label: String(year), onSelect: onPickSession },
		{ label: race.session.meetingName.replace(/ Grand Prix$/, ''), onSelect: onPickSession },
		{ label: session, onSelect: close },
		{
			label: driver?.code ?? `Car ${view.driverNumber}`,
			onSelect: view.kind === 'driver' ? undefined : openDriver
		},
		...(view.kind === 'lap' ? [{ label: `Lap ${view.lap}` }] : []),
		...(view.kind === 'compare' ? [{ label: `vs ${vs?.code ?? view.vs}` }] : [])
	];

	return (
		<>
			<header className="flex flex-col gap-3 border-b px-4 pt-3 pb-3">
				<Breadcrumbs crumbs={crumbs} />
				<div className="flex flex-wrap items-center justify-between gap-3">
					<SheetTitle asChild>
						<h2 className="min-w-0">
							{driver ? (
								<DriverTitle
									driver={driver}
									suffix={
										view.kind === 'lap'
											? `Lap ${view.lap}`
											: view.kind === 'compare'
												? `vs ${vs?.code ?? ''}`
												: undefined
									}
								/>
							) : (
								`Car ${view.driverNumber}`
							)}
						</h2>
					</SheetTitle>
					{driver && view.kind === 'driver' ? <DriverActions driver={driver} /> : null}
				</div>
				<SheetDescription className="sr-only">
					{session} of the {year} {race.session.meetingName}. Escape or Back closes this.
				</SheetDescription>
			</header>
			<div className="@container min-h-0 flex-1 overflow-y-auto">
				{view.kind === 'driver' ? (
					<DriverView driverNumber={view.driverNumber} />
				) : view.kind === 'lap' ? (
					<LapView view={view} />
				) : (
					<CompareView a={view.driverNumber} b={view.vs} />
				)}
			</div>
		</>
	);
}

/**
 * The driver, lap and compare views: a side sheet beside the dashboard on wide screens, a full
 * page on phones. It is not modal, so a click on another driver in the timing or on the map
 * opens theirs; Escape, Back and the close key shut it.
 */
export function DrillSheet() {
	const { view, close } = useDrill();
	const [picking, setPicking] = React.useState(false);

	useKeepReplayOnBack();
	useLinkedViewOverSession();

	const open = view !== null;

	React.useEffect(() => {
		if (!open) {
			returnFocusToOpener();
		}
	}, [open]);

	return (
		<>
			<Sheet
				open={view !== null}
				modal={false}
				onOpenChange={(next) => {
					if (!next) {
						close();
					}
				}}
			>
				{view ? (
					<SheetContent
						data-testid="drill-sheet"
						data-drill-sheet
						className="sm:max-w-2xl xl:max-w-3xl"
						// Outside clicks belong to the dashboard: a row or a car there opens its own view.
						onInteractOutside={(event) => event.preventDefault()}
					>
						<DrillContent view={view} onPickSession={() => setPicking(true)} />
					</SheetContent>
				) : null}
			</Sheet>
			<SessionPickerDialog open={picking} onOpenChange={setPicking} />
		</>
	);
}
