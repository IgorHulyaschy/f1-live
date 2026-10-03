import type { GapCar } from '../../insights/gap-distance.ts';

/** Where a car and its label go on the straight, in pixels along it from the line. */
export type StraightSlot = {
	car: GapCar;
	/** The car's lane: alternate places sit side by side, like a starting grid. */
	lane: 0 | 1;
	at: number;
	/** The middle of its label along the straight, which may sit further back than the car. */
	labelAt: number;
	/** The label's row beside its lane, from the nearest out. */
	track: number;
};

export type StraightLayout = {
	slots: StraightSlot[];
	/** Pixels per metre. */
	scale: number;
	/** The metres the straight shows, rounded up to a whole tick. */
	metres: number;
	tickM: number;
};

const TICKS_M = [5, 10, 25, 50, 100, 250, 500, 1000];

/** A tick every so many metres, about six along the straight. */
export function tickStep(metres: number): number {
	return TICKS_M.find((step) => metres / step <= 6) ?? TICKS_M.at(-1) ?? 1000;
}

/**
 * Lays the field along a straight of `lengthPx`: each car by its metres, its label beside its
 * lane in the first row where it clears the label before it, or pushed back along the straight
 * when every row is taken. The straight always shows at least `minMetres`.
 */
export function layoutStraight(
	cars: readonly GapCar[],
	{
		lengthPx,
		labelLengthPx,
		tracks,
		gapPx = 4,
		minMetres = 10
	}: {
		lengthPx: number;
		/** A label's size along the straight. */
		labelLengthPx: number;
		/** Rows of labels on each side. */
		tracks: number;
		gapPx?: number;
		minMetres?: number;
	}
): StraightLayout {
	const furthest = Math.max(minMetres, ...cars.map((car) => car.metres));
	const tickM = tickStep(furthest);
	const metres = Math.ceil(furthest / tickM) * tickM;
	const scale = lengthPx / metres;
	const half = labelLengthPx / 2;

	// The far end of the last label in each row, per lane.
	const ends: [number[], number[]] = [
		Array.from({ length: tracks }, () => -Infinity),
		Array.from({ length: tracks }, () => -Infinity)
	];

	const slots = cars
		.toSorted((a, b) => a.metres - b.metres || a.position - b.position)
		.map((car): StraightSlot => {
			const lane = car.position % 2 === 1 ? 0 : 1;
			const at = car.metres * scale;
			const wanted = Math.max(at, half);
			const rows = ends[lane];
			const free = rows.findIndex((end) => end + gapPx <= wanted - half);
			const lowest = rows.indexOf(Math.min(...rows));
			const track = free === -1 ? lowest : free;
			const labelAt = free === -1 ? (rows[lowest] ?? 0) + gapPx + half : wanted;

			rows[track] = labelAt + half;

			return { car, lane, at, labelAt, track };
		});

	return { slots, scale, metres, tickM };
}

export type StraightOrientation = 'vertical' | 'horizontal';

/** What a label says: the full card, or the code and metres for small multiples. */
export type LabelStyle = 'full' | 'compact';

/** Sizes in pixels from one rem, so the straight grows with the text size from S to TV. */
export type StraightGeometry = {
	labelWidth: number;
	labelHeight: number;
	carLength: number;
	carWidth: number;
	lane: number;
	pad: number;
	gap: number;
};

export function straightGeometry(rem: number, style: LabelStyle): StraightGeometry {
	return style === 'full'
		? {
				labelWidth: 7.25 * rem,
				labelHeight: 2.5 * rem,
				carLength: 1.75 * rem,
				carWidth: 0.75 * rem,
				lane: 0.85 * rem,
				pad: 0.75 * rem,
				gap: 0.25 * rem
			}
		: {
				labelWidth: 4.25 * rem,
				labelHeight: 1.25 * rem,
				carLength: 1.25 * rem,
				carWidth: 0.55 * rem,
				lane: 0.6 * rem,
				pad: 0.5 * rem,
				gap: 0.15 * rem
			};
}

/** A slot with its car's centre, its label's top left and where the leader line meets the label. */
export type PlacedSlot = StraightSlot & {
	carX: number;
	carY: number;
	labelX: number;
	labelY: number;
	anchorX: number;
	anchorY: number;
};

/** A metre mark along the straight, and where its figure goes beside the road. */
export type StraightTick = {
	metres: number;
	at: number;
	/** The figure's anchor; null where a label covers it. */
	text: [number, number] | null;
};

export type PlacedStraight = {
	slots: PlacedSlot[];
	ticks: StraightTick[];
	/** The road's corners, in the drawing. */
	road: { x: number; y: number; width: number; height: number };
	layout: StraightLayout;
	size: StraightGeometry;
	/** From metres along and pixels across the straight to the drawing. */
	point: (alongPx: number, acrossPx: number) => [number, number];
	/** How far the straight runs, in pixels along it. */
	lengthPx: number;
};

/**
 * The straight in a box of `width` × `height`: from the line down a column, or leftwards from the
 * line at the right of a wide box. Labels sit in rows beside their lane, as many as fit.
 */
export function placeStraight(
	cars: readonly GapCar[],
	{
		width,
		height,
		rem,
		style,
		orientation
	}: {
		width: number;
		height: number;
		rem: number;
		style: LabelStyle;
		orientation: StraightOrientation;
	}
): PlacedStraight {
	const size = straightGeometry(rem, style);
	const vertical = orientation === 'vertical';
	const along = vertical ? size.labelHeight : size.labelWidth;
	const across = vertical ? size.labelWidth : size.labelHeight;
	const side = (vertical ? width : height) / 2 - size.lane - size.carWidth - size.pad;
	const tracks = Math.max(1, Math.min(vertical ? 2 : 3, Math.floor(side / (across + size.gap))));
	// Room past the line for pole's nose and the chequer.
	const lineAt = size.pad + size.carLength * 0.75;
	const lengthPx = Math.max(1, (vertical ? height : width) - lineAt - size.pad - along / 2);
	const middle = (vertical ? width : height) / 2;

	const layout = layoutStraight(cars, {
		lengthPx,
		labelLengthPx: along,
		tracks,
		gapPx: size.gap
	});

	const point = (alongPx: number, acrossPx: number): [number, number] =>
		vertical
			? [middle + acrossPx, lineAt + alongPx]
			: [width - lineAt - alongPx, middle + acrossPx];

	const slots = layout.slots.map((slot): PlacedSlot => {
		const direction = slot.lane === 0 ? -1 : 1;
		const [carX, carY] = point(slot.at, direction * size.lane);
		const offset = size.lane + size.carWidth + size.pad + slot.track * (across + size.gap);
		const [centreX, centreY] = point(slot.labelAt, direction * (offset + across / 2));
		const labelX = centreX - size.labelWidth / 2;
		const labelY = centreY - size.labelHeight / 2;

		const [anchorX, anchorY] = vertical
			? [direction < 0 ? labelX + size.labelWidth : labelX, centreY]
			: [centreX, direction < 0 ? labelY + size.labelHeight : labelY];

		return { ...slot, carX, carY, labelX, labelY, anchorX, anchorY };
	});

	// A figure beside the road where no label sits on it.
	const figure = { along: 0.9 * rem, across: 2.8 * rem };

	const ticks = Array.from(
		{ length: Math.round(layout.metres / layout.tickM) },
		(_, index): StraightTick => {
			const metres = (index + 1) * layout.tickM;
			const at = metres * layout.scale;
			const anchor = point(at, -2 * size.lane - 0.25 * rem);
			const [x, y] = anchor;

			const box = vertical
				? { x0: x - figure.across, y0: y - figure.along / 2, x1: x, y1: y + figure.along / 2 }
				: { x0: x - figure.across / 2, y0: y - figure.along, x1: x + figure.across / 2, y1: y };

			const covered = slots.some(
				(slot) =>
					box.x0 < slot.labelX + size.labelWidth &&
					box.x1 > slot.labelX &&
					box.y0 < slot.labelY + size.labelHeight &&
					box.y1 > slot.labelY
			);

			return { metres, at, text: covered ? null : anchor };
		}
	);

	const [roadX0, roadY0] = point(0, -2 * size.lane);
	const [roadX1, roadY1] = point(lengthPx + along / 2, 2 * size.lane);

	const road = {
		x: Math.min(roadX0, roadX1),
		y: Math.min(roadY0, roadY1),
		width: Math.abs(roadX1 - roadX0),
		height: Math.abs(roadY1 - roadY0)
	};

	return { slots, ticks, road, layout, size, point, lengthPx };
}

/** A car from above with its nose up: the body's outline and its wings, in the team colour. */
export type CarDrawing = {
	body: [number, number][];
	/** `[x, y, width, height]` each. */
	wings: [number, number, number, number][];
};

/** Our own drawing of a car, `length` long and `width` wide, centred on its middle. */
export function carDrawing(length: number, width: number): CarDrawing {
	const half = length / 2;
	const w = width / 2;

	const body: [number, number][] = [
		[0, -half],
		[w * 0.45, -half * 0.55],
		[w * 0.7, half * 0.55],
		[w * 0.45, half * 0.8],
		[-w * 0.45, half * 0.8],
		[-w * 0.7, half * 0.55],
		[-w * 0.45, -half * 0.55]
	];

	return {
		body,
		wings: [
			[-w, -half * 0.92, width, length * 0.08],
			[-w * 0.85, half * 0.8, width * 0.85, length * 0.12]
		]
	};
}

/** "+0.298", or "+12.4" past ten seconds. */
export function formatGap(ms: number): string {
	return `+${(ms / 1000).toFixed(ms < 10_000 ? 3 : 1)}`;
}

/** "22 m", "8.5 m" under ten metres, "1.4 km" past a thousand. */
export function formatDistance(metres: number): string {
	if (metres >= 1000) {
		return `${(metres / 1000).toFixed(1)} km`;
	}

	return `${metres < 10 ? metres.toFixed(1) : Math.round(metres)} m`;
}

/** A car's distance behind, "~" first when it is an estimate. */
export function formatMetres(car: Pick<GapCar, 'metres' | 'estimated'>): string {
	return `${car.estimated ? '~' : ''}${formatDistance(car.metres)}`;
}
