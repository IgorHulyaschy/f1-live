import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from 'lucide-react';

import { Key } from '@/components/console/keys';
import { useRaceView } from '@/data/race-context';
import { stepDelay } from '@/data/viewer-settings';
import { sessionMinutes } from '@/insights/qualifying';
import { cn } from '@/lib/utils';

/** What the play key does now, for the key and for Space. */
type PlayAction = { label: string; playing: boolean; disabled: boolean; press: () => void };

/**
 * Play and pause, live included: following a live session counts as playing, so pausing holds the
 * lap on screen, and playing from the newest lap goes back to live.
 */
export function usePlayAction(): PlayAction {
	const { lap, steps, setLap, playing, setPlaying, live } = useRaceView();

	if (live.isLive && live.following) {
		return { label: 'Pause live', playing: true, disabled: false, press: () => setLap(lap) };
	}

	if (live.isLive && lap >= steps) {
		return { label: 'Play replay', playing: false, disabled: false, press: live.backToLive };
	}

	return {
		label: playing ? 'Pause replay' : 'Play replay',
		playing,
		disabled: lap >= steps,
		press: () => setPlaying(!playing)
	};
}

/**
 * Live or not, in one key that keeps its place and its size: lit while the screen follows the
 * session, and the way back to it once the viewer steps back. A feed that drops leaves it unlit
 * and dashed; the bar says why.
 */
export function LiveKey({ className }: { className?: string }) {
	const { live } = useRaceView();

	if (!live.isLive) {
		return null;
	}

	const connected = live.connection === 'live';

	return (
		<Key
			pressed={live.following && connected}
			aria-disabled={live.following}
			onClick={live.following ? undefined : live.backToLive}
			title={live.following ? 'Following the session live' : 'Back to live (L)'}
			data-testid="live-key"
			className={cn(
				'w-20 justify-center font-black italic',
				live.following && 'cursor-default',
				live.following && !connected && 'border-dashed',
				className
			)}
		>
			{live.following ? 'Live' : 'Go live'}
		</Key>
	);
}

/**
 * Previous lap, play or pause, next lap and, on a live session, the live key, in one group that
 * keeps its place whether the screen follows live or not.
 */
export function Transport({
	className,
	live: withLive = true
}: {
	className?: string;
	/** Leaves the live key out, for a bar that places it itself. */
	live?: boolean;
}) {
	const { lap, steps, stepUnit, stepLap, live } = useRaceView();
	const play = usePlayAction();
	const atEnd = lap >= steps || live.following;
	const unit = stepUnit === 'lap' ? 'lap' : 'minute';

	return (
		<div className={cn('flex', className)}>
			<Key aria-label={`Previous ${unit}`} disabled={lap <= 1} onClick={() => stepLap(-1)}>
				<SkipBackIcon />
			</Key>
			<Key
				aria-label={play.label}
				title={`${play.label} (Space)`}
				disabled={play.disabled}
				pressed={play.playing}
				onClick={play.press}
				className="-ml-px"
			>
				{play.playing ? <PauseIcon /> : <PlayIcon />}
			</Key>
			<Key
				aria-label={`Next ${unit}`}
				disabled={atEnd}
				onClick={() => stepLap(1)}
				className="-ml-px"
			>
				<SkipForwardIcon />
			</Key>
			{withLive ? <LiveKey className="ml-2" /> : null}
		</div>
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
 * The minute of a practice or qualifying session as a mono reading. A race's lap is on the
 * live strip, so the page prints it once; tests read it by its test id.
 */
export function LapCounter() {
	const { race, lap, stepUnit, steps } = useRaceView();

	if (stepUnit === 'lap') {
		return null;
	}

	const total = sessionMinutes(race.session.type, steps);

	return (
		<div className="flex items-baseline gap-1.5 leading-none">
			<span className="type-label">Min</span>
			<span className="sr-only" data-testid="lap-counter">
				Min {lap}/{total}
			</span>
			<span aria-hidden className="font-mono text-lg font-bold">
				{lap}
			</span>
			<span aria-hidden className="text-muted-foreground font-mono text-xs">
				/{total}
			</span>
		</div>
	);
}
