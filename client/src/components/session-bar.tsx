import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useRace } from '@/data/race-context';

import { TrackStatusBadge } from './track-status-badge';

const SESSION_LABEL = {
	race: 'Race',
	sprint: 'Sprint',
	qualifying: 'Qualifying',
	sprint_qualifying: 'Sprint Qualifying',
	practice: 'Practice'
} as const;

export function SessionBar() {
	const { race, snapshot, lap, setLap, stepLap, playing, setPlaying, sourceKind } = useRace();
	const year = new Date(race.session.startsAt).getUTCFullYear();

	return (
		<section
			aria-label="Session"
			className="mx-auto flex max-w-screen-2xl flex-col gap-3 px-4 pt-5 md:px-6 lg:flex-row lg:items-center lg:justify-between"
		>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				<h1 className="text-xl font-semibold tracking-tight md:text-2xl">
					{race.session.meetingName} {year}
				</h1>
				<Badge variant="outline">{SESSION_LABEL[race.session.type]}</Badge>
				{sourceKind === 'mock' ? (
					<Badge variant="secondary">Replay</Badge>
				) : (
					<Badge variant="live">Live</Badge>
				)}
				<TrackStatusBadge status={snapshot.trackStatus} />
			</div>
			<div className="flex items-center gap-3 lg:w-md">
				<div className="flex items-center">
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Previous lap"
						disabled={lap <= 1}
						onClick={() => stepLap(-1)}
					>
						<SkipBackIcon />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={playing ? 'Pause replay' : 'Play replay'}
						disabled={lap >= race.currentLap}
						onClick={() => setPlaying(!playing)}
					>
						{playing ? <PauseIcon /> : <PlayIcon />}
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Next lap"
						disabled={lap >= race.currentLap}
						onClick={() => stepLap(1)}
					>
						<SkipForwardIcon />
					</Button>
				</div>
				<Slider
					aria-label="Lap"
					min={1}
					max={race.currentLap}
					step={1}
					value={[lap]}
					onValueChange={([value]) => {
						if (value !== undefined) {
							setLap(value);
						}
					}}
				/>
				<span
					className="font-mono text-sm whitespace-nowrap tabular-nums"
					data-testid="lap-counter"
				>
					Lap {lap}
					<span className="text-muted-foreground">/{race.session.totalLaps}</span>
				</span>
			</div>
		</section>
	);
}
