import type { Driver } from '@f1-live/shared';

import { cn } from '@/lib/utils';

export function DriverTag({
	driver,
	showTeam = false,
	className
}: {
	driver: Driver;
	showTeam?: boolean;
	className?: string;
}) {
	return (
		<span className={cn('flex min-w-0 items-center gap-2', className)}>
			<span
				aria-hidden
				className="bg-team h-4 w-1 shrink-0 rounded-full"
				style={{ '--team': `#${driver.teamColour}` }}
			/>
			<span className="min-w-0">
				<span className="block font-semibold tracking-wide">{driver.code}</span>
				{showTeam ? (
					<span className="text-muted-foreground block truncate text-xs">{driver.team}</span>
				) : null}
			</span>
		</span>
	);
}
