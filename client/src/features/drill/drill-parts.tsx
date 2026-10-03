import type { Driver } from '@f1-live/shared';
import type { DrillSection } from '@f1-live/shared/dashboard';
import * as React from 'react';

import { useRaceView } from '@/data/race-context';
import { stepShowing } from '@/data/session-time';
import type { SectorMark } from '@/insights/standings';
import { cn } from '@/lib/utils';

import { AddToDashboard } from './drill-add';
import { useDrill } from './use-drill';

export const MARK_TEXT: Record<SectorMark, string> = {
	fastest: 'text-fastest',
	'personal-best': 'text-personal-best',
	none: ''
};

/** Moves the replay to a moment: a race's lap, or in a session on the clock the minute it fell in. */
export function useJumpTo(): (moment: { lap: number; at?: string }) => void {
	const { timeline, setLap } = useRaceView();

	return React.useCallback(
		(moment) => {
			const step = timeline ? stepShowing(timeline, moment) : null;

			if (step !== null) {
				setLap(step);
			}
		},
		[timeline, setLap]
	);
}

/**
 * Where the views' parts sit. In the sheet each part can offer itself for a dashboard; in a tile
 * of its own, the tile's header names it, so the part drops its own.
 */
export type SectionHost = {
	inTile: boolean;
	/** The driver whose parts are offered for a dashboard. */
	addFor?: string;
};

export const SectionHostContext = React.createContext<SectionHost>({ inTile: false });

/** A part of a driver or lap view: a heavy rule and a printed label, its content on hairlines. */
export function Section({
	title,
	meta,
	actions,
	children,
	testId,
	part
}: {
	title: string;
	meta?: React.ReactNode;
	actions?: React.ReactNode;
	children: React.ReactNode;
	testId?: string;
	/** The tile this part can also be. */
	part?: DrillSection;
}) {
	const { inTile, addFor } = React.useContext(SectionHostContext);

	const add =
		part && addFor ? <AddToDashboard settings={{ section: part, driver: addFor }} /> : null;

	if (inTile) {
		return (
			<section aria-label={title} className="flex min-w-0 flex-col gap-2" data-testid={testId}>
				{meta || actions ? (
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						{meta ? <span className="type-label">{meta}</span> : null}
						{actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
					</div>
				) : null}
				{children}
			</section>
		);
	}

	return (
		<section aria-label={title} className="flex min-w-0 flex-col gap-2" data-testid={testId}>
			<header className="border-rule-strong flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 border-t-2 border-b py-1">
				<h3 className="type-wide text-xs font-bold">{title}</h3>
				{meta ? <span className="type-label">{meta}</span> : null}
				{actions || add ? (
					<div className="ml-auto flex items-center gap-2">
						{actions}
						{add}
					</div>
				) : null}
			</header>
			{children}
		</section>
	);
}

/** Classes that show a driver or a moment can be opened: a quiet fill on hover, a ring on focus. */
export const ACTIONABLE =
	'hover:bg-accent focus-visible:ring-ring cursor-pointer focus-visible:ring-2 focus-visible:outline-none';

/**
 * A driver's code or name that opens their session view. It stops the click there, so a row
 * around it that does something else is not triggered as well.
 */
export function DriverLink({
	driver,
	children,
	className
}: {
	driver: Driver;
	children: React.ReactNode;
	className?: string;
}) {
	const { open } = useDrill();

	return (
		<button
			type="button"
			aria-label={`${driver.code}, ${driver.firstName} ${driver.lastName}: open their session`}
			data-testid={`driver-link-${driver.code}`}
			onClick={(event) => {
				event.stopPropagation();
				open({ kind: 'driver', driverNumber: driver.number });
			}}
			className={cn(ACTIONABLE, '-mx-1 min-w-0 px-1 text-left', className)}
		>
			{children}
		</button>
	);
}
