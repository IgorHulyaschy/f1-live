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
			<PanelHeader title="Compare" meta={`${selected.length} on chart`} />
			<ul className="grid grid-cols-4 sm:grid-cols-5 lg:flex lg:flex-col">
				{rows.map((row) => {
					const isSelected = selected.includes(row.driver.code);

					return (
						<li key={row.driver.number} className="border-b lg:last:border-b-0">
							<button
								type="button"
								aria-pressed={isSelected}
								onClick={() => onToggle(row.driver.code)}
								onMouseEnter={() => onHighlight(isSelected ? row.driver.code : null)}
								onFocus={() => onHighlight(isSelected ? row.driver.code : null)}
								onMouseLeave={() => onHighlight(null)}
								onBlur={() => onHighlight(null)}
								className={cn(
									'hover:bg-accent flex h-9 w-full items-center gap-2 px-4 text-left transition-colors',
									isSelected && 'bg-accent'
								)}
							>
								<span
									aria-hidden
									className={cn(
										'flex size-3 shrink-0 items-center justify-center border',
										isSelected && 'border-foreground bg-foreground'
									)}
								/>
								<span className="text-muted-foreground hidden w-5 text-right font-mono text-xs lg:inline">
									{row.position}
								</span>
								<TeamStripe driver={row.driver} />
								<span className="type-wide text-sm font-bold">{row.driver.code}</span>
								<span className="text-muted-foreground hidden truncate text-xs lg:inline">
									{row.driver.lastName}
								</span>
							</button>
						</li>
					);
				})}
			</ul>
		</Panel>
	);
}
