import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from 'lucide-react';

import { Key } from '@/components/console/keys';
import { useRace } from '@/data/race-context';
import { cn } from '@/lib/utils';

/** Previous lap, play or pause, next lap. */
export function Transport({ className }: { className?: string }) {
	const { race, lap, stepLap, playing, setPlaying } = useRace();
	const atEnd = lap >= race.currentLap;

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

/** The lap as a big mono reading. Only one is rendered per page; tests read it by its test id. */
export function LapCounter({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
	const { race, lap } = useRace();

	return (
		<div className="flex items-baseline gap-1.5 leading-none" aria-live="polite">
			<span className="type-label">Lap</span>
			<span className="sr-only" data-testid="lap-counter">
				Lap {lap}/{race.session.totalLaps}
			</span>
			<span
				aria-hidden
				className={cn('font-mono font-bold', size === 'lg' ? 'text-4xl' : 'text-lg')}
			>
				{size === 'lg' ? String(lap).padStart(2, '0') : lap}
			</span>
			<span
				aria-hidden
				className={cn('text-muted-foreground font-mono', size === 'lg' ? 'text-lg' : 'text-xs')}
			>
				/{race.session.totalLaps}
			</span>
		</div>
	);
}
