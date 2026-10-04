import * as React from 'react';

import { Digits } from '@/components/console/digits';
import { EmptyNote } from '@/components/console/empty-note';
import { Field, Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { TyreBadge } from '@/components/tyre-badge';
import { useRace } from '@/data/race-context';
import { DriverLink } from '@/features/drill/drill-parts';
import { useScreenTime } from '@/hooks/use-screen-time';
import {
	gapToCut,
	gapToPole,
	improvements,
	type Knockout,
	knockout,
	onTrack,
	partTime
} from '@/insights/knockout';
import { cutLines } from '@/insights/qualifying';
import { OUT_LABEL, type StandingRow } from '@/insights/standings';
import { formatGap, formatLapTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import { MiniSectors } from './mini-sectors';

const SHOWN_IMPROVEMENTS = 5;

/** +0.123 behind, −0.123 ahead. */
export function formatSignedGap(ms: number): string {
	return ms < 0 ? `−${(-ms / 1000).toFixed(3)}` : formatGap(ms);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section aria-label={title} className="border-b">
			<h3 className="type-label px-4 pt-2.5 pb-1">{title}</h3>
			{children}
		</section>
	);
}

/** Whether a car can still escape: out on track, or back in the garage. */
function RunState({ row, out }: { row: StandingRow; out: boolean }) {
	if (row.out) {
		return <span className="type-label text-danger font-bold">{OUT_LABEL[row.out]}</span>;
	}

	return out ? (
		<span className="type-label text-foreground font-bold">On track</span>
	) : (
		<span className="type-label">Garage</span>
	);
}

function DropZone({ state, onTrackNow }: { state: Knockout; onTrackNow: ReadonlySet<string> }) {
	const { followedDriver } = useRace();
	const part = state.part ?? 1;

	return (
		<Section title={`${state.prefix}${part} drop zone: out if it ended now`}>
			<table className="w-full text-sm" data-testid="drop-zone">
				<thead className="sr-only">
					<tr>
						<th scope="col">Position</th>
						<th scope="col">Driver</th>
						<th scope="col">To the cut</th>
						<th scope="col">Run</th>
						<th scope="col">Tyre</th>
					</tr>
				</thead>
				<tbody>
					{state.dropZone.map((row) => {
						const gap = gapToCut(row, state);

						return (
							<tr
								key={row.driver.number}
								data-state={row.driver.number === followedDriver ? 'selected' : undefined}
								className="data-[state=selected]:bg-accent h-8 border-t first:border-t-0"
							>
								<td className="text-danger w-10 pl-4 font-mono text-sm font-bold">
									{row.position}
								</td>
								<td>
									<DriverLink driver={row.driver}>
										<DriverTag driver={row.driver} />
									</DriverLink>
								</td>
								<td className="pr-3 text-right">
									{gap === null ? (
										<span className="type-label">No time</span>
									) : (
										<Digits value={formatSignedGap(gap)} />
									)}
								</td>
								<td className="hidden pr-3 @xs:table-cell">
									<RunState row={row} out={onTrackNow.has(row.driver.number)} />
								</td>
								<td className="pr-4 text-right">
									{row.compound ? <TyreBadge compound={row.compound} age={row.tyreAge} /> : null}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</Section>
	);
}

/** After a part: who went out in it, with the time they were short by. */
function KnockedOut({ rows }: { rows: readonly StandingRow[] }) {
	const { snapshot } = useRace();
	const lines = cutLines(snapshot, rows.length).filter((line) => line.settled);

	if (lines.length === 0) {
		return null;
	}

	// The lines come latest part first: Q2's cut above Q1's.
	return lines.map((line, index) => {
		const part = lines.length - index;
		const until = lines[index + 1]?.after ?? rows.length;
		const out = rows.slice(line.after, until);
		const cut = rows[line.after - 1];
		const cutTime = cut ? partTime(cut, part) : null;

		return (
			<Section key={line.label} title={line.label}>
				<ol className="flex flex-col px-4 pb-1.5">
					{out.map((row) => {
						const own = partTime(row, part);

						return (
							<li key={row.driver.number} className="flex items-center gap-3 py-1 text-sm">
								<span className="text-muted-foreground w-5 text-right font-mono text-xs">
									{row.position}
								</span>
								<DriverLink driver={row.driver}>
									<DriverTag driver={row.driver} />
								</DriverLink>
								<span className="ml-auto">
									{own === null || cutTime === null ? (
										<span className="type-label">{row.out ? OUT_LABEL[row.out] : 'No time'}</span>
									) : (
										<Digits value={formatSignedGap(own - cutTime)} />
									)}
								</span>
							</li>
						);
					})}
				</ol>
			</Section>
		);
	});
}

/**
 * Qualifying as it stands: pole, the time to beat at the cut, the followed driver's place
 * between them, the cars in the drop zone and who just improved.
 */
export function KnockoutPanel() {
	const { snapshot, standings, followedDriver } = useRace();
	const time = useScreenTime();
	const state = knockout(snapshot, standings);
	const found = React.useMemo(() => improvements(snapshot), [snapshot]);

	if (!state || state.part === null || standings.every((row) => row.bestLapMs === null)) {
		return (
			<Panel aria-label="Knockout" data-testid="knockout">
				<PanelHeader title="Knockout" />
				<EmptyNote />
			</Panel>
		);
	}

	const part = state.part;
	const label = `${state.prefix}${part}`;
	const you = standings.find((row) => row.driver.number === followedDriver);
	const youToCut = you ? gapToCut(you, state) : null;
	const youToPole = you ? gapToPole(you, state) : null;
	const poleTime = state.pole ? partTime(state.pole, part) : null;
	const cutTime = state.cutRow ? partTime(state.cutRow, part) : null;
	const onTrackNow = onTrack(snapshot, standings, time);
	const meta = state.finished ? 'Final' : `${label} ${state.running ? 'running' : 'over'}`;
	const showToCut = youToCut !== null && state.cutRow !== null;
	const showToPole = !showToCut && youToPole !== null && youToPole > 0;
	const recent = found.filter((entry) => entry.part === part).slice(0, SHOWN_IMPROVEMENTS);

	return (
		<Panel aria-label="Knockout" data-testid="knockout">
			<PanelHeader title="Knockout" meta={meta} />
			<div className="grid grid-cols-2 border-b @md:grid-cols-3 @md:divide-x">
				<Field label={part === 3 ? 'Pole' : `${label} fastest`} className="px-4 py-2">
					{state.pole ? (
						<span className="flex items-center gap-2">
							<DriverLink driver={state.pole.driver}>
								<DriverTag driver={state.pole.driver} />
							</DriverLink>
							{poleTime === null ? null : <Digits value={formatLapTime(poleTime)} />}
						</span>
					) : (
						'-'
					)}
				</Field>
				{state.cutRow ? (
					<Field label={`Cut, P${state.cutAfter}`} className="px-4 py-2">
						<span className="flex items-center gap-2">
							<DriverLink driver={state.cutRow.driver}>
								<DriverTag driver={state.cutRow.driver} />
							</DriverLink>
							{cutTime === null ? null : <Digits value={formatLapTime(cutTime)} />}
						</span>
					</Field>
				) : null}
				{you ? (
					<Field
						label={you.out ? 'You' : `You, P${you.position}`}
						className="col-span-2 border-t px-4 py-2 @md:col-span-1 @md:border-t-0"
					>
						<span className="flex items-center gap-2" data-testid="knockout-you">
							<DriverLink driver={you.driver}>
								<DriverTag driver={you.driver} />
							</DriverLink>
							{showToCut ? (
								<span className="text-xs">
									<Digits value={formatSignedGap(youToCut)} /> to cut
								</span>
							) : null}
							{showToPole ? (
								<span className="text-xs">
									<Digits value={formatGap(youToPole)} /> to P1
								</span>
							) : null}
						</span>
					</Field>
				) : null}
			</div>
			{state.dropZone.length > 0 ? (
				<DropZone state={state} onTrackNow={onTrackNow} />
			) : (
				<KnockedOut rows={standings} />
			)}
			<Section title="Improvements">
				{recent.length === 0 ? (
					<p className="text-muted-foreground px-4 pb-2.5 text-sm">
						No times improved yet in {label}.
					</p>
				) : (
					<ol className="flex flex-col px-4 pb-1.5" data-testid="improvements">
						{recent.map((entry) => {
							const ago = Math.max(0, time - Date.parse(entry.lap.completedAt ?? ''));

							return (
								<li
									key={`${entry.driver.number}-${entry.lap.lap}`}
									className="grid grid-cols-[2.5rem_3.5rem_minmax(0,1fr)_auto] items-center gap-2 py-1 text-sm @sm:grid-cols-[2.5rem_3.5rem_4.5rem_minmax(0,1fr)_auto]"
								>
									<span className="type-label">
										{ago < 60_000 ? 'Now' : `${Math.floor(ago / 60_000)} min`}
									</span>
									<DriverLink driver={entry.driver}>
										<DriverTag driver={entry.driver} />
									</DriverLink>
									<span className="font-mono text-xs">
										{entry.from === null ? 'New' : `P${entry.from}`} → P{entry.to}
									</span>
									<span className="hidden @sm:block">
										<MiniSectors lap={entry.lap} marks={entry.marks} timed />
									</span>
									<Digits
										value={formatLapTime(entry.lap.lapTimeMs)}
										className={cn('text-right', entry.fastest && 'text-fastest')}
									/>
								</li>
							);
						})}
					</ol>
				)}
			</Section>
		</Panel>
	);
}
