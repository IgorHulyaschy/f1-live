import { motion } from 'motion/react';

import { Digits } from '@/components/console/digits';
import { Panel, PanelHeader } from '@/components/console/panel';
import { DriverTag } from '@/components/driver-tag';
import { ProGate } from '@/components/pro-gate';
import { TyreBadge } from '@/components/tyre-badge';
import { useRace } from '@/data/race-context';
import { tyreCorrectedPace } from '@/insights/tyre-pace';

const SHOWN_DRIVERS = 10;

export function PaceRanking() {
	const { snapshot } = useRace();
	const ranking = tyreCorrectedPace(snapshot).slice(0, SHOWN_DRIVERS);
	const scale = Math.max(...ranking.map((entry) => entry.deltaToBestSeconds), 0.5);
	const leader = ranking[0]?.driver.code;

	return (
		<Panel aria-label="True pace" data-testid="pace-ranking">
			<PanelHeader title="True pace" meta="fuel and tyre age removed" />
			<div className="flex flex-col gap-3 p-4">
				<ProGate
					feature="Tyre-corrected pace"
					teaser="Who is actually quickest once fuel load and tyre age are taken out, in tenths per lap."
				>
					{ranking.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							Not enough green-flag laps on the current tyres yet.
						</p>
					) : (
						<ol className="flex flex-col">
							{ranking.map((entry, index) => (
								<li
									key={entry.driver.number}
									className="grid grid-cols-[1.25rem_4rem_2.5rem_minmax(0,1fr)] items-center gap-3 border-b py-1.5 last:border-b-0"
								>
									<span className="text-muted-foreground text-right font-mono text-xs">
										{index + 1}
									</span>
									<DriverTag driver={entry.driver} />
									<TyreBadge compound={entry.compound} />
									<span className="border-rule-strong flex h-5 max-w-xl items-center gap-2 border-l">
										{index === 0 ? (
											<span className="type-label text-fastest pl-1 font-bold">Quickest</span>
										) : (
											<>
												<motion.span
													className="bg-foreground/45 h-3 shrink-0"
													initial={{ width: 0 }}
													animate={{ width: `${(entry.deltaToBestSeconds / scale) * 80}%` }}
													transition={{ duration: 0.4, ease: 'easeOut', delay: index * 0.02 }}
												/>
												<Digits
													className="text-sm"
													value={`+${entry.deltaToBestSeconds.toFixed(3)}`}
												/>
											</>
										)}
									</span>
								</li>
							))}
						</ol>
					)}
				</ProGate>
				<p className="text-muted-foreground text-xs">
					Seconds per lap off {leader ?? 'the quickest car'} over recent green-flag laps, on equal
					tyres. Bars grow from the quickest car.
				</p>
			</div>
		</Panel>
	);
}
