import type { Driver } from '@f1-live/shared';

import type { GapCar, GapField } from '@/insights/gap-distance';
import { formatLapTime } from '@/lib/format';

import { inkOn } from '../track/track-draw';
import {
	carDrawing,
	formatDistance,
	formatGap,
	formatMetres,
	placeStraight,
	type PlacedSlot,
	type StraightGeometry
} from './straight-layout';

/** Social sizes: a feed post and a story. */
export const CARD_SIZES = [
	{ id: 'post', label: 'Post 1080 × 1350', width: 1080, height: 1350 },
	{ id: 'story', label: 'Story 1080 × 1920', width: 1080, height: 1920 }
] as const;

export type CardSize = (typeof CARD_SIZES)[number];

/** The page's colours, read from its tokens so a card matches the theme on screen. */
export type CardTheme = {
	panel: string;
	road: string;
	foreground: string;
	muted: string;
	border: string;
};

export function readCardTheme(element: Element): CardTheme {
	const style = getComputedStyle(element);
	const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;

	return {
		panel: token('--panel', '#111'),
		road: token('--muted', '#333'),
		foreground: token('--foreground', '#eee'),
		muted: token('--muted-foreground', '#999'),
		border: token('--border', '#444')
	};
}

export type CardContent = {
	field: GapField;
	drivers: ReadonlyMap<string, Driver>;
	title: string;
	/** The session, such as "Bahrain Grand Prix 2026 Qualifying, Q3". */
	subtitle: string;
	/** One line on how the gaps were measured. */
	note: string;
	brand: string;
	/** The site, without its scheme. */
	site: string;
	theme: CardTheme;
};

const SANS = '"Hubot Sans Variable", ui-sans-serif, system-ui, sans-serif';

const MONO = '"Martian Mono Variable", ui-monospace, monospace';

/** The fonts the card uses, so a first export does not fall back to system faces. */
export async function loadCardFonts(): Promise<void> {
	await Promise.all([
		document.fonts.load(`800 40px ${SANS}`),
		document.fonts.load(`400 24px ${MONO}`),
		document.fonts.load(`800 24px ${MONO}`)
	]);
}

/**
 * The gaps as a picture to share: the title and session over the straight, every car with its
 * label, and the brand and site at the foot. Drawn at the card's own size, whatever the screen.
 */
export function drawGapCard(ctx: CanvasRenderingContext2D, size: CardSize, content: CardContent) {
	const { width, height } = size;
	const { theme } = content;
	const rem = width / 40;
	const margin = 2.5 * rem;

	ctx.fillStyle = theme.panel;
	ctx.fillRect(0, 0, width, height);
	ctx.textBaseline = 'alphabetic';

	// The heavy rule panels open with, then the printed label and the title.
	ctx.fillStyle = theme.foreground;
	ctx.fillRect(margin, margin, width - 2 * margin, 0.2 * rem);
	ctx.font = `700 ${0.8 * rem}px ${MONO}`;
	ctx.fillStyle = theme.muted;
	ctx.fillText(content.brand.toUpperCase(), margin, margin + 1.6 * rem);
	ctx.font = `italic 900 ${2.4 * rem}px ${SANS}`;
	ctx.fillStyle = theme.foreground;
	ctx.fillText(content.title.toUpperCase(), margin, margin + 4.2 * rem, width - 2 * margin);
	ctx.font = `600 ${1 * rem}px ${SANS}`;
	ctx.fillStyle = theme.muted;
	ctx.fillText(content.subtitle, margin, margin + 5.8 * rem, width - 2 * margin);

	const top = margin + 7.2 * rem;
	const foot = 4.5 * rem;
	const bodyHeight = height - top - foot - margin;

	const placed = placeStraight(content.field.cars, {
		width: width - 2 * margin,
		height: bodyHeight,
		rem,
		style: 'full',
		orientation: 'vertical'
	});

	ctx.save();
	ctx.translate(margin, top);
	drawStraight(ctx, placed, content, rem);
	ctx.restore();

	ctx.fillStyle = theme.border;
	ctx.fillRect(margin, height - margin - foot + rem, width - 2 * margin, 2);
	ctx.font = `400 ${0.7 * rem}px ${SANS}`;
	ctx.fillStyle = theme.muted;
	ctx.fillText(content.note, margin, height - margin - foot + 2.4 * rem, width - 2 * margin);
	ctx.font = `700 ${0.75 * rem}px ${MONO}`;
	ctx.fillText(content.site, margin, height - margin - 0.2 * rem);
	ctx.textAlign = 'right';
	ctx.font = `italic 900 ${1 * rem}px ${SANS}`;
	ctx.fillStyle = theme.foreground;
	ctx.fillText(content.brand.toUpperCase(), width - margin, height - margin - 0.2 * rem);
	ctx.textAlign = 'left';
}

function drawStraight(
	ctx: CanvasRenderingContext2D,
	{ slots, ticks, road, size, point }: ReturnType<typeof placeStraight>,
	content: CardContent,
	rem: number
) {
	const { theme } = content;

	ctx.fillStyle = theme.road;
	ctx.fillRect(road.x, road.y, road.width, road.height);

	ctx.font = `400 ${0.55 * rem}px ${MONO}`;
	ctx.textAlign = 'right';
	ctx.textBaseline = 'middle';

	for (const tick of ticks) {
		const [x0, y0] = point(tick.at, -2 * size.lane);
		const [x1] = point(tick.at, 2 * size.lane);

		ctx.fillStyle = theme.muted;
		ctx.globalAlpha = 0.35;
		ctx.fillRect(x0, y0, x1 - x0, 1);
		ctx.globalAlpha = 1;

		if (tick.text) {
			ctx.fillText(formatDistance(tick.metres), tick.text[0], tick.text[1]);
		}
	}

	// The line, chequered.
	const cell = 0.25 * rem;

	for (let column = 0; column < Math.ceil((4 * size.lane) / cell); column++) {
		for (let row = 0; row < 2; row++) {
			const [x, y] = point(-row * cell, -2 * size.lane + column * cell);

			ctx.fillStyle = (row + column) % 2 === 0 ? theme.foreground : theme.panel;
			ctx.fillRect(x, y, cell, cell);
		}
	}

	ctx.strokeStyle = theme.muted;
	ctx.globalAlpha = 0.5;
	ctx.lineWidth = 1.5;

	for (const slot of slots) {
		ctx.beginPath();
		ctx.moveTo(slot.carX, slot.carY);
		ctx.lineTo(slot.anchorX, slot.anchorY);
		ctx.stroke();
	}

	ctx.globalAlpha = 1;

	for (const slot of slots) {
		const driver = content.drivers.get(slot.car.driverNumber);

		if (driver) {
			drawCar(ctx, slot, size, `#${driver.teamColour}`, theme);
		}
	}

	for (const slot of slots) {
		const driver = content.drivers.get(slot.car.driverNumber);

		if (driver) {
			const leaderMs = slot.car.position === 1 ? content.field.leaderMs : null;

			drawLabel(ctx, slot, slot.car, driver, leaderMs, size, rem, theme);
		}
	}
}

function drawCar(
	ctx: CanvasRenderingContext2D,
	slot: PlacedSlot,
	size: StraightGeometry,
	colour: string,
	theme: CardTheme
) {
	const { body, wings } = carDrawing(size.carLength, size.carWidth);

	ctx.save();
	ctx.translate(slot.carX, slot.carY);
	ctx.fillStyle = colour;

	for (const [x, y, w, h] of wings) {
		ctx.fillRect(x, y, w, h);
	}

	ctx.beginPath();

	for (const [x, y] of body) {
		ctx.lineTo(x, y);
	}

	ctx.closePath();
	ctx.fillStyle = colour;
	ctx.fill();
	ctx.strokeStyle = theme.panel;
	ctx.lineWidth = 1;
	ctx.stroke();
	ctx.restore();
}

function drawLabel(
	ctx: CanvasRenderingContext2D,
	slot: PlacedSlot,
	car: GapCar,
	driver: Driver,
	leaderMs: number | null,
	size: StraightGeometry,
	rem: number,
	theme: CardTheme
) {
	const colour = `#${driver.teamColour}`;
	const chip = (car.position >= 10 ? 1.85 : 1.6) * rem;
	const cut = 0.3 * rem;
	const top = 0.55 * size.labelHeight;
	const bottom = top + (size.labelHeight - top) / 2;

	ctx.save();
	ctx.translate(slot.labelX, slot.labelY);
	ctx.fillStyle = theme.panel;
	ctx.fillRect(0, 0, size.labelWidth, size.labelHeight);
	ctx.strokeStyle = theme.border;
	ctx.lineWidth = 1.5;
	ctx.strokeRect(0, 0, size.labelWidth, size.labelHeight);

	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(chip, 0);
	ctx.lineTo(chip - cut, top);
	ctx.lineTo(0, top);
	ctx.closePath();
	ctx.fillStyle = colour;
	ctx.fill();

	ctx.textBaseline = 'middle';
	ctx.textAlign = 'center';
	ctx.font = `800 ${0.62 * rem}px ${MONO}`;
	ctx.fillStyle = inkOn(colour);
	ctx.fillText(`P${car.position}`, (chip - cut) / 2, top / 2);

	ctx.textAlign = 'left';
	ctx.font = `800 ${0.75 * rem}px ${SANS}`;
	ctx.fillStyle = theme.foreground;
	ctx.fillText(driver.code, chip + 0.3 * rem, top / 2);

	ctx.font = `400 ${0.6 * rem}px ${MONO}`;
	ctx.fillText(
		leaderMs !== null
			? formatLapTime(leaderMs)
			: car.position === 1
				? 'Leader'
				: formatGap(car.gapMs),
		0.3 * rem,
		bottom
	);

	if (car.position !== 1) {
		ctx.textAlign = 'right';
		ctx.fillStyle = theme.muted;
		ctx.fillText(formatMetres(car), size.labelWidth - 0.3 * rem, bottom);
	}

	ctx.restore();
}

/** The card as a PNG. */
export async function gapCardBlob(size: CardSize, content: CardContent): Promise<Blob> {
	await loadCardFonts();

	const canvas = document.createElement('canvas');

	canvas.width = size.width;
	canvas.height = size.height;

	const ctx = canvas.getContext('2d');

	if (!ctx) {
		throw new Error('This browser cannot draw the card');
	}

	drawGapCard(ctx, size, content);

	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('The card did not encode'))),
			'image/png'
		);
	});
}
