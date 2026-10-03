import { ReferenceArea } from 'recharts';

import { cn } from '@/lib/utils';

import type { FlagRange, LapPoint } from './lap-series';

/** How each flag shades the laps it covered: the heavier the neutralisation, the stronger. */
const FLAG_BAND: Record<
	FlagRange['status'],
	{ fill: string; opacity: number; label: string | null; legend: string; swatch: string }
> = {
	yellow: {
		fill: 'var(--flag)',
		opacity: 0.05,
		label: null,
		legend: 'Yellow',
		swatch: 'bg-flag/15'
	},
	vsc: { fill: 'var(--flag)', opacity: 0.1, label: 'VSC', legend: 'VSC', swatch: 'bg-flag/30' },
	safety_car: {
		fill: 'var(--flag)',
		opacity: 0.2,
		label: 'SC',
		legend: 'Safety Car',
		swatch: 'bg-flag/60'
	},
	red: {
		fill: 'var(--danger)',
		opacity: 0.14,
		label: 'RED',
		legend: 'Red flag',
		swatch: 'bg-danger/40'
	}
};

/** Bands behind a lap chart, labelled above the plot so they never sit on a line. */
export function flagBands(ranges: readonly FlagRange[]) {
	return ranges.map((range) => {
		const band = FLAG_BAND[range.status];

		return (
			<ReferenceArea
				key={`${range.status}-${range.from}`}
				x1={range.from - 0.5}
				x2={range.to + 0.5}
				fill={band.fill}
				fillOpacity={band.opacity}
				ifOverflow="hidden"
				label={
					band.label
						? { value: band.label, position: 'top', className: 'fill-muted-foreground text-[10px]' }
						: undefined
				}
			/>
		);
	});
}

type DotProps = { cx?: number; cy?: number; index?: number; payload?: LapPoint };

/**
 * A line's mark for a pit stop: a hollow square on the lap the car came in, drawn in the line's
 * colour. Other laps get an empty group, as the chart library wants an element back.
 */
export function pitDot(laps: ReadonlySet<number> | undefined, colour: string) {
	return function PitDot({ cx, cy, index, payload }: DotProps) {
		const lap = payload?.lap;

		if (cx === undefined || cy === undefined || lap === undefined || !laps?.has(lap)) {
			return <g key={index} />;
		}

		return (
			<rect
				key={index}
				x={cx - 3.5}
				y={cy - 3.5}
				width={7}
				height={7}
				fill="var(--panel)"
				stroke={colour}
				strokeWidth={1.5}
			/>
		);
	};
}

/** The legend's entries for the flags a chart shows and its pit marks. */
export function MarksLegend({ ranges, stops }: { ranges: readonly FlagRange[]; stops: boolean }) {
	const statuses = [...new Set(ranges.map((range) => range.status))];

	return (
		<>
			{stops ? (
				<span className="text-muted-foreground flex items-center gap-1.5">
					<span aria-hidden className="border-foreground size-2 border-2" />
					Pit stop
				</span>
			) : null}
			{statuses.map((status) => (
				<span key={status} className="text-muted-foreground flex items-center gap-1.5">
					<span aria-hidden className={cn('h-2.5 w-4', FLAG_BAND[status].swatch)} />
					{FLAG_BAND[status].legend}
				</span>
			))}
		</>
	);
}
