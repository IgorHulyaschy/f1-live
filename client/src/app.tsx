import { MotionConfig } from 'motion/react';
import * as React from 'react';
import { matchPath, Outlet, useLocation } from 'react-router';

import { AppHeader } from '@/components/app-header';
import { Key } from '@/components/console/keys';
import { CommandMenu } from '@/components/command-menu';
import { PitBoard } from '@/components/pit-board';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TrackStatusBadge } from '@/components/track-status-badge';
import { RaceProvider, useRace } from '@/data/race-context';
import { TelemetryProvider } from '@/data/telemetry-context';
import { AccountFooterKey, AccountSession } from '@/features/account/account-menu';
import { useAccountPlan } from '@/features/account/account-store';
import { CompareProvider } from '@/features/analysis/compare-context';
import { useDashboards } from '@/features/dashboard/dashboard-store';
import type { RaceSource } from '@/data/race-source';
import { useRaceAlerts } from '@/hooks/use-race-alerts';
import { usePageTitle } from '@/hooks/use-page-title';
import { useRaceHotkeys } from '@/hooks/use-race-hotkeys';
import { toggleTheme, useDarkTheme } from '@/hooks/use-theme';

export function LoadingState() {
	return (
		<div className="mx-auto flex max-w-screen-2xl flex-col gap-4 p-6" aria-busy>
			<Skeleton className="h-8 w-72" />
			<Skeleton className="h-3 w-full" />
			<Skeleton className="h-96 w-full" />
		</div>
	);
}

function ErrorState({ message }: { message: string }) {
	return (
		<div className="mx-auto max-w-xl p-6" role="alert">
			<h1 className="text-lg font-semibold">Race data is unavailable</h1>
			<p className="text-muted-foreground text-sm">{message}</p>
		</div>
	);
}

/** The slim bar over a popped-out tile: what race, which lap, what flag. */
function BareHeader() {
	const { race, snapshot, lap, stepUnit } = useRace();
	const { pathname } = useLocation();
	const { dashboards } = useDashboards();

	const match = matchPath('/tile/:dashboardId/:tileId', pathname);

	const poppedKind = dashboards
		.find((dashboard) => dashboard.id === match?.params.dashboardId)
		?.tiles.find((tile) => tile.id === match?.params.tileId)?.kind;

	return (
		<header className="flex h-10 shrink-0 items-center gap-4 border-b px-4">
			<span className="type-wide text-xs font-black italic">
				{race.session.meetingName.replace(/ Grand Prix$/, '')}
			</span>
			<TrackStatusBadge status={snapshot.trackStatus} />
			{poppedKind === 'replay' && stepUnit === 'minute' ? null : (
				<span className="ml-auto flex items-baseline gap-1.5 font-mono">
					<span className="type-label">Lap</span>
					<span className="sr-only" data-testid="lap-counter">
						Lap {lap}/{race.session.totalLaps}
					</span>
					<span aria-hidden className="text-lg font-bold">
						{lap}
					</span>
					<span aria-hidden className="text-muted-foreground text-xs">
						/{race.session.totalLaps}
					</span>
				</span>
			)}
		</header>
	);
}

function Console({ sourceKind, bare }: { sourceKind: RaceSource['kind']; bare: boolean }) {
	const [commandOpen, setCommandOpen] = React.useState(false);
	const openCommand = React.useCallback(() => setCommandOpen(true), []);
	const dark = useDarkTheme();
	const { snapshot, followedDriver } = useRace();
	const focus = snapshot.drivers.find((driver) => driver.number === followedDriver);

	useRaceHotkeys(openCommand);
	useRaceAlerts();
	usePageTitle();

	if (bare) {
		return (
			<MotionConfig reducedMotion="user">
				<TooltipProvider>
					<CompareProvider>
						<div
							className="flex h-svh flex-col"
							style={focus ? { '--focus': `#${focus.teamColour}` } : undefined}
						>
							<BareHeader />
							<Outlet />
						</div>
					</CompareProvider>
				</TooltipProvider>
			</MotionConfig>
		);
	}

	return (
		<MotionConfig reducedMotion="user">
			<TooltipProvider>
				<CompareProvider>
					<div
						className="min-h-svh"
						style={focus ? { '--focus': `#${focus.teamColour}` } : undefined}
					>
						<AppHeader onOpenCommand={openCommand} />
						<main className="px-4 pb-6 md:px-6">
							<Outlet />
						</main>
						<footer className="text-muted-foreground flex flex-wrap justify-between gap-x-8 gap-y-2 px-4 pb-24 text-xs md:px-6 md:pb-8">
							<p className="max-w-3xl">
								Unofficial. Not associated in any way with the Formula 1 companies.
								{sourceKind === 'mock'
									? ' This replay uses the real grid, strategies, race control and result; lap times are modelled from them.'
									: null}
							</p>
							<span className="flex gap-2 sm:hidden">
								<AccountFooterKey />
								<Key onClick={toggleTheme}>{dark ? 'Light theme' : 'Dark theme'}</Key>
							</span>
							<dl className="type-label hidden gap-4 md:flex">
								<div className="flex gap-1.5">
									<dt>Laps</dt>
									<dd className="text-foreground">← →</dd>
								</div>
								<div className="flex gap-1.5">
									<dt>Play</dt>
									<dd className="text-foreground">Space</dd>
								</div>
								<div className="flex gap-1.5">
									<dt>Events</dt>
									<dd className="text-foreground">⇧← →</dd>
								</div>
								<div className="flex gap-1.5">
									<dt>Live</dt>
									<dd className="text-foreground">L</dd>
								</div>
								<div className="flex gap-1.5">
									<dt>Dashboards</dt>
									<dd className="text-foreground">1–9</dd>
								</div>
								<div className="flex gap-1.5">
									<dt>Jump</dt>
									<dd className="text-foreground">⌘K</dd>
								</div>
							</dl>
						</footer>
						<PitBoard />
						<AccountSession />
					</div>
				</CompareProvider>
				<CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
				<Toaster theme={dark ? 'dark' : 'light'} position="bottom-right" />
			</TooltipProvider>
		</MotionConfig>
	);
}

export function AppLayout({ source, bare = false }: { source: RaceSource; bare?: boolean }) {
	const accountPlan = useAccountPlan();

	return (
		<RaceProvider
			source={source}
			accountPlan={accountPlan}
			loadingFallback={<LoadingState />}
			ErrorFallback={ErrorState}
		>
			<TelemetryProvider source={source.telemetry}>
				<Console sourceKind={source.kind} bare={bare} />
			</TelemetryProvider>
		</RaceProvider>
	);
}
