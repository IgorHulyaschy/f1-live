import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from 'lucide-react';

import { Key } from '@/components/console/keys';
import type { LiveConnection } from '@/data/live-feed';
import { useRace } from '@/data/race-context';
import { cn } from '@/lib/utils';

/** Previous lap, play or pause, next lap. On a live session, stepping back pauses live. */
export function Transport({ className }: { className?: string }) {
	const { race, lap, stepLap, playing, setPlaying, live } = useRace();
	const atEnd = lap >= race.currentLap || live.following;

	return (
		<div className={cn('flex', className)}>
			<Key aria-label="Previous lap" disabled={lap <= 1} onClick={() => stepLap(-1)}>
				<SkipBackIcon />
			</Key>
			<Key
				aria-label={playing ? 'Pause replay' : 'Play replay'}
				disabled={atEnd}
				pressed={playing}
				onClick={() => setPlaying(!playing)}
				className="-ml-px"
			>
				{playing ? <PauseIcon /> : <PlayIcon />}
			</Key>
			<Key aria-label="Next lap" disabled={atEnd} onClick={() => stepLap(1)} className="-ml-px">
				<SkipForwardIcon />
			</Key>
		</div>
	);
}

const CONNECTION_NOTE: Record<LiveConnection, string | null> = {
	connecting: 'Connecting',
	live: null,
	stale: 'No data for a while',
	reconnecting: 'Reconnecting'
};

/**
 * "Live" while the screen follows a running session, "Back to live" once the viewer stepped back.
 * The note under it holds its line even when empty, so a dropped connection moves nothing.
 */
export function LiveKey({ className }: { className?: string }) {
	const { live } = useRace();

	if (!live.isLive) {
		return null;
	}

	const note = CONNECTION_NOTE[live.connection];

	return (
		<div className={cn('flex flex-col items-end gap-1', className)} data-testid="live-key">
			{live.following ? (
				<span
					className={cn(
						'type-label inline-flex h-9 items-center border border-b-2 px-2.5 font-bold sm:h-7',
						note ? 'text-muted-foreground' : 'border-foreground bg-foreground text-background'
					)}
				>
					Live
				</span>
			) : (
				<Key onClick={live.backToLive}>Back to live</Key>
			)}
			<output aria-live="polite" className="type-label h-4 leading-4 whitespace-nowrap">
				{note}
			</output>
		</div>
	);
}

/** The lap as a big mono reading. Only one is rendered per page; tests read it by its test id. */
export function LapCounter({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
	const { race, lap } = useRace();
	const total = race.session.totalLaps;

	return (
		<div className="flex items-baseline gap-1.5 leading-none">
			<span className="type-label">Lap</span>
			<span className="sr-only" data-testid="lap-counter">
				Lap {lap}
				{total > 0 ? `/${total}` : null}
			</span>
			<span
				aria-hidden
				className={cn('font-mono font-bold', size === 'lg' ? 'text-4xl' : 'text-lg')}
			>
				{size === 'lg' ? String(lap).padStart(2, '0') : lap}
			</span>
			{total > 0 ? (
				<span
					aria-hidden
					className={cn('text-muted-foreground font-mono', size === 'lg' ? 'text-lg' : 'text-xs')}
				>
					/{total}
				</span>
			) : null}
		</div>
	);
}
