import * as React from 'react';
import { m } from 'motion/react';
import type { TyreCompound } from '@f1-live/shared';

import { Digits } from '@/components/console/digits';
import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { ProGate } from '@/components/pro-gate';
import { TyreBadge } from '@/components/tyre-badge';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/components/ui/select';
import { useRaceView } from '@/data/race-context';
import {
	COMPOUND_NAME,
	compoundsRun,
	createPace,
	type PaceSpan,
	paceSpans,
	paceSpanText,
	paceVersus,
	WHOLE_RACE
} from '@/insights/pace';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePair } from '@/features/watch/pair-context';

const SHOWN_DRIVERS = 10;

const ANY_TYRE = 'any';

const spanKey = (span: PaceSpan) =>
	span.kind === 'race' ? 'race' : span.kind === 'stint' ? `stint-${span.stint}` : 'last';

const spanName = (span: PaceSpan) =>
	span.kind === 'race'
		? 'Whole race'
		: span.kind === 'stint'
			? `Stint ${span.stint}`
			: `Last ${plural(span.laps, 'lap')}`;

/**
 * Who is quickest over the race, one stint or the last laps, with fuel, tyre age and compound
 * taken out. Two drivers picked in the list get a verdict over the same span, and the laps both
 * drove clean beside it as a check.
 */
export function RacePace() {
	const { snapshot } = useRaceView();
	const { picked, setPair, pick } = usePair();
	const [span, setSpan] = React.useState<PaceSpan>(WHOLE_RACE.span);
	const [compound, setCompound] = React.useState<TyreCompound | null>(null);
	const [first, setFirst] = React.useState<string | null>(null);
	const filter = React.useMemo(() => ({ span, compound }), [span, compound]);
	const spans = React.useMemo(() => paceSpans(snapshot), [snapshot]);
	const compounds = React.useMemo(() => compoundsRun(snapshot), [snapshot]);
	const pace = React.useMemo(() => createPace(snapshot), [snapshot]);
	const ranked = React.useMemo(() => pace.entries(filter), [pace, filter]);

	const shown = ranked.filter(
		(entry, index) => index < SHOWN_DRIVERS || picked?.includes(entry.driver.number)
	);

	const scale = Math.max(...shown.map((entry) => entry.deltaToBestSeconds), 0.5);
	const leader = ranked[0]?.driver.code;

	const versus = React.useMemo(
		() => (picked ? paceVersus(snapshot, picked[0], picked[1], filter) : null),
		[snapshot, picked, filter]
	);

	const choose = (number: string) => {
		if (picked) {
			pick(number);
		} else if (first && first !== number) {
			setPair([first, number]);
			setFirst(null);
		} else {
			setFirst(first === number ? null : number);
		}
	};

	return (
		<Panel aria-label="Race pace" data-testid="race-pace">
			<PanelHeader title="Race pace" meta="fuel, tyre age and compound removed">
				<Select
					value={spanKey(span)}
					onValueChange={(key) => setSpan(spans.find((entry) => spanKey(entry) === key) ?? span)}
				>
					<SelectTrigger size="sm" aria-label="Span">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{spans.map((entry) => (
							<SelectItem key={spanKey(entry)} value={spanKey(entry)}>
								{spanName(entry)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={compound ?? ANY_TYRE}
					onValueChange={(value) => setCompound(compounds.find((entry) => entry === value) ?? null)}
				>
					<SelectTrigger size="sm" aria-label="Tyre">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ANY_TYRE}>Any tyre</SelectItem>
						{compounds.map((entry) => (
							<SelectItem key={entry} value={entry}>
								{COMPOUND_NAME[entry]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</PanelHeader>
			<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
				<ProGate
					feature="Race pace"
					teaser="Who is actually quickest once fuel load, tyre age and compound are taken out, in tenths per lap."
				>
					{versus ? (
						<div className="flex flex-col gap-1" data-testid="pace-verdict" aria-live="polite">
							<p className="text-base font-medium">{versus.text}</p>
						</div>
					) : (
						<p className="text-muted-foreground text-sm" data-testid="pace-hint">
							{first
								? 'Pick a second driver to compare.'
								: ranked.length === 0
									? `Not enough clean laps ${paceSpanText(filter)} yet.`
									: 'Pick two drivers to compare their pace over this span.'}
						</p>
					)}
					<ol className="flex flex-col">
						{shown.map((entry, index) => {
							const chosen = picked?.includes(entry.driver.number) || first === entry.driver.number;

							return (
								<li key={entry.driver.number} className="border-b last:border-b-0">
									<button
										type="button"
										aria-pressed={chosen}
										onClick={() => choose(entry.driver.number)}
										className={cn(
											'grid w-full grid-cols-[1.25rem_4rem_2.5rem_minmax(0,1fr)_4rem] items-center gap-3 py-1.5 text-left',
											chosen && 'bg-foreground/5'
										)}
									>
										<span className="text-muted-foreground text-right font-mono text-xs">
											{ranked.indexOf(entry) + 1}
										</span>
										<DriverTag driver={entry.driver} />
										<TyreBadge compound={entry.compounds[0] ?? 'UNKNOWN'} />
										<span className="border-rule-strong flex h-5 min-w-0 items-center border-l">
											{index === 0 ? (
												<span className="type-label pl-1 font-bold">Quickest</span>
											) : (
												<m.span
													className="bg-foreground/45 h-3 shrink-0"
													initial={{ width: 0 }}
													animate={{ width: `${(entry.deltaToBestSeconds / scale) * 100}%` }}
													transition={{ duration: 0.4, ease: 'easeOut', delay: index * 0.02 }}
												/>
											)}
										</span>
										<Digits
											className="text-right text-sm"
											value={index === 0 ? '' : `+${entry.deltaToBestSeconds.toFixed(3)}`}
										/>
									</button>
								</li>
							);
						})}
					</ol>
				</ProGate>
				<p className="text-muted-foreground text-xs">
					Seconds per lap off {leader ?? 'the quickest car'} {paceSpanText(filter)}, clean laps
					only. Bars grow from the quickest car.
				</p>
			</div>
		</Panel>
	);
}
