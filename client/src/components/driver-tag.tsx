import type { Driver } from '@f1-live/shared';

import { cn } from '@/lib/utils';

export function TeamStripe({ driver, className }: { driver: Driver; className?: string }) {
	return (
		<span
			aria-hidden
			className={cn('bg-team h-4 w-1 shrink-0 rounded-full', className)}
			style={{ '--team': `#${driver.teamColour}` }}
		/>
	);
}

export function DriverTag({
	driver,
	showName = false,
	className
}: {
	driver: Driver;
	showName?: boolean;
	className?: string;
}) {
	return (
		<span className={cn('flex min-w-0 items-center gap-2', className)}>
			<TeamStripe driver={driver} />
			<span className="font-display text-base leading-none font-semibold tracking-wide">
				{driver.code}
			</span>
			{showName ? (
				<span className="text-muted-foreground hidden truncate text-xs 2xl:inline">
					{driver.lastName}
				</span>
			) : null}
		</span>
	);
}
