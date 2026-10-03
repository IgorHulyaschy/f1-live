import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from 'lucide-react';

import { Key } from '@/components/console/keys';
import type { LiveConnection } from '@/data/live-feed';
import { useRaceView } from '@/data/race-context';
import { stepDelay } from '@/data/viewer-settings';
import { sessionMinutes } from '@/insights/qualifying';
import { cn } from '@/lib/utils';

/** Previous lap, play or pause, next lap. On a live session, stepping back pauses live. */
export function Transport({ className }: { className?: string }) {
	const { lap, steps, stepUnit, stepLap, playing, setPlaying, live } = useRaceView();
	const atEnd = lap >= steps || live.following;
	const unit = stepUnit === 'lap' ? 'lap' : 'minute';

	return (
		<div className={cn('flex', className)}>
			<Key aria-label={`Previous ${unit}`} disabled={lap <= 1} onClick={() => stepLap(-1)}>
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
			<Key
				aria-label={`Next ${unit}`}
				disabled={atEnd}
				onClick={() => stepLap(1)}
				className="-ml-px"
			>
				<SkipForwardIcon />
			</Key>
		</div>
	);
}

const CONNECTION_LABEL: Record<LiveConnection, string> = {
	connecting: 'Connecting',
	live: 'Live',
	stale: 'Data stale',
	reconnecting: 'Reconnecting'
};

/**
 * "Live" while the screen follows a running session, lit only while data flows; "Back to live"
 * once the viewer stepped back. It keeps one width whatever it says, so nothing around it moves
 * when the connection drops.
 */
export function LiveKey({ className }: { className?: string }) {
	const { live } = useRaceView();

	if (!live.isLive) {
		return null;
	}

	const width = 'w-30 justify-center';

	if (!live.following) {
		return (
			<Key onClick={live.backToLive} className={cn(width, className)}>
				Back to live
			</Key>
		);
	}

	const flowing = live.connection === 'live';

	return (
		<output
			aria-live="polite"
			data-testid="live-key"
			className={cn(
				'type-label inline-flex h-9 items-center border border-b-2 font-bold sm:h-7',
				width,
				flowing
					? 'border-foreground bg-foreground text-background'
					: 'text-muted-foreground border-dashed',
				className
			)}
		>
			{CONNECTION_LABEL[live.connection]}
		</output>
	);
}

const DELAY_STEPS = [
	{ step: -1, label: '−1', name: 'One second less delay' },
	{ step: -0.1, label: '−.1', name: 'A tenth less delay' },
	{ step: 0.1, label: '+.1', name: 'A tenth more delay' },
	{ step: 1, label: '+1', name: 'One second more delay' }
] as const;

/**
 * Holds the live screen back so it matches the viewer's TV. The steps follow the common
 * one-second and tenth keys; joining late with a delay set is in step at once.
 */
export function DelayControl({ className }: { className?: string }) {
	const { live } = useRaceView();

	if (!live.isLive) {
		return null;
	}

	const keys = (from: number, to: number) =>
		DELAY_STEPS.slice(from, to).map((entry, index) => (
			<Key
				key={entry.step}
				aria-label={entry.name}
				onClick={() => live.setDelaySeconds(stepDelay(live.delaySeconds, entry.step))}
				disabled={entry.step < 0 && live.delaySeconds === 0}
				className={cn('px-1.5 font-mono sm:px-1.5', index > 0 && '-ml-px')}
			>
				{entry.label}
			</Key>
		));

	return (
		<fieldset className={cn('flex items-end gap-2', className)}>
			<legend className="sr-only">Broadcast delay</legend>
			<div className="flex flex-col">
				<span className="type-label">Delay</span>
				<output data-testid="delay" className="w-14 font-mono text-sm leading-6 font-bold">
					{live.delaySeconds.toFixed(1)}s
				</output>
			</div>
			<div className="flex">{keys(0, 2)}</div>
			<div className="flex">{keys(2, 4)}</div>
		</fieldset>
	);
}

/**
 * The lap as a big mono reading; in practice and qualifying, the minute of the session. Only one
 * is rendered per page; tests read it by its test id.
 */
export function LapCounter({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
	const { race, lap, stepUnit, steps } = useRaceView();
	const label = stepUnit === 'lap' ? 'Lap' : 'Min';

	const total =
		stepUnit === 'lap' ? race.session.totalLaps : sessionMinutes(race.session.type, steps);

	return (
		<div className="flex items-baseline gap-1.5 leading-none">
			<span className="type-label">{label}</span>
			<span className="sr-only" data-testid="lap-counter">
				{label} {lap}
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
