import type { Driver } from '@f1-live/shared';
import { m, useReducedMotion } from 'motion/react';
import * as React from 'react';

import type { GapCar, GapField } from '@/insights/gap-distance';
import { useElementSize } from '@/hooks/use-element-size';
import { useRemPixels } from '@/hooks/use-scale';
import { formatLapTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import { inkOn } from '../track/track-draw';
import {
	carDrawing,
	formatDistance,
	formatGap,
	formatMetres,
	type LabelStyle,
	placeStraight,
	type StraightGeometry,
	type StraightOrientation
} from './straight-layout';

const EASE = [0.2, 0, 0, 1] as const;

/**
 * Every car of a field on one straight, by the metres it is behind the car in front: pole at the
 * line, the rest further back, side by side in two lanes like a grid. Vertical for a column,
 * horizontal for a wide tile. Cars and labels glide to their new places when the field changes.
 * Embeddable: it fills its box and needs only the field and the drivers.
 */
export function GapStraight({
	field,
	drivers,
	orientation,
	followed,
	labelStyle = 'full',
	className,
	label
}: {
	field: GapField;
	drivers: ReadonlyMap<string, Driver>;
	/** `auto` lies the straight flat in a wide box and upright otherwise. */
	orientation: StraightOrientation | 'auto';
	followed?: string;
	labelStyle?: LabelStyle;
	className?: string;
	/** What the picture shows, for screen readers. */
	label: string;
}) {
	const box = React.useRef<HTMLElement>(null);
	const { width, height } = useElementSize(box);
	const rem = useRemPixels();
	const reduced = useReducedMotion() ?? false;

	const flat =
		orientation === 'auto'
			? width >= 1.25 * height && width >= 30 * rem
			: orientation === 'horizontal';

	const vertical = !flat;

	const { slots, ticks, road, size, point } = placeStraight(field.cars, {
		width,
		height,
		rem,
		style: labelStyle,
		orientation: flat ? 'horizontal' : 'vertical'
	});

	const transition = { duration: reduced ? 0 : 0.6, ease: EASE };

	return (
		<figure
			ref={box}
			className={cn('relative min-h-0 flex-1 overflow-hidden', className)}
			data-testid="gap-straight"
		>
			{width > 0 && height > 0 ? (
				<svg width={width} height={height} aria-hidden className="absolute inset-0">
					<rect x={road.x} y={road.y} width={road.width} height={road.height} fill="var(--muted)" />
					{ticks.map((tick) => {
						const [x0, y0] = point(tick.at, -2 * size.lane);
						const [x1, y1] = point(tick.at, 2 * size.lane);

						return (
							<g key={tick.metres} className="text-muted-foreground">
								<line x1={x0} y1={y0} x2={x1} y2={y1} stroke="currentColor" strokeOpacity={0.35} />
								{tick.text ? (
									<text
										x={tick.text[0]}
										y={tick.text[1]}
										fill="currentColor"
										fontSize={0.55 * rem}
										className="font-mono"
										dominantBaseline={vertical ? 'central' : 'auto'}
										textAnchor={vertical ? 'end' : 'middle'}
									>
										{formatDistance(tick.metres)}
									</text>
								) : null}
							</g>
						);
					})}
					<Chequer point={point} lane={size.lane} rem={rem} />
					{slots.map((slot) => (
						<m.line
							key={`lead-${slot.car.driverNumber}`}
							initial={false}
							animate={{ x1: slot.carX, y1: slot.carY, x2: slot.anchorX, y2: slot.anchorY }}
							transition={transition}
							stroke="var(--muted-foreground)"
							strokeOpacity={0.5}
						/>
					))}
					{slots.map((slot) => {
						const driver = drivers.get(slot.car.driverNumber);

						return driver ? (
							<m.g
								key={`car-${slot.car.driverNumber}`}
								initial={false}
								animate={{ x: slot.carX, y: slot.carY }}
								transition={transition}
							>
								<CarFigure
									colour={`#${driver.teamColour}`}
									size={size}
									turned={!vertical}
									followed={driver.number === followed}
								/>
							</m.g>
						) : null;
					})}
					{slots.map((slot) => {
						const driver = drivers.get(slot.car.driverNumber);

						return driver ? (
							<m.g
								key={`label-${slot.car.driverNumber}`}
								initial={false}
								animate={{ x: slot.labelX, y: slot.labelY }}
								transition={transition}
								data-testid={`gap-car-${driver.code}`}
							>
								<CarLabel
									car={slot.car}
									driver={driver}
									leaderMs={slot.car.position === 1 ? field.leaderMs : null}
									size={size}
									rem={rem}
									labelStyle={labelStyle}
									followed={driver.number === followed}
								/>
							</m.g>
						) : null;
					})}
				</svg>
			) : null}
			<figcaption className="sr-only">
				{label}
				<ol>
					{field.cars.map((car) => (
						<li key={car.driverNumber}>
							{`P${car.position} ${drivers.get(car.driverNumber)?.code ?? car.driverNumber} `}
							{car.position === 1
								? field.leaderMs === null
									? 'leads'
									: formatLapTime(field.leaderMs)
								: `${formatGap(car.gapMs)}, ${formatMetres(car)} behind`}
						</li>
					))}
				</ol>
			</figcaption>
		</figure>
	);
}

/** The line: a chequered strip across the road. */
function Chequer({
	point,
	lane,
	rem
}: {
	point: (alongPx: number, acrossPx: number) => [number, number];
	lane: number;
	rem: number;
}) {
	const cell = 0.25 * rem;
	const cells = Math.ceil((4 * lane) / cell);

	return (
		<g aria-hidden>
			{Array.from({ length: cells * 2 }, (_, index) => {
				const row = index % 2;
				const column = Math.floor(index / 2);
				const [x, y] = point(-row * cell, -2 * lane + column * cell);

				return (
					<rect
						key={index}
						x={x}
						y={y}
						width={cell}
						height={cell}
						fill={(row + column) % 2 === 0 ? 'var(--foreground)' : 'var(--panel)'}
					/>
				);
			})}
		</g>
	);
}

/** The car from above, nose to the line; the followed car carries a ring. */
function CarFigure({
	colour,
	size,
	turned,
	followed
}: {
	colour: string;
	size: StraightGeometry;
	turned: boolean;
	followed: boolean;
}) {
	const { body, wings } = carDrawing(size.carLength, size.carWidth);

	return (
		<g transform={turned ? 'rotate(90)' : undefined}>
			{followed ? (
				<ellipse
					rx={size.carWidth * 0.95}
					ry={size.carLength * 0.62}
					fill="none"
					stroke="var(--foreground)"
					strokeWidth={1.5}
				/>
			) : null}
			{wings.map(([x, y, w, h]) => (
				<rect key={`${x}/${y}`} x={x} y={y} width={w} height={h} fill={colour} />
			))}
			<polygon
				points={body.map(([x, y]) => `${x},${y}`).join(' ')}
				fill={colour}
				stroke="var(--panel)"
				strokeWidth={0.75}
			/>
		</g>
	);
}

function CarLabel({
	car,
	driver,
	leaderMs,
	size,
	rem,
	labelStyle,
	followed
}: {
	car: GapCar;
	driver: Driver;
	leaderMs: number | null;
	size: StraightGeometry;
	rem: number;
	labelStyle: LabelStyle;
	followed: boolean;
}) {
	const colour = `#${driver.teamColour}`;
	const frame = followed ? 'var(--foreground)' : 'var(--border)';

	if (labelStyle === 'compact') {
		return (
			<g>
				<rect
					width={size.labelWidth}
					height={size.labelHeight}
					fill="var(--panel)"
					stroke={frame}
				/>
				<rect width={0.2 * rem} height={size.labelHeight} fill={colour} />
				<text
					x={0.4 * rem}
					y={size.labelHeight / 2}
					dominantBaseline="central"
					fontSize={0.62 * rem}
					fontWeight={800}
					className="type-wide"
					fill="var(--foreground)"
				>
					{driver.code}
				</text>
				<text
					x={size.labelWidth - 0.25 * rem}
					y={size.labelHeight / 2}
					dominantBaseline="central"
					textAnchor="end"
					fontSize={0.55 * rem}
					className="font-mono"
					fill="var(--muted-foreground)"
				>
					{car.position === 1 ? 'P1' : formatMetres(car)}
				</text>
			</g>
		);
	}

	const chip = (car.position >= 10 ? 1.85 : 1.6) * rem;
	const cut = 0.3 * rem;
	const top = 0.55 * size.labelHeight;
	const bottom = top + (size.labelHeight - top) / 2;

	const reading =
		leaderMs !== null
			? formatLapTime(leaderMs)
			: car.position === 1
				? 'Leader'
				: formatGap(car.gapMs);

	return (
		<g>
			<rect
				width={size.labelWidth}
				height={size.labelHeight}
				fill="var(--panel)"
				stroke={frame}
				strokeWidth={followed ? 1.5 : 1}
			/>
			<path d={`M 0 0 H ${chip} L ${chip - cut} ${top} H 0 Z`} fill={colour} />
			<text
				x={(chip - cut) / 2}
				y={top / 2}
				dominantBaseline="central"
				textAnchor="middle"
				fontSize={0.62 * rem}
				fontWeight={800}
				className="font-mono"
				fill={inkOn(colour)}
			>
				P{car.position}
			</text>
			<text
				x={chip + 0.3 * rem}
				y={top / 2}
				dominantBaseline="central"
				fontSize={0.75 * rem}
				fontWeight={800}
				className="type-wide"
				fill="var(--foreground)"
			>
				{driver.code}
			</text>
			<text
				x={0.3 * rem}
				y={bottom}
				dominantBaseline="central"
				fontSize={0.6 * rem}
				className="font-mono"
				fill="var(--foreground)"
			>
				{reading}
			</text>
			{car.position === 1 ? null : (
				<text
					x={size.labelWidth - 0.3 * rem}
					y={bottom}
					dominantBaseline="central"
					textAnchor="end"
					fontSize={0.6 * rem}
					className="font-mono"
					fill="var(--muted-foreground)"
				>
					{formatMetres(car)}
				</text>
			)}
		</g>
	);
}
