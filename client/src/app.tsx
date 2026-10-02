import { MotionConfig } from 'motion/react';
import * as React from 'react';
import { Outlet } from 'react-router';

import { AppHeader } from '@/components/app-header';
import { Key } from '@/components/console/keys';
import { CommandMenu } from '@/components/command-menu';
import { PitBoard } from '@/components/pit-board';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RaceProvider, useRace } from '@/data/race-context';
import type { RaceSource } from '@/data/race-source';
import { useRaceAlerts } from '@/hooks/use-race-alerts';
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

function Console({ sourceKind }: { sourceKind: RaceSource['kind'] }) {
	const [commandOpen, setCommandOpen] = React.useState(false);
	const openCommand = React.useCallback(() => setCommandOpen(true), []);
	const dark = useDarkTheme();
	const { snapshot, followedDriver } = useRace();
	const focus = snapshot.drivers.find((driver) => driver.number === followedDriver);

	useRaceHotkeys(openCommand);
	useRaceAlerts();

	return (
		<MotionConfig reducedMotion="user">
			<TooltipProvider>
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
						<Key className="sm:hidden" onClick={toggleTheme}>
							{dark ? 'Light theme' : 'Dark theme'}
						</Key>
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
								<dt>Pages</dt>
								<dd className="text-foreground">1 2 3</dd>
							</div>
							<div className="flex gap-1.5">
								<dt>Jump</dt>
								<dd className="text-foreground">⌘K</dd>
							</div>
						</dl>
					</footer>
					<PitBoard />
				</div>
				<CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
				<Toaster theme={dark ? 'dark' : 'light'} position="bottom-right" />
			</TooltipProvider>
		</MotionConfig>
	);
}

export function AppLayout({ source }: { source: RaceSource }) {
	return (
		<RaceProvider source={source} loadingFallback={<LoadingState />} ErrorFallback={ErrorState}>
			<Console sourceKind={source.kind} />
		</RaceProvider>
	);
}
