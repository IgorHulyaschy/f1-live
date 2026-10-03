import * as React from 'react';

import { DataTable, TableKey } from '@/components/console/data-table';
import { EmptyNote } from '@/components/console/empty-note';
import { Panel, PanelHeader } from '@/components/console/panel';
import { useRaceView } from '@/data/race-context';
import { plannedMinutes } from '@/insights/qualifying';
import {
	STORY_LANE_LABEL,
	STORY_LANES,
	type StoryLane,
	type StoryMark,
	storyMarks,
	type StoryTone
} from '@/insights/race-story';
import { teamRadioUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

import { useTileFill, useTileRows } from '../dashboard/tile-fill';

/** A tile this many grid rows tall or shorter shows the ribbon on its own, as a strip under the replay. */
const STRIP_ROWS = 4;

const TONE_CLASS: Record<StoryTone, string> = {
	green: 'bg-transparent',
	yellow: 'bg-flag/40',
	vsc: 'bg-flag/75',
	safety_car: 'bg-flag',
	red: 'bg-danger',
	SOFT: 'bg-tyre-soft',
	MEDIUM: 'bg-tyre-medium',
	HARD: 'border-tyre-hard border bg-transparent',
	INTERMEDIATE: 'bg-tyre-intermediate',
	WET: 'bg-tyre-wet',
	UNKNOWN: 'bg-muted-foreground',
	fastest: 'bg-fastest',
	lead: 'bg-foreground',
	pass: 'bg-foreground/60',
	danger: 'bg-danger',
	radio: 'bg-muted-foreground/70'
};

/** Most marks a lane stacks in one step before they fill it. */
const STACK = 4;

/** What one lane shows for one step: a band for flags, stacked blocks for the rest. */
function LaneCell({ lane, marks }: { lane: StoryLane; marks: readonly StoryMark[] }) {
	if (marks.length === 0) {
		return <span className="h-full" />;
	}

	if (lane === 'flags') {
		return <span className={cn('h-full', TONE_CLASS[marks[0]?.tone ?? 'green'])} />;
	}

	return (
		<span className="flex h-full flex-col-reverse gap-px">
			{marks.slice(0, STACK).map((mark) => (
				<span
					key={mark.id}
					className={cn(
						'min-h-0 flex-1',
						TONE_CLASS[mark.tone],
						marks.length === 1 && 'max-h-full'
					)}
				/>
			))}
		</span>
	);
}

/** A lane's marks in the table: their text, radio clips as links where the deployment allows. */
function laneCell(marks: readonly StoryMark[]): React.ReactNode {
	if (marks.length === 0) {
		return null;
	}

	return (
		<span className="flex flex-wrap gap-x-2">
			{marks.map((mark) => {
				const url = mark.clip ? teamRadioUrl(mark.clip) : null;

				return url ? (
					<a
						key={mark.id}
						href={url}
						target="_blank"
						rel="noreferrer"
						className="underline underline-offset-2"
					>
						{mark.text}
					</a>
				) : (
					<span key={mark.id}>{mark.text}</span>
				);
			})}
		</span>
	);
}

function stepWord(unit: 'lap' | 'minute', step: number): string {
	return unit === 'lap' ? `Lap ${step}` : `Minute ${step}`;
}

/**
 * The race told in lanes, one column per lap (or per minute on the clock): flags, the lead and
 * fastest lap, passes made on track, stops in the colour of the tyres fitted, penalties, cars out
 * and team radio. Clicking a column takes the replay there. In a short tile it is a thin strip
 * for under the replay keys; in a tall one it lists the key moments too.
 */
export function StoryRibbon() {
	const { race, snapshot, lap, setLap, steps, stepUnit } = useRaceView();
	const fill = useTileFill();
	const rows = useTileRows();
	const compact = rows !== null && rows <= STRIP_ROWS;
	const [table, setTable] = React.useState(false);
	const [hovered, setHovered] = React.useState<number | null>(null);

	const marks = React.useMemo(() => storyMarks(snapshot), [snapshot]);
	const timed = stepUnit === 'minute';
	const total = timed ? Math.max(steps, plannedMinutes(race.session.type)) : race.session.totalLaps;
	const done = timed ? steps : race.currentLap;

	const byStep = React.useMemo(() => {
		const grouped = new Map<number, StoryMark[]>();

		for (const mark of marks) {
			grouped.set(mark.step, [...(grouped.get(mark.step) ?? []), mark]);
		}

		return grouped;
	}, [marks]);

	const lanes = STORY_LANES.filter(
		(lane) => marks.some((mark) => mark.lane === lane) || lane === 'flags' || lane === 'stops'
	).filter((lane) => !(timed && (lane === 'passes' || lane === 'stops')));

	const shownStep = hovered ?? lap;
	const shown = byStep.get(shownStep) ?? [];

	const moments = marks
		.filter(
			(mark, index) =>
				mark.lane !== 'passes' &&
				mark.lane !== 'radio' &&
				!(
					mark.lane === 'flags' &&
					marks
						.slice(0, index)
						.some(
							(earlier) =>
								earlier.lane === 'flags' &&
								earlier.tone === mark.tone &&
								earlier.step === mark.step - 1
						)
				)
		)
		.toReversed();

	if (total === 0) {
		return (
			<Panel aria-label="Race story" className={cn(fill && 'h-full')}>
				<PanelHeader title="Story" />
				<EmptyNote />
			</Panel>
		);
	}

	const ribbon = (
		<div className="flex min-w-0 flex-col gap-1" data-testid="story-ribbon">
			<div
				className={cn('grid gap-x-2', compact ? 'grid-cols-1' : 'grid-cols-[auto_minmax(0,1fr)]')}
			>
				<div className={cn('flex flex-col gap-px', compact && 'hidden')} aria-hidden>
					{lanes.map((lane) => (
						<span key={lane} className="type-label flex h-4 items-center leading-none">
							{STORY_LANE_LABEL[lane]}
						</span>
					))}
				</div>
				<fieldset className="relative flex min-w-0 gap-px">
					<legend className="sr-only">{timed ? 'Session minutes' : 'Race laps'}</legend>
					{Array.from({ length: total }, (_, index) => {
						const step = index + 1;
						const stepMarks = byStep.get(step) ?? [];
						const summary = stepMarks.map((mark) => mark.text).join('; ');

						return (
							<button
								key={step}
								type="button"
								tabIndex={-1}
								disabled={step > done}
								onClick={() => setLap(step)}
								onMouseEnter={() => setHovered(step)}
								onMouseLeave={() => setHovered(null)}
								aria-label={`Story, ${stepWord(stepUnit, step).toLowerCase()}${summary ? `: ${summary}` : ''}`}
								title={`${stepWord(stepUnit, step)}${summary ? `: ${summary}` : ''}`}
								className={cn(
									'group relative flex min-w-0 flex-1 cursor-pointer flex-col gap-px disabled:cursor-default',
									step > lap && 'opacity-25'
								)}
								data-testid={`story-step-${step}`}
							>
								{lanes.map((lane) => (
									<span
										key={lane}
										className={cn(
											'bg-foreground/5 group-hover:bg-foreground/15 flex flex-col',
											compact ? 'h-1' : 'h-4'
										)}
									>
										<LaneCell lane={lane} marks={stepMarks.filter((mark) => mark.lane === lane)} />
									</span>
								))}
								{step === lap ? (
									<span aria-hidden className="bg-focus absolute -inset-y-0.5 -left-px w-0.5" />
								) : null}
							</button>
						);
					})}
				</fieldset>
			</div>
			<p className={cn('min-h-4 truncate text-xs', compact && 'hidden')}>
				<span className="type-label mr-2">{stepWord(stepUnit, shownStep)}</span>
				{shown.length > 0 ? shown.map((mark) => mark.text).join('; ') : 'Nothing marked.'}
			</p>
		</div>
	);

	return (
		<div className={cn('min-w-0', fill && 'h-full')} data-testid="story">
			{compact ? (
				<section
					aria-label="Race story"
					className="flex h-full min-w-0 flex-col justify-end gap-1 py-1"
				>
					<span className="type-label">Story</span>
					{ribbon}
				</section>
			) : (
				<Panel aria-label="Race story" className={cn('min-h-0', fill && 'h-full')}>
					<PanelHeader title="Story" meta={`${marks.length} moments`}>
						<TableKey table={table} onTableChange={setTable} />
					</PanelHeader>
					<div className={cn('flex flex-col gap-3 p-4', fill && 'min-h-0 flex-1')}>
						{table ? (
							<DataTable
								caption="What happened, step by step"
								className={cn(fill && 'flex-1')}
								columns={[
									{ key: 'step', label: timed ? 'Minute' : 'Lap' },
									...lanes.map((lane) => ({ key: lane, label: STORY_LANE_LABEL[lane] }))
								]}
								rows={[...byStep]
									.toSorted((a, b) => a[0] - b[0])
									.map(([step, stepMarks]) => ({
										id: String(step),
										step: (
											<button
												type="button"
												className="font-mono underline-offset-2 hover:underline"
												onClick={() => setLap(step)}
											>
												{timed ? `${step}m` : `L${step}`}
											</button>
										),
										...Object.fromEntries(
											lanes.map((lane) => [
												lane,
												laneCell(stepMarks.filter((mark) => mark.lane === lane))
											])
										)
									}))}
							/>
						) : (
							ribbon
						)}
						{!table && moments.length > 0 ? (
							<ol
								className={cn(
									'flex flex-col overflow-y-auto',
									fill ? 'min-h-0 flex-1' : 'max-h-96'
								)}
								aria-label="Key moments, latest first"
							>
								{moments.map((mark) => (
									<li key={mark.id} className="border-b last:border-b-0">
										<button
											type="button"
											onClick={() => setLap(mark.step)}
											className="hover:bg-accent flex w-full items-center gap-3 py-1.5 text-left text-sm"
										>
											<span className="text-muted-foreground w-10 shrink-0 font-mono text-xs">
												{timed ? `${mark.step}m` : `L${mark.step}`}
											</span>
											<span aria-hidden className={cn('h-3 w-1 shrink-0', TONE_CLASS[mark.tone])} />
											<span className="min-w-0 truncate">{mark.text}</span>
										</button>
									</li>
								))}
							</ol>
						) : null}
					</div>
				</Panel>
			)}
		</div>
	);
}
