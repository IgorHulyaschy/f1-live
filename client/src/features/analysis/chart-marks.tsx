import { ReferenceArea, useXAxisScale, useYAxisScale } from 'recharts';

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

/** How far apart two end labels must sit, in pixels, to be read as two. */
const LABEL_SPACING = 11;

/** A line's name and where the line ends, with its dash when a team-mate's line is solid. */
export type EndMark = { code: string; lap: number; value: number; fill: string; dash?: string };

/** The stretch of line drawn before each name, so team-mates in one colour read apart. */
const SAMPLE_WIDTH = 12;

/**
 * Each line's name at its last point, after a short stretch of its line, so the lines read without
 * a legend. Labels are laid out together, top to bottom, and one that would sit on the one above
 * moves down clear of it.
 */
export function EndLabels({ marks }: { marks: readonly EndMark[] }) {
	const x = useXAxisScale();
	const y = useYAxisScale();

	if (!x || !y) {
		return null;
	}

	const points = marks
		.flatMap((mark) => {
			const left = x(mark.lap);
			const top = y(mark.value);

			return left === undefined || top === undefined ? [] : [{ ...mark, left, top }];
		})
		.toSorted((a, b) => a.top - b.top);

	const placed: number[] = [];

	for (const point of points) {
		const above = placed.at(-1);

		placed.push(above === undefined ? point.top : Math.max(point.top, above + LABEL_SPACING));
	}

	return (
		<g>
			{points.map((point, index) => {
				const top = placed[index] ?? point.top;

				return (
					<g key={point.code}>
						<line
							x1={point.left + 4}
							x2={point.left + 4 + SAMPLE_WIDTH}
							y1={top}
							y2={top}
							stroke={point.fill}
							strokeWidth={2}
							strokeDasharray={point.dash}
						/>
						<text
							x={point.left + 7 + SAMPLE_WIDTH}
							y={top + 3.5}
							fill={point.fill}
							fontSize={10}
							className="font-mono font-bold"
						>
							{point.code}
						</text>
					</g>
				);
			})}
		</g>
	);
}

/** A lap too far off the pace to plot. */
export type OverMark = { code: string; lap: number; fill: string };

/**
 * A small arrow at the top edge for each lap left off the plot, in its line's colour, so a lap
 * far off the pace is still seen without stretching the scale for everyone.
 */
export function OverMarks({ marks, edge }: { marks: readonly OverMark[]; edge: number }) {
	const x = useXAxisScale();
	const top = useYAxisScale()?.(edge);

	if (!x) {
		return null;
	}

	return (
		<g>
			{marks.map((mark) => {
				const left = x(mark.lap);

				return left === undefined || top === undefined ? null : (
					<path
						key={`${mark.code}-${mark.lap}`}
						d={`M${left - 3.5},${top + 6} L${left},${top} L${left + 3.5},${top + 6} Z`}
						fill={mark.fill}
					/>
				);
			})}
		</g>
	);
}
