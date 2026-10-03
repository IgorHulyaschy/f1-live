import { outlineStepM, pointOnTrack, type Point, type TrackOutline } from '@f1-live/shared';

import type { CarPlace } from './track-frames.ts';

/** Colours read from the theme's tokens, so the map follows light and dark. */
export type MapTheme = {
	foreground: string;
	muted: string;
	panel: string;
	focus: string;
	fastest: string;
	personalBest: string;
	flag: string;
	danger: string;
};

export function readTheme(element: Element): MapTheme {
	const style = getComputedStyle(element);
	const token = (name: string) => style.getPropertyValue(name).trim() || '#888';

	return {
		foreground: token('--foreground'),
		muted: token('--muted-foreground'),
		panel: token('--panel'),
		focus: token('--focus'),
		fastest: token('--fastest'),
		personalBest: token('--personal-best'),
		flag: token('--flag'),
		danger: token('--danger')
	};
}

/** A label's room on the canvas, in CSS pixels. */
export type Box = { x0: number; y0: number; x1: number; y1: number };

/** Maps the feed's metres onto the canvas: turned so the long side lies flat, y up. */
export type View = {
	/** Canvas pixels per metre. */
	scale: number;
	cos: number;
	sin: number;
	/** The world point at the canvas centre `(width / 2, height / 2)`, in CSS pixels. */
	centre: Point;
	width: number;
	height: number;
};

function rotate(view: Pick<View, 'cos' | 'sin'>, [x, y]: Point): Point {
	return [x * view.cos - y * view.sin, x * view.sin + y * view.cos];
}

export function toScreen(view: View, point: Point): Point {
	const [rx, ry] = rotate(view, point);
	const [cx, cy] = rotate(view, view.centre);

	return [view.width / 2 + (rx - cx) * view.scale, view.height / 2 - (ry - cy) * view.scale];
}

/** A box in turned metres. */
export type Bounds = { min: Point; max: Point };

/** The outline's extent once turned: what a full view must fit. */
export function turnedBounds(outline: TrackOutline, rotationDeg: number): Bounds {
	const turn = {
		cos: Math.cos((rotationDeg * Math.PI) / 180),
		sin: Math.sin((rotationDeg * Math.PI) / 180)
	};

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const point of [...outline.points, ...(outline.pitLane?.points ?? [])]) {
		const [x, y] = rotate(turn, point);

		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x);
		maxY = Math.max(maxY, y);
	}

	return { min: [minX, minY], max: [maxX, maxY] };
}

/**
 * A view that fits the circuit inside `width` × `height` with `padding` pixels round it. A tall
 * tile turns a wide circuit upright, so a phone column shows it as large as it can.
 */
export function fitView(
	outline: TrackOutline,
	width: number,
	height: number,
	padding: number
): View {
	const fit = (rotationDeg: number) => {
		const { min, max } = turnedBounds(outline, rotationDeg);
		const spanX = Math.max(1, max[0] - min[0]);
		const spanY = Math.max(1, max[1] - min[1]);

		const scale = Math.max(
			0.01,
			Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY)
		);

		const centreTurned: Point = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2];

		return { rotationDeg, scale, centreTurned };
	};

	const flat = fit(outline.rotationDeg);
	const upright = fit(outline.rotationDeg + 90);
	const best = upright.scale > flat.scale * 1.15 ? upright : flat;
	const radians = (best.rotationDeg * Math.PI) / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	// Turn the centre back into the feed's frame.
	const [tx, ty] = best.centreTurned;

	return {
		scale: best.scale,
		cos,
		sin,
		centre: [tx * cos + ty * sin, -tx * sin + ty * cos],
		width,
		height
	};
}

/** The same turn, centred on `centre` at `zoom` times the scale. */
export function zoomedView(base: View, centre: Point, zoom: number): View {
	return { ...base, centre, scale: base.scale * zoom };
}

/** Distance along the lap to the points of the outline from `fromM` to `toM`, wrapping round. */
function pointsAlong(outline: TrackOutline, fromM: number, toM: number): Point[] {
	const step = outlineStepM(outline);
	const span = toM >= fromM ? toM - fromM : toM + outline.lengthM - fromM;
	const points: Point[] = [];
	const first = pointOnTrack(outline, fromM);

	points.push([first.x, first.y]);

	for (let distance = Math.ceil(fromM / step) * step; distance < fromM + span; distance += step) {
		const point = pointOnTrack(outline, distance);

		points.push([point.x, point.y]);
	}

	const last = pointOnTrack(outline, fromM + span);

	points.push([last.x, last.y]);

	return points;
}

function strokeScreen(
	ctx: CanvasRenderingContext2D,
	view: View,
	points: readonly Point[],
	closed: boolean
): void {
	ctx.beginPath();
	points.forEach((point, index) => {
		const [x, y] = toScreen(view, point);

		if (index === 0) {
			ctx.moveTo(x, y);
		} else {
			ctx.lineTo(x, y);
		}
	});

	if (closed) {
		ctx.closePath();
	}

	ctx.stroke();
}

/** A stretch of the circuit painted over the track: a mini sector, a flag, a zone. */
export type Overlay = {
	fromM: number;
	toM: number;
	colour: string;
	/** Drawn as dashes: the second car of a team, or a guessed span. */
	dashed?: boolean;
	/** 1 is the track's width. */
	width?: number;
	alpha?: number;
};

export type TrackStyle = {
	/** Pixels per rem, so the drawing scales with the text size. */
	rem: number;
	/** Track width as a multiple of the default. */
	weight: number;
	overlays: readonly Overlay[];
	/** Faint bands beside the track, such as DRS zones. */
	zones: readonly Overlay[];
	/** Sector ends and the line, with their labels. */
	marks: boolean;
	/** Neutralised (SC/VSC) or stopped (red) sessions tint the circuit. */
	tint: string | null;
};

/**
 * Draws the circuit: the track, the pit lane, painted stretches, the line and sector ends. Gives
 * back where its labels went, so car labels keep clear of them.
 */
export function drawCircuit(
	ctx: CanvasRenderingContext2D,
	view: View,
	outline: TrackOutline,
	theme: MapTheme,
	style: TrackStyle
): Box[] {
	const unit = style.rem / 16;
	const trackWidth = Math.max(4, 7 * unit * style.weight);

	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';

	for (const zone of style.zones) {
		ctx.globalAlpha = zone.alpha ?? 0.14;
		ctx.strokeStyle = zone.colour;
		ctx.lineWidth = trackWidth * (zone.width ?? 2.6);
		ctx.setLineDash([]);
		strokeScreen(ctx, view, pointsAlong(outline, zone.fromM, zone.toM), false);
	}

	if (outline.pitLane) {
		ctx.globalAlpha = 0.35;
		ctx.strokeStyle = theme.foreground;
		ctx.lineWidth = Math.max(1.5, trackWidth * 0.3);
		ctx.setLineDash([4 * unit, 3 * unit]);
		strokeScreen(ctx, view, outline.pitLane.points, false);
		ctx.setLineDash([]);
	}

	ctx.globalAlpha = style.tint ? 0.55 : 0.2;
	ctx.strokeStyle = style.tint ?? theme.foreground;
	ctx.lineWidth = trackWidth;
	strokeScreen(ctx, view, outline.points, true);

	for (const overlay of style.overlays) {
		ctx.globalAlpha = overlay.alpha ?? 1;
		ctx.strokeStyle = overlay.colour;
		ctx.lineWidth = trackWidth * (overlay.width ?? 1);
		ctx.lineCap = 'butt';
		ctx.setLineDash(overlay.dashed ? [trackWidth * 1.2, trackWidth * 0.8] : []);
		strokeScreen(ctx, view, pointsAlong(outline, overlay.fromM, overlay.toM), false);
	}

	ctx.setLineDash([]);
	ctx.lineCap = 'round';
	ctx.globalAlpha = 1;

	return style.marks ? drawMarks(ctx, view, outline, theme, trackWidth, unit) : [];
}

/** A mark across the track: where it is on screen, and the way out from the track there. */
type Tick = { at: Point; normal: Point };

/** A short line across the track at `distanceM`. */
function tick(
	ctx: CanvasRenderingContext2D,
	view: View,
	outline: TrackOutline,
	distanceM: number,
	halfLength: number
): Tick {
	const point = pointOnTrack(outline, distanceM);
	const [x, y] = toScreen(view, [point.x, point.y]);

	const [ax, ay] = toScreen(view, [
		point.x + Math.cos(point.headingRad),
		point.y + Math.sin(point.headingRad)
	]);

	const length = Math.hypot(ax - x, ay - y) || 1;
	const normal: Point = [-(ay - y) / length, (ax - x) / length];

	ctx.beginPath();
	ctx.moveTo(x - normal[0] * halfLength, y - normal[1] * halfLength);
	ctx.lineTo(x + normal[0] * halfLength, y + normal[1] * halfLength);
	ctx.stroke();

	return { at: [x, y], normal } satisfies Tick;
}

function drawMarks(
	ctx: CanvasRenderingContext2D,
	view: View,
	outline: TrackOutline,
	theme: MapTheme,
	trackWidth: number,
	unit: number
): Box[] {
	ctx.strokeStyle = theme.foreground;
	ctx.lineWidth = Math.max(1.5, 2 * unit);
	ctx.globalAlpha = 0.9;
	tick(ctx, view, outline, 0, trackWidth * 1.4);

	ctx.font = `600 ${Math.round(9 * unit)}px "Martian Mono Variable", ui-monospace, monospace`;
	ctx.fillStyle = theme.muted;
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'center';
	ctx.lineWidth = Math.max(1, 1.25 * unit);
	ctx.globalAlpha = 0.7;

	const boxes = outline.sectorBoundariesM.map((boundary, index): Box => {
		const { at, normal } = tick(ctx, view, outline, boundary, trackWidth);
		const offset = trackWidth + 9 * unit;
		const x = at[0] + normal[0] * offset;
		const y = at[1] + normal[1] * offset;
		const half = 9 * unit;

		ctx.fillText(`S${index + 2}`, x, y);

		return { x0: x - half, y0: y - half / 1.5, x1: x + half, y1: y + half / 1.5 };
	});

	ctx.globalAlpha = 1;

	return boxes;
}

/** Black or white text, whichever reads on a team colour. */
export function inkOn(hex: string): string {
	const value = Number.parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
	const channel = (shift: number) => ((value >> shift) & 255) / 255;
	const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);

	return luminance > 0.55 ? '#111111' : '#ffffff';
}

export type CarStyle = {
	colour: string;
	label: string;
	/** The followed driver: drawn larger, with a car-shaped chip. */
	followed: boolean;
	/** Placed from timing, not seen: drawn hollow. */
	estimated: boolean;
	/** Highlighted in a battle or rejoin view. */
	emphasis?: boolean;
	dashed?: boolean;
};

function overlaps(box: Box, placed: readonly Box[]): boolean {
	return placed.some(
		(other) => box.x0 < other.x1 && box.x1 > other.x0 && box.y0 < other.y1 && box.y1 > other.y0
	);
}

/**
 * Cars as team-colour discs, labelled with their code beside the track, away from the middle of
 * the circuit. Labels that would cover another are left out, except the followed driver's; cars
 * are drawn in `cars` order, so pass the followed one last.
 */
export function drawCars(
	ctx: CanvasRenderingContext2D,
	view: View,
	cars: readonly { place: CarPlace; style: CarStyle }[],
	theme: MapTheme,
	rem: number,
	middle: Point,
	reserved: readonly Box[] = []
): void {
	const unit = rem / 16;
	const placed: Box[] = [...reserved];
	const [mx, my] = toScreen(view, middle);
	const labelFont = `700 ${Math.round(10 * unit)}px "Martian Mono Variable", ui-monospace, monospace`;
	const screens = cars.map(({ place }) => toScreen(view, [place.x, place.y]));

	ctx.textBaseline = 'middle';

	// Discs first, then labels over them, so a label is never hidden under another car.
	cars.forEach(({ place, style }, index) => {
		const [x, y] = screens[index] ?? [0, 0];
		const radius = (style.followed ? 7.5 : style.emphasis ? 6.5 : 5.5) * unit;

		placed.push({ x0: x - radius, y0: y - radius, x1: x + radius, y1: y + radius });
		ctx.globalAlpha = place.state === 'pit' ? 0.7 : 1;
		ctx.beginPath();
		ctx.arc(x, y, radius, 0, Math.PI * 2);
		ctx.fillStyle = style.estimated ? theme.panel : style.colour;
		ctx.fill();
		ctx.lineWidth = style.estimated ? 2.5 * unit : 1.5 * unit;
		ctx.strokeStyle = style.estimated
			? style.colour
			: place.state === 'off'
				? theme.danger
				: theme.panel;
		ctx.setLineDash(style.dashed && style.estimated ? [2 * unit, 1.5 * unit] : []);
		ctx.stroke();
		ctx.setLineDash([]);

		if (style.followed) {
			ctx.beginPath();
			ctx.arc(x, y, radius + 3 * unit, 0, Math.PI * 2);
			ctx.strokeStyle = theme.foreground;
			ctx.lineWidth = 1.5 * unit;
			ctx.stroke();
		}
	});

	ctx.globalAlpha = 1;

	const order = cars
		.map((car, index) => ({ car, index }))
		.toSorted((a, b) => Number(b.car.style.followed) - Number(a.car.style.followed));

	for (const { car, index } of order) {
		const [x, y] = screens[index] ?? [0, 0];
		const { style } = car;

		ctx.font = style.followed
			? `800 ${Math.round(11 * unit)}px "Martian Mono Variable", ui-monospace, monospace`
			: labelFont;

		const textWidth = ctx.measureText(style.label).width;
		const padX = style.followed ? 6 * unit : 0;
		const width = textWidth + padX * 2;
		const height = (style.followed ? 16 : 11) * unit;
		const away = Math.hypot(x - mx, y - my) || 1;

		const sides: Point[] = [
			[(x - mx) / away, (y - my) / away],
			[-(x - mx) / away, -(y - my) / away]
		];

		let box: Box | null = null;

		for (const [nx, ny] of sides) {
			const gap = (style.followed ? 13 : 9) * unit;
			const cx = x + nx * (gap + width / 2);
			const cy = y + ny * (gap + height / 2);

			const candidate = {
				x0: cx - width / 2,
				y0: cy - height / 2,
				x1: cx + width / 2,
				y1: cy + height / 2
			};

			if (style.followed || !overlaps(candidate, placed)) {
				box = candidate;
				break;
			}
		}

		if (!box) {
			continue;
		}

		placed.push(box);

		if (style.followed) {
			// The followed driver's chip carries the forward cut that means "this is a car".
			const cut = 4 * unit;

			ctx.beginPath();
			ctx.moveTo(box.x0 + cut, box.y0);
			ctx.lineTo(box.x1, box.y0);
			ctx.lineTo(box.x1 - cut, box.y1);
			ctx.lineTo(box.x0, box.y1);
			ctx.closePath();
			ctx.fillStyle = style.colour;
			ctx.fill();
			ctx.fillStyle = inkOn(style.colour);
			ctx.textAlign = 'center';
			ctx.fillText(style.label, (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2 + 0.5);
			continue;
		}

		ctx.textAlign = 'center';
		ctx.lineWidth = 3 * unit;
		ctx.strokeStyle = theme.panel;
		ctx.globalAlpha = car.place.state === 'pit' ? 0.7 : 1;
		ctx.strokeText(style.label, (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2);
		ctx.fillStyle = style.emphasis ? theme.foreground : theme.muted;
		ctx.fillText(style.label, (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2);
		ctx.globalAlpha = 1;
	}
}

/** The middle of the circuit, for setting labels outside it. */
export function outlineMiddle(outline: TrackOutline): Point {
	let sumX = 0;
	let sumY = 0;

	for (const [x, y] of outline.points) {
		sumX += x;
		sumY += y;
	}

	return [sumX / outline.points.length, sumY / outline.points.length];
}
