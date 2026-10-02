import { motion } from 'motion/react';

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
	const slowest = Math.max(...ranking.map((entry) => entry.deltaToBestSeconds), 0.5);

	return (
		<Panel aria-label="Tyre-corrected pace" data-testid="pace-ranking">
			<PanelHeader title="Who is really fastest" meta="fuel & tyre corrected" />
			<div className="p-4">
				<ProGate feature="Tyre-corrected pace">
					{ranking.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							Not enough green-flag laps on the current tyres yet.
						</p>
					) : (
						<ol className="flex flex-col gap-2">
							{ranking.map((entry, index) => (
								<li
									key={entry.driver.number}
									className="grid grid-cols-[1.25rem_4rem_minmax(0,1fr)_4.5rem] items-center gap-3"
								>
									<span className="text-muted-foreground text-right font-mono text-xs">
										{index + 1}
									</span>
									<span className="flex items-center gap-2">
										<DriverTag driver={entry.driver} />
									</span>
									<span className="bg-muted relative h-2 overflow-hidden rounded-full">
										<motion.span
											className="bg-team absolute inset-y-0 left-0 rounded-full"
											style={{ '--team': `#${entry.driver.teamColour}` }}
											initial={{ width: 0 }}
											animate={{
												width: `${Math.max(3, (1 - entry.deltaToBestSeconds / (slowest * 1.15)) * 100)}%`
											}}
											transition={{
												type: 'spring',
												stiffness: 120,
												damping: 20,
												delay: index * 0.03
											}}
										/>
									</span>
									<span className="flex items-center justify-end gap-2 font-mono text-xs">
										{index === 0 ? (
											<span className="text-fastest">best</span>
										) : (
											`+${entry.deltaToBestSeconds.toFixed(2)}`
										)}
										<TyreBadge compound={entry.compound} />
									</span>
								</li>
							))}
						</ol>
					)}
				</ProGate>
				<p className="text-muted-foreground mt-4 text-xs">
					Recent green-flag laps with fuel load and tyre age removed, on equal tyres. Seconds per
					lap off the quickest car.
				</p>
			</div>
		</Panel>
	);
}
