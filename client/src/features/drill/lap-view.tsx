import type { RaceSnapshot } from '@f1-live/shared';
import { ChevronLeftIcon, ChevronRightIcon, LocateFixedIcon } from 'lucide-react';
import * as React from 'react';

import { EmptyNote } from '@/components/console/empty-note';
import { Key, KeyGroup } from '@/components/console/keys';
import { Field } from '@/components/console/panel';
import { TrackStatusBadge } from '@/components/track-status-badge';
import { TyreBadge } from '@/components/tyre-badge';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select';
import { useSessionTelemetry } from '@/data/telemetry-context';
import type { SessionTelemetry } from '@/data/telemetry-source';
import { LapTraces } from '@/features/analysis/telemetry-panel';
import { type LapChoice, lapChoices } from '@/features/analysis/telemetry-selection';
import { type DriverLap, driverLaps } from '@/insights/driver-session';
import { isTimedSession } from '@/insights/qualifying';
import { formatGap, formatLapTime, formatSectorTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import { MARK_TEXT, Section, useDrillSession, useJumpTo } from './drill-parts';
import type { DrillView } from './drill-url';
import { LapNotes, LapTimeText } from './driver-view';
import { useDrill } from './use-drill';

const SECTORS = [0, 1, 2] as const;

/** No driver to compare with, in the picker. */
const NOBODY = 'none';

type LapDrill = Extract<DrillView, { kind: 'lap' }>;

function LapFacts({ entry, timed }: { entry: DriverLap; timed: boolean }) {
	const { lap } = entry;

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap gap-y-3 divide-x" data-testid="lap-facts">
				<Field label="Lap time" className="pr-4">
					<span className="text-lg">
						<LapTimeText entry={entry} />
					</span>
				</Field>
				{SECTORS.map((index) => (
					<Field key={index} label={`S${index + 1}`} className="px-4">
						<span className={cn('font-mono', MARK_TEXT[entry.sectorMarks[index]])}>
							{lap.sectorTimesMs[index] > 0 ? formatSectorTime(lap.sectorTimesMs[index]) : '-'}
						</span>
					</Field>
				))}
			</div>
			<div className="flex flex-wrap gap-y-3 divide-x">
				<Field label="Tyre" className="pr-4">
					<TyreBadge compound={lap.compound} age={lap.tyreAge} />
				</Field>
				<Field label="Position" className="px-4">
					<span className="font-mono">{lap.position > 0 ? `P${lap.position}` : '-'}</span>
				</Field>
				{timed ? null : (
					<Field label="Gap" className="px-4">
						<span className="font-mono">
							{lap.position === 1 ? 'Leader' : formatGap(lap.gapToLeaderMs)}
						</span>
					</Field>
				)}
				<Field label="Track" className="px-4">
					<TrackStatusBadge status={lap.trackStatus} />
				</Field>
				<div className="flex items-end px-4">
					<LapNotes entry={entry} flag={false} />
				</div>
			</div>
		</div>
	);
}

/** Who and which lap this one is traced against: another driver's best by default. */
function ComparePicker({
	view,
	snapshot,
	session
}: {
	view: LapDrill;
	snapshot: RaceSnapshot;
	session: SessionTelemetry;
}) {
	const { open } = useDrill();
	const vs = view.vs;

	const choices = vs
		? lapChoices(snapshot, session.index.laps, vs.driverNumber, session.circuit.lengthM)
		: [];

	const lapValue = vs?.lap ?? choices.find((choice) => choice.fastest)?.lap.lap;

	return (
		<div className="flex flex-wrap items-center gap-2">
			<span className="type-label">Compare with</span>
			<Select
				value={vs?.driverNumber ?? NOBODY}
				onValueChange={(driverNumber) =>
					open({
						...view,
						vs: driverNumber === NOBODY ? null : { driverNumber, lap: null }
					})
				}
			>
				<SelectTrigger size="sm" aria-label="Compare with driver">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={NOBODY}>Nobody</SelectItem>
					{snapshot.drivers.map((driver) => (
						<SelectItem key={driver.number} value={driver.number}>
							{driver.code}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{vs && choices.length > 0 ? (
				<Select
					value={lapValue === undefined ? undefined : String(lapValue)}
					onValueChange={(lap) => open({ ...view, vs: { ...vs, lap: Number(lap) } })}
				>
					<SelectTrigger size="sm" aria-label="Compare with lap">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{choices.map((choice) => (
							<SelectItem key={choice.lap.lap} value={String(choice.lap.lap)}>
								L{choice.lap.lap} {formatLapTime(choice.lap.lapTimeMs)}
								{choice.fastest ? ' best' : ''}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			) : null}
		</div>
	);
}

type TraceView = 'traces' | 'mini';

function LapTelemetry({ view, snapshot }: { view: LapDrill; snapshot: RaceSnapshot }) {
	const telemetry = useSessionTelemetry();
	const [shown, setShown] = React.useState<TraceView>('traces');

	const chosen = React.useMemo((): LapChoice[] => {
		if (telemetry.status !== 'ready') {
			return [];
		}

		const { index, circuit } = telemetry.value;

		const ofDriver = (driverNumber: string) =>
			lapChoices(snapshot, index.laps, driverNumber, circuit.lengthM);

		const own = ofDriver(view.driverNumber).find((choice) => choice.lap.lap === view.lap);

		if (!own) {
			return [];
		}

		const vs = view.vs;

		const other = vs
			? ofDriver(vs.driverNumber).find((choice) =>
					vs.lap === null ? choice.fastest : choice.lap.lap === vs.lap
				)
			: undefined;

		return other ? [own, other] : [own];
	}, [telemetry, snapshot, view]);

	if (telemetry.status === 'loading') {
		return null;
	}

	if (telemetry.status !== 'ready') {
		return (
			<Section title="Telemetry">
				<EmptyNote className="px-0">This session has no telemetry.</EmptyNote>
			</Section>
		);
	}

	return (
		<Section
			title="Telemetry"
			actions={
				<KeyGroup<TraceView>
					label="Telemetry shown"
					options={[
						{ value: 'traces', label: 'Traces' },
						{ value: 'mini', label: 'Mini sectors' }
					]}
					value={shown}
					onChange={setShown}
				/>
			}
			testId="lap-telemetry"
		>
			<ComparePicker view={view} snapshot={snapshot} session={telemetry.value} />
			{chosen.length === 0 ? (
				<EmptyNote className="px-0">
					This lap has no telemetry that runs line to line; out-laps and in-laps have none.
				</EmptyNote>
			) : (
				<div className="flex flex-col gap-3">
					<LapTraces chosen={chosen} session={telemetry.value} table={shown === 'mini'} />
				</div>
			)}
		</Section>
	);
}

/** One lap: its sectors, its state, the traces, and another driver's lap beside it. */
export function LapView({ view }: { view: LapDrill }) {
	const snapshot = useDrillSession();
	const { open } = useDrill();
	const jumpTo = useJumpTo();

	const laps = React.useMemo(
		() => driverLaps(snapshot, view.driverNumber),
		[snapshot, view.driverNumber]
	);

	const index = laps.findIndex((entry) => entry.lap.lap === view.lap);
	const entry = laps[index];
	const previous = laps[index - 1];
	const next = laps[index + 1];

	if (!entry) {
		return (
			<EmptyNote className="p-4">This lap has not been run by this point of the session.</EmptyNote>
		);
	}

	const go = (target: DriverLap) => open({ ...view, lap: target.lap.lap });

	return (
		<div className="flex flex-col gap-6 p-4" data-testid="lap-view">
			<div className="flex flex-wrap items-center gap-2">
				<Key
					aria-label="Their lap before"
					disabled={!previous}
					onClick={() => previous && go(previous)}
				>
					<ChevronLeftIcon aria-hidden />
				</Key>
				<Key
					aria-label="Their lap after"
					disabled={!next}
					onClick={() => next && go(next)}
					className="-ml-px"
				>
					<ChevronRightIcon aria-hidden />
				</Key>
				<Key
					onClick={() => jumpTo({ lap: entry.lap.lap, at: entry.lap.completedAt })}
					title="Move the replay to the end of this lap"
				>
					<LocateFixedIcon aria-hidden />
					Show on the timeline
				</Key>
			</div>
			<LapFacts entry={entry} timed={isTimedSession(snapshot.session.type)} />
			<LapTelemetry view={view} snapshot={snapshot} />
		</div>
	);
}
