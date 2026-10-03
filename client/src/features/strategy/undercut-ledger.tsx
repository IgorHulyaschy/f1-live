import * as React from 'react';

import { Digits } from '@/components/console/digits';
import { EmptyNote } from '@/components/console/empty-note';
import { Field, Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { ProGate } from '@/components/pro-gate';
import { RaceOnly } from '@/components/race-only';
import { useRaceView } from '@/data/race-context';
import { type ExchangeOutcome, type StopExchange, stopExchanges } from '@/insights/undercut';
import { cn } from '@/lib/utils';

const OUTCOME_TEXT: Record<ExchangeOutcome, string> = {
	gained: 'Gained the place',
	lost: 'Lost the place',
	kept: 'Kept the place',
	stayed: 'Stayed behind'
};

/** "1.6 s behind" or "2.3 s ahead" of the rival. */
function gapText(gapMs: number): string {
	return `${(Math.abs(gapMs) / 1000).toFixed(1)} s ${gapMs > 0 ? 'behind' : 'ahead'}`;
}

function signed(ms: number): string {
	return `${ms > 0 ? '+' : ms < 0 ? '−' : ''}${(Math.abs(ms) / 1000).toFixed(2)}`;
}

/**
 * One exchange as a ledger: the gap before, each phase's gain or loss, and the gap after. Bars
 * run on one scale, ahead of the rival to the right: a phase's bar starts where the gap stood and
 * ends where it left it.
 */
function Ledger({ exchange }: { exchange: StopExchange }) {
	const { snapshot } = useRaceView();
	const driver = snapshot.drivers.find((entry) => entry.number === exchange.driverNumber);
	const rival = snapshot.drivers.find((entry) => entry.number === exchange.rivalNumber);
	// Ahead is positive on the bars: the ledger's own sign is time lost.
	const totals = [-exchange.gapBeforeMs];

	for (const step of exchange.steps) {
		totals.push((totals.at(-1) ?? 0) - step.ms);
	}

	const reach = Math.max(1000, ...totals.map(Math.abs));
	const at = (ms: number) => `${50 + (ms / reach) * 48}%`;

	const rows = [
		{
			label: 'Gap before',
			from: 0,
			to: totals[0] ?? 0,
			value: gapText(exchange.gapBeforeMs),
			total: true
		},
		...exchange.steps.map((step, index) => ({
			label: step.label,
			from: totals[index] ?? 0,
			to: totals[index + 1] ?? 0,
			value: signed(step.ms),
			total: false
		})),
		{
			label: 'Gap after',
			from: 0,
			to: totals.at(-1) ?? 0,
			value: gapText(exchange.gapAfterMs),
			total: true
		}
	];

	return (
		<article
			className="flex flex-col gap-2 border-b py-3 last:border-b-0"
			data-testid="undercut-exchange"
		>
			<header className="flex flex-wrap items-end gap-x-4 gap-y-2">
				<Field label={`In L${exchange.stopLap}`}>
					{driver ? <DriverTag driver={driver} /> : exchange.driverNumber}
				</Field>
				<Field label={`Answers L${exchange.rivalStopLap}`}>
					{rival ? <DriverTag driver={rival} /> : exchange.rivalNumber}
				</Field>
				<Field label="Places">
					P{exchange.positionBefore} to P{exchange.positionAfter}
				</Field>
				<span
					className={cn(
						'type-label ml-auto font-bold',
						exchange.outcome === 'gained' || exchange.outcome === 'kept'
							? 'text-foreground'
							: 'text-muted-foreground'
					)}
				>
					{OUTCOME_TEXT[exchange.outcome]}
					{exchange.neutralised ? ', under a VSC or Safety Car' : ''}
				</span>
			</header>
			<table className="w-full text-sm">
				<caption className="sr-only">
					{driver?.code} against {rival?.code}: where the time went, positive is time lost
				</caption>
				<thead className="sr-only">
					<tr>
						<th scope="col">Phase</th>
						<th scope="col">Bar</th>
						<th scope="col">Seconds</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => {
						const left = Math.min(row.from, row.to);
						const right = Math.max(row.from, row.to);

						return (
							<tr key={row.label} className="h-6">
								<th
									scope="row"
									className={cn(
										'type-label w-28 pr-2 text-left font-normal whitespace-nowrap',
										row.total && 'text-foreground'
									)}
								>
									{row.label}
								</th>
								<td className="relative" aria-hidden>
									<span className="bg-rule-strong absolute inset-y-0 left-1/2 w-px" />
									<span
										className={cn(
											'absolute inset-y-1 left-(--offset) w-(--size) min-w-px',
											row.total
												? 'bg-team'
												: row.to > row.from
													? 'bg-foreground/70'
													: 'border-foreground/60 border'
										)}
										style={{
											'--offset': at(left),
											'--size': `${((right - left) / reach) * 48}%`,
											'--team': driver ? `#${driver.teamColour}` : 'var(--muted-foreground)'
										}}
									/>
								</td>
								<td className="w-24 text-right whitespace-nowrap">
									<Digits value={row.value} />
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</article>
	);
}

/**
 * Every pit stop exchange so far: a car stops, the car beside it answers, and the ledger shows
 * who won and why, from the in-lap through the stop to the out-laps.
 */
export function UndercutLedger() {
	const { snapshot } = useRaceView();
	const exchanges = React.useMemo(() => stopExchanges(snapshot).toReversed(), [snapshot]);

	return (
		<Panel aria-label="Undercut ledger" data-testid="undercut">
			<PanelHeader title="Undercut ledger" meta={`${exchanges.length} exchanges`} />
			<div className="flex flex-col gap-3 p-4">
				<RaceOnly what="The undercut ledger">
					<ProGate
						feature="The undercut ledger"
						teaser="Who won each pit stop exchange, and whether it was the in-lap, the stop or the out-lap."
					>
						{exchanges.length === 0 ? (
							<EmptyNote className="px-0">
								An exchange shows once two cars a few seconds apart have both stopped and run their
								out-laps.
							</EmptyNote>
						) : (
							<div className="flex flex-col">
								{exchanges.map((exchange) => (
									<Ledger
										key={`${exchange.driverNumber}-${exchange.stopLap}-${exchange.rivalNumber}`}
										exchange={exchange}
									/>
								))}
							</div>
						)}
					</ProGate>
					<p className="text-muted-foreground text-xs">
						Each lap’s difference between the two cars, latest exchange first. Bars run from where
						the gap stood to where the phase left it; ahead of the rival is to the right. The pit
						lane spans the line, so its time comes out of the in- and out-laps and shows as the
						stop, split by how this session’s stops fell across the two laps. Solid bars gain time,
						hollow bars lose it.
					</p>
				</RaceOnly>
			</div>
		</Panel>
	);
}
