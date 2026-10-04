import { Link } from 'react-router';

import type { FlagRange } from '../analysis/lap-series';
import type { StoryMarkerKind, StoryVisual } from './story-answer';

const WIDTH = 360;

const HEIGHT = 112;

const LEFT = 26;

const RIGHT = 8;

const TOP = 14;

const BOTTOM = 18;

/** In the picture's own units, which the width scales with the card. */
const FONT_SIZE = 9;

const BAND: Record<FlagRange['status'], { fill: string; opacity: number; label: string }> = {
	yellow: { fill: 'var(--flag)', opacity: 0.12, label: '' },
	vsc: { fill: 'var(--flag)', opacity: 0.3, label: 'VSC' },
	safety_car: { fill: 'var(--flag)', opacity: 0.5, label: 'SC' },
	red: { fill: 'var(--danger)', opacity: 0.2, label: 'RED' }
};

const MARKER_NAME: Record<StoryMarkerKind, string> = {
	stop: 'Stop',
	penalty: 'Penalty',
	incident: 'Incident',
	out: 'Out'
};

/** The path of a cross the size of a marker, centred on a point. */
function cross(x: number, y: number): string {
	return `M${x - 3.5} ${y - 3.5}L${x + 3.5} ${y + 3.5}M${x + 3.5} ${y - 3.5}L${x - 3.5} ${y + 3.5}`;
}

function Marker({
	kind,
	x,
	y,
	label
}: {
	kind: StoryMarkerKind;
	x: number;
	y: number;
	label: string;
}) {
	switch (kind) {
		case 'stop': {
			return (
				<circle
					cx={x}
					cy={y}
					r={3.2}
					className="fill-background stroke-foreground"
					strokeWidth={1.5}
				>
					<title>{label}</title>
				</circle>
			);
		}

		case 'out': {
			return (
				<path d={cross(x, y)} stroke="var(--danger)" strokeWidth={2.2} fill="none">
					<title>{label}</title>
				</path>
			);
		}

		case 'incident': {
			return (
				<path
					d={`M${x} ${y - 4.5}L${x + 4.5} ${y}L${x} ${y + 4.5}L${x - 4.5} ${y}Z`}
					fill="var(--flag-ink)"
				>
					<title>{label}</title>
				</path>
			);
		}

		default: {
			return (
				<path d={`M${x} ${y - 5}L${x + 4.5} ${y + 3}L${x - 4.5} ${y + 3}Z`} fill="var(--flag-ink)">
					<title>{label}</title>
				</path>
			);
		}
	}
}

function Sparkline({ story }: { story: StoryVisual }) {
	const innerWidth = WIDTH - LEFT - RIGHT;
	const innerHeight = HEIGHT - TOP - BOTTOM;

	const x = (lap: number) => LEFT + (lap / Math.max(story.laps, 1)) * innerWidth;

	const y = (position: number) =>
		TOP + ((position - 1) / Math.max(story.field - 1, 1)) * innerHeight;

	const last = story.positions.at(-1);

	// A marker sits on the line at its lap, or on the last lap the car ran.
	const rowAt = (lap: number) =>
		story.positions.findLast((point) => point.lap <= lap)?.position ?? last?.position ?? 1;

	return (
		<svg
			// The moments list below says everything the picture shows, in words.
			aria-hidden
			viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
			fontSize={FONT_SIZE}
			className="w-full"
			data-testid="ask-sparkline"
		>
			<title>Position at the end of each lap</title>
			{story.bands.map((range) => (
				<g key={`${range.status}-${range.from}`}>
					<rect
						x={x(range.from - 0.5)}
						y={TOP}
						width={Math.max(x(range.to + 0.5) - x(range.from - 0.5), 1)}
						height={innerHeight}
						fill={BAND[range.status].fill}
						fillOpacity={BAND[range.status].opacity}
					/>
					<text
						x={(x(range.from - 0.5) + x(range.to + 0.5)) / 2}
						y={TOP - 4}
						textAnchor="middle"
						className="fill-muted-foreground"
					>
						{BAND[range.status].label}
					</text>
				</g>
			))}
			{[1, story.field].map((position) => (
				<g key={position}>
					<line
						x1={LEFT}
						x2={WIDTH - RIGHT}
						y1={y(position)}
						y2={y(position)}
						className="stroke-border"
						strokeWidth={0.5}
					/>
					<text x={LEFT - 4} y={y(position) + 3} textAnchor="end" className="fill-muted-foreground">
						P{position}
					</text>
				</g>
			))}
			{[0, Math.round(story.laps / 2), story.laps].map((lap) => (
				<text
					key={lap}
					x={x(lap)}
					y={HEIGHT - 4}
					textAnchor={lap === 0 ? 'start' : lap === story.laps ? 'end' : 'middle'}
					className="fill-muted-foreground"
				>
					{lap === 0 ? 'Grid' : `Lap ${lap}`}
				</text>
			))}
			<polyline
				points={story.positions.map((point) => `${x(point.lap)},${y(point.position)}`).join(' ')}
				fill="none"
				strokeWidth={2}
				strokeLinejoin="round"
				stroke={story.colour ? `#${story.colour}` : 'var(--foreground)'}
			/>
			{story.markers.map((marker) => (
				<Marker
					key={`${marker.kind}-${marker.lap}-${marker.label}`}
					kind={marker.kind}
					x={x(marker.lap)}
					y={y(rowAt(marker.lap))}
					label={`Lap ${marker.lap}: ${marker.label}`}
				/>
			))}
		</svg>
	);
}

/** What the picture's marks and bands mean, for those it shows. */
function Legend({ story }: { story: StoryVisual }) {
	const kinds = [...new Set(story.markers.map((marker) => marker.kind))];
	const flags = [...new Set(story.bands.map((range) => range.status))];

	return (
		<p className="type-label flex flex-wrap gap-x-3 gap-y-1" data-testid="ask-legend">
			{kinds.map((kind) => (
				<span key={kind} className="flex items-center gap-1">
					<svg aria-hidden viewBox="0 0 12 12" className="size-3">
						<Marker kind={kind} x={6} y={6} label="" />
					</svg>
					{MARKER_NAME[kind]}
				</span>
			))}
			{flags.map((status) => (
				<span key={status} className="flex items-center gap-1">
					<svg aria-hidden viewBox="0 0 12 12" className="size-3">
						<rect
							width={12}
							height={12}
							fill={BAND[status].fill}
							fillOpacity={BAND[status].opacity}
						/>
					</svg>
					{status === 'safety_car' ? 'SC: Safety Car' : BAND[status].label}
				</span>
			))}
		</p>
	);
}

/** A driver's running order lap by lap, with the few moments that decided the race. */
export function StoryView({ story, onNavigate }: { story: StoryVisual; onNavigate: () => void }) {
	return (
		<div className="flex flex-col gap-2" data-testid="ask-story">
			<Sparkline story={story} />
			<Legend story={story} />
			<ol className="flex flex-col gap-1 text-sm" data-testid="ask-moments">
				{story.moments.map((moment) => (
					<li key={`${moment.when}-${moment.text}`} className="grid grid-cols-[3.25rem_1fr] gap-2">
						<Link
							to={moment.href}
							onClick={onNavigate}
							className="decoration-focus font-mono text-xs leading-5 underline decoration-2 underline-offset-3 hover:decoration-4"
						>
							{moment.when}
						</Link>
						<span>{moment.text}</span>
					</li>
				))}
			</ol>
		</div>
	);
}
