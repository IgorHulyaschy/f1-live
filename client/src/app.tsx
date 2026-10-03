import { LazyMotion, MotionConfig } from 'motion/react';
import * as React from 'react';
import { matchPath, Outlet, useLocation, useMatch } from 'react-router';

import { AppHeader } from '@/components/app-header';
import { Key } from '@/components/console/keys';
import { CommandMenu } from '@/components/command-menu';
import { PitBoard } from '@/components/pit-board';
import { LoadingState, SiteFrame } from '@/components/site-frame';
import { SiteFooter } from '@/components/site-footer';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TrackStatusBadge } from '@/components/track-status-badge';
import { RaceProvider, useRace } from '@/data/race-context';
import { ResultsProvider } from '@/data/results-context';
import { TelemetryProvider } from '@/data/telemetry-context';
import { AccountFooterKey, AccountSession } from '@/features/account/account-menu';
import { useAccountPlan } from '@/features/account/account-store';
import { CompareProvider } from '@/features/analysis/compare-context';
import { useDashboards } from '@/features/dashboard/dashboard-store';
import { DrillSheet } from '@/features/drill/drill-sheet';
import type { RaceSource } from '@/data/race-source';
import { useRaceAlerts } from '@/hooks/use-race-alerts';
import { useRaceHotkeys } from '@/hooks/use-race-hotkeys';
import { useViewTitle } from '@/hooks/use-view-title';
import { toggleTheme, useDarkTheme } from '@/hooks/use-theme';
import { ConsentBanner, usePageViews } from '@/platform/consent';
import { InstallBanner, InstallKey } from '@/platform/install';
import { usePageMeta } from '@/platform/page-meta';
import { keepAwakeStore, useScreenWakeLock, wakeLockSupported } from '@/platform/wake-lock';

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

/**
 * Rows sliding and the nav underline need motion's engine. It loads a second after the page has,
 * so the first screen never shares the connection with it; nothing on screen moves that soon.
 */
async function loadMotionFeatures() {
	await new Promise<void>((resolve) => {
		const later = () => window.setTimeout(resolve, 1000);

		if (document.readyState === 'complete') {
			later();
		} else {
			window.addEventListener('load', later, { once: true });
		}
	});

	return (await import('./motion-features')).default;
}

function Console({ sourceKind, bare }: { sourceKind: RaceSource['kind']; bare: boolean }) {
	const [commandOpen, setCommandOpen] = React.useState(false);
	const openCommand = React.useCallback(() => setCommandOpen(true), []);
	const dark = useDarkTheme();
	const { snapshot, followedDriver, playing, live } = useRace();
	const focus = snapshot.drivers.find((driver) => driver.number === followedDriver);
	const keepAwake = keepAwakeStore.useValue();

	useRaceHotkeys(openCommand);
	useRaceAlerts();
	useViewTitle();
	useScreenWakeLock(keepAwake && (playing || live.isLive));

	if (bare) {
		return (
			<LazyMotion features={loadMotionFeatures} strict>
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
			</LazyMotion>
		);
	}

	return (
		<LazyMotion features={loadMotionFeatures} strict>
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
							<SiteFooter
								className="pb-24 md:pb-8"
								note={
									sourceKind === 'mock'
										? 'This replay uses the real grid, strategies, race control and result; lap times are modelled from them.'
										: undefined
								}
							>
								<div className="flex flex-wrap items-center gap-2">
									<span className="flex gap-2 sm:hidden">
										<AccountFooterKey />
										<Key onClick={toggleTheme}>{dark ? 'Light theme' : 'Dark theme'}</Key>
									</span>
									{wakeLockSupported() ? (
										<Key
											role="switch"
											aria-checked={keepAwake}
											pressed={keepAwake}
											onClick={() => keepAwakeStore.set(!keepAwake)}
											title="Keep the screen on while a race plays or runs live"
										>
											Screen awake
										</Key>
									) : null}
									<InstallKey />
								</div>
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
							</SiteFooter>
							<PitBoard />
							<AccountSession />
							<DrillSheet />
						</div>
					</CompareProvider>
					<CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
					<Toaster theme={dark ? 'dark' : 'light'} position="bottom-right" />
				</TooltipProvider>
			</MotionConfig>
		</LazyMotion>
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
				<ResultsProvider load={source.loadResults}>
					<Console sourceKind={source.kind} bare={bare} />
				</ResultsProvider>
			</TelemetryProvider>
		</RaceProvider>
	);
}

/**
 * Above every page: the tab title and share card follow the route, page views are counted once
 * the viewer allows it, and the privacy and install questions sit on the bottom edge.
 */
export function Root() {
	// A popped-out tile is a second window; the questions belong to the main one.
	const popOut = useMatch('/tile/:dashboardId/:tileId');

	usePageMeta();
	usePageViews();

	return (
		<>
			<Outlet />
			{popOut ? null : (
				<>
					<ConsentBanner />
					<InstallBanner />
				</>
			)}
		</>
	);
}

/** Pages outside the race console, such as the legal pages. */
export function SiteLayout() {
	return (
		<SiteFrame>
			<Outlet />
		</SiteFrame>
	);
}
