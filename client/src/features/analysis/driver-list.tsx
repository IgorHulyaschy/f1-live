import { Panel, PanelHeader } from '@/components/console/panel';
import { TeamStripe } from '@/components/driver-tag';
import { cn } from '@/lib/utils';

import { useCompare } from './compare-context';

/** Pick the drivers to compare; hovering one highlights it in the chart. */
export function DriverList() {
	const { running: rows, selected, toggle: onToggle, setHighlighted: onHighlight } = useCompare();

	return (
		<Panel aria-label="Drivers to compare">
			<PanelHeader title="Compare" meta={`${selected.length} on chart`} />
			<ul className="flex flex-col @xs:grid @xs:grid-cols-4 @2xl:grid-cols-6">
				{rows.map((row) => {
					const isSelected = selected.includes(row.driver.code);

					return (
						<li key={row.driver.number} className="border-b last:border-b-0 @xs:last:border-b">
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
								<span className="text-muted-foreground w-5 text-right font-mono text-xs @xs:hidden">
									{row.position}
								</span>
								<TeamStripe driver={row.driver} />
								<span className="type-wide text-sm font-bold">{row.driver.code}</span>
								<span className="text-muted-foreground truncate text-xs @xs:hidden">
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
