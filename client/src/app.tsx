import { Outlet } from 'react-router';

import { AppHeader } from '@/components/app-header';
import { SessionBar } from '@/components/session-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { RaceProvider } from '@/data/race-context';
import type { RaceSource } from '@/data/race-source';

function LoadingState() {
	return (
		<div className="mx-auto flex max-w-screen-2xl flex-col gap-4 p-6" aria-busy>
			<Skeleton className="h-8 w-72" />
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

export function AppLayout({ source }: { source: RaceSource }) {
	return (
		<RaceProvider source={source} loadingFallback={<LoadingState />} ErrorFallback={ErrorState}>
			<AppHeader />
			<SessionBar />
			<main className="mx-auto max-w-screen-2xl p-4 md:px-6">
				<Outlet />
			</main>
			<footer className="text-muted-foreground mx-auto max-w-screen-2xl px-4 pb-8 text-xs md:px-6">
				This website is unofficial and is not associated in any way with the Formula 1 companies.
				{source.kind === 'mock'
					? ' Replay: real grid, strategies, race control and result; lap times are modelled.'
					: null}
			</footer>
		</RaceProvider>
	);
}
