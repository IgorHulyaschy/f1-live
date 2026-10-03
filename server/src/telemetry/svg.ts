import { pointOnTrack, sectorOfMiniSector } from '@f1-live/shared';
import type { Point, TrackOutline } from '@f1-live/shared';

const WIDTH = 1000;

const MARGIN = 70;

const LABEL_OFFSET_M = 55;

const TICK_M = 22;

/** Mini sectors alternate between two tints so neighbours can be told apart; sectors differ in hue. */
const SECTOR_COLOURS = [
	['#e8665d', '#b4443b'],
	['#4f9fe0', '#2f78b4'],
	['#e8b84d', '#b98a22']
] as const;

function rotate([x, y]: Point, degrees: number): Point {
	const radians = (degrees * Math.PI) / 180;

	return [
		x * Math.cos(radians) - y * Math.sin(radians),
		x * Math.sin(radians) + y * Math.cos(radians)
	];
}

/**
 * A picture of the outline for review: the track in the colours of its mini sectors, a numbered
 * tick at each boundary, the start/finish line and the pit lane. The long side is horizontal and
 * north is up as the feed's y axis, so a circuit looks as on a map.
 */
export function renderOutlineSvg(outline: TrackOutline): string {
	const turned = (point: Point) => rotate(point, outline.rotationDeg);
	const all = [...outline.points, ...(outline.pitLane?.points ?? [])].map(turned);
	const xs = all.map(([x]) => x);
	const ys = all.map(([, y]) => y);
	const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
	const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
	const scale = (WIDTH - 2 * MARGIN) / (maxX - minX);
	const height = Math.round((maxY - minY) * scale + 2 * MARGIN + 60);

	const place = ([x, y]: Point): string => {
		const [turnedX, turnedY] = turned([x, y]);

		return `${((turnedX - minX) * scale + MARGIN).toFixed(1)},${((maxY - turnedY) * scale + MARGIN).toFixed(1)}`;
	};

	const starts = outline.miniSectorStartsM;
	const step = outline.lengthM / outline.points.length;

	const pieces = starts.map((from, index) => {
		const to = starts[index + 1] ?? outline.lengthM;
		const first = Math.ceil(from / step);
		const last = Math.floor(to / step);

		const path = [pointOnTrack(outline, from)]
			.concat(
				Array.from({ length: Math.max(0, last - first + 1) }, (_, offset) =>
					pointOnTrack(outline, (first + offset) * step)
				),
				[pointOnTrack(outline, to)]
			)
			.map(({ x, y }) => place([x, y]))
			.join(' ');

		const [even, odd] = SECTOR_COLOURS[sectorOfMiniSector(outline, index)] ?? SECTOR_COLOURS[0];

		return `<polyline points="${path}" fill="none" stroke="${index % 2 === 0 ? even : odd}" stroke-width="9" stroke-linecap="butt" stroke-linejoin="round"/>`;
	});

	const ticks = starts.map((from, index) => {
		const { x, y, headingRad } = pointOnTrack(outline, from);
		const normal = headingRad + Math.PI / 2;

		const edge = (distance: number): string =>
			place([x + Math.cos(normal) * distance, y + Math.sin(normal) * distance]);

		const [labelX, labelY] = edge(LABEL_OFFSET_M).split(',');

		return [
			`<line x1="${edge(-TICK_M).split(',')[0]}" y1="${edge(-TICK_M).split(',')[1]}" x2="${edge(TICK_M).split(',')[0]}" y2="${edge(TICK_M).split(',')[1]}" stroke="#14171c" stroke-width="2"/>`,
			`<text x="${labelX}" y="${labelY}" font-size="11" text-anchor="middle" dominant-baseline="middle" fill="#14171c">${index + 1}</text>`
		].join('');
	});

	const sectorLines = outline.sectorBoundariesM.map((distance, index) => {
		const { x, y, headingRad } = pointOnTrack(outline, distance);
		const normal = headingRad + Math.PI / 2;
		const [x1, y1] = place([x - Math.cos(normal) * 34, y - Math.sin(normal) * 34]).split(',');
		const [x2, y2] = place([x + Math.cos(normal) * 34, y + Math.sin(normal) * 34]).split(',');

		return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#14171c" stroke-width="4"/><text x="${x2}" y="${y2}" font-size="13" font-weight="700" fill="#14171c" dx="6" dy="-6">S${index + 1}|S${index + 2}</text>`;
	});

	const finish = pointOnTrack(outline, 0);
	const [finishX, finishY] = place([finish.x, finish.y]).split(',');

	const pit =
		outline.pitLane === null
			? ''
			: `<polyline points="${outline.pitLane.points.map(place).join(' ')}" fill="none" stroke="#6b7280" stroke-width="4" stroke-dasharray="10 6"/>`;

	const lines = [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" font-family="system-ui, sans-serif">`,
		`<rect width="100%" height="100%" fill="#f6f7f9"/>`,
		pit,
		...pieces,
		...sectorLines,
		...ticks,
		`<circle cx="${finishX}" cy="${finishY}" r="9" fill="#14171c"/><text x="${finishX}" y="${finishY}" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">S/F</text>`,
		`<text x="${MARGIN}" y="34" font-size="20" font-weight="700" fill="#14171c">${outline.name}: ${(outline.lengthM / 1000).toFixed(3)} km, ${starts.length} mini sectors</text>`,
		`<text x="${MARGIN}" y="${height - 24}" font-size="12" fill="#4b5563">Drawn from driver ${outline.source.driverNumber}, lap ${outline.source.lap} of session ${outline.source.sessionKey}; boundaries from ${outline.source.miniSectors === 'timing' ? 'the timing feed' : 'an even split'}. Rotated ${outline.rotationDeg}°.</text>`,
		'</svg>'
	];

	return lines.join('\n');
}
