import { CheckIcon } from 'lucide-react';

import { Panel, PanelHeader } from '@/components/console/panel';
import { TeamStripe } from '@/components/driver-tag';
import type { StandingRow } from '@/insights/standings';
import { cn } from '@/lib/utils';

/** Pick the drivers to compare; hovering one highlights it in the chart. */
export function DriverList({
	rows,
	selected,
	onToggle,
	onHighlight
}: {
	rows: readonly StandingRow[];
	selected: readonly string[];
	onToggle: (code: string) => void;
	onHighlight: (code: string | null) => void;
}) {
	return (
		<Panel aria-label="Drivers to compare">
			<PanelHeader title="Compare" meta={`${selected.length} selected`} />
			<ul className="grid grid-cols-4 gap-px p-2 sm:grid-cols-5 lg:flex lg:flex-col">
				{rows.map((row) => {
					const isSelected = selected.includes(row.driver.code);

					return (
						<li key={row.driver.number}>
							<button
								type="button"
								aria-pressed={isSelected}
								onClick={() => onToggle(row.driver.code)}
								onMouseEnter={() => onHighlight(isSelected ? row.driver.code : null)}
								onFocus={() => onHighlight(isSelected ? row.driver.code : null)}
								onMouseLeave={() => onHighlight(null)}
								onBlur={() => onHighlight(null)}
								className={cn(
									'hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
									isSelected ? 'text-foreground' : 'text-muted-foreground'
								)}
							>
								<span className="text-muted-foreground hidden w-5 text-right font-mono text-xs lg:inline">
									{row.position}
								</span>
								<TeamStripe driver={row.driver} className={cn(!isSelected && 'opacity-30')} />
								<span className="font-display font-semibold tracking-wide">{row.driver.code}</span>
								<span className="hidden truncate text-xs lg:inline">{row.driver.lastName}</span>
								<CheckIcon
									aria-hidden
									className={cn('ml-auto hidden size-3.5 lg:block', !isSelected && 'invisible')}
								/>
							</button>
						</li>
					);
				})}
			</ul>
		</Panel>
	);
}
