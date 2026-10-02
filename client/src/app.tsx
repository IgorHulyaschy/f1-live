import * as React from 'react';
import { Outlet } from 'react-router';

import { AppHeader } from '@/components/app-header';
import { CommandMenu } from '@/components/command-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RaceProvider } from '@/data/race-context';
import type { RaceSource } from '@/data/race-source';
import { useRaceAlerts } from '@/hooks/use-race-alerts';
import { useRaceHotkeys } from '@/hooks/use-race-hotkeys';
import { useDarkTheme } from '@/hooks/use-theme';

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

	useRaceHotkeys(openCommand);
	useRaceAlerts();

	return (
		<TooltipProvider>
			<AppHeader onOpenCommand={openCommand} />
			<main className="mx-auto max-w-screen-2xl px-4 pb-6 md:px-6">
				<Outlet />
			</main>
			<footer className="text-muted-foreground mx-auto flex max-w-screen-2xl flex-wrap justify-between gap-2 px-4 pb-8 text-xs md:px-6">
				<span>
					Unofficial. Not associated in any way with the Formula 1 companies.
					{sourceKind === 'mock'
						? ' Replay: real grid, strategies, race control and result; lap times are modelled.'
						: null}
				</span>
				<span className="hidden md:inline">← → laps · Space play · 1 2 3 pages · ⌘K jump</span>
			</footer>
			<CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
			<Toaster theme={dark ? 'dark' : 'light'} position="bottom-right" />
		</TooltipProvider>
	);
}

export function AppLayout({ source }: { source: RaceSource }) {
	return (
		<RaceProvider source={source} loadingFallback={<LoadingState />} ErrorFallback={ErrorState}>
			<Console sourceKind={source.kind} />
		</RaceProvider>
	);
}
