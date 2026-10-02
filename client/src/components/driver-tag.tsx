import type { Driver } from '@f1-live/shared';

import { cn } from '@/lib/utils';

export function TeamStripe({ driver, className }: { driver: Driver; className?: string }) {
	return (
		<span
			aria-hidden
			className={cn('bg-team h-4 w-0.75 shrink-0', className)}
			style={{ '--team': `#${driver.teamColour}` }}
		/>
	);
}

export function DriverTag({
	driver,
	showName = false,
	showNumber = false,
	className
}: {
	driver: Driver;
	showName?: boolean;
	showNumber?: boolean;
	className?: string;
}) {
	return (
		<span className={cn('flex min-w-0 items-center gap-2', className)}>
			<TeamStripe driver={driver} />
			{showNumber ? (
				<span className="text-muted-foreground hidden w-5 text-right font-mono text-xs italic sm:inline">
					{driver.number}
				</span>
			) : null}
			<span className="type-wide text-sm leading-none font-bold">{driver.code}</span>
			{showName ? (
				<span className="text-muted-foreground hidden truncate text-xs 2xl:inline">
					{driver.lastName}
				</span>
			) : null}
		</span>
	);
}
