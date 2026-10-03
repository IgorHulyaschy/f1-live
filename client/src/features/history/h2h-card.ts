import { type CardSize, type CardTheme, loadCardFonts, MONO, SANS } from '../gaps/gap-card';

/** One scoreboard line on the card: both sides' values, as printed. */
export type CardRow = { label: string; a: string; b: string };

export type H2HCardContent = {
	a: { name: string; colour: string };
	b: { name: string; colour: string };
	/** The range, such as "2018 R1 to 2021 R17, 80 races together". */
	subtitle: string;
	rows: CardRow[];
	/** The top generated fact, when there is one. */
	fact: string | null;
	brand: string;
	site: string;
	theme: CardTheme;
};

/** Greedy line breaks for a text of at most three lines. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const lines: string[] = [];
	let line = '';

	for (const word of text.split(' ')) {
		const next = line ? `${line} ${word}` : word;

		if (line && ctx.measureText(next).width > maxWidth) {
			lines.push(line);
			line = word;
		} else {
			line = next;
		}
	}

	return [...lines, line].slice(0, 3);
}

/** The comparison as a picture to share: both names over the scoreboard, a fact, brand at the foot. */
export function drawH2HCard(
	ctx: CanvasRenderingContext2D,
	size: CardSize,
	content: H2HCardContent
) {
	const { width, height } = size;
	const { theme } = content;
	const rem = width / 40;
	const margin = 2.5 * rem;
	const inner = width - 2 * margin;

	ctx.fillStyle = theme.panel;
	ctx.fillRect(0, 0, width, height);
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = theme.foreground;
	ctx.fillRect(margin, margin, inner, 0.2 * rem);
	ctx.font = `700 ${0.8 * rem}px ${MONO}`;
	ctx.fillStyle = theme.muted;
	ctx.fillText('HEAD TO HEAD', margin, margin + 1.6 * rem);

	for (const [index, side] of [content.a, content.b].entries()) {
		const right = index === 1;

		ctx.textAlign = right ? 'right' : 'left';
		ctx.fillStyle = `#${side.colour}`;
		ctx.fillRect(
			right ? width - margin - 0.5 * rem : margin,
			margin + 2.8 * rem,
			0.5 * rem,
			2 * rem
		);
		ctx.font = `italic 900 ${1.9 * rem}px ${SANS}`;
		ctx.fillStyle = theme.foreground;
		ctx.fillText(
			side.name.toUpperCase(),
			right ? width - margin - 1 * rem : margin + 1 * rem,
			margin + 4.6 * rem,
			inner / 2 - 2 * rem
		);
	}

	ctx.textAlign = 'left';
	ctx.font = `600 ${1 * rem}px ${SANS}`;
	ctx.fillStyle = theme.muted;
	ctx.fillText(content.subtitle, margin, margin + 6.6 * rem, inner);

	const top = margin + 8 * rem;
	const factSpace = content.fact ? 7 * rem : 0;
	const foot = 3.5 * rem;
	const available = height - top - foot - margin - factSpace;
	const step = Math.min(3.6 * rem, available / Math.max(1, content.rows.length));

	for (const [index, row] of content.rows.entries()) {
		const y = top + (index + 1) * step;

		ctx.fillStyle = theme.border;
		ctx.fillRect(margin, y - step + 0.5 * rem, inner, 2);
		ctx.textAlign = 'left';
		ctx.font = `800 ${1.5 * rem}px ${MONO}`;
		ctx.fillStyle = theme.foreground;
		ctx.fillText(row.a, margin, y - 0.8 * rem);
		ctx.textAlign = 'right';
		ctx.fillText(row.b, width - margin, y - 0.8 * rem);
		ctx.textAlign = 'center';
		ctx.font = `700 ${0.8 * rem}px ${MONO}`;
		ctx.fillStyle = theme.muted;
		ctx.fillText(row.label.toUpperCase(), width / 2, y - 0.9 * rem);
	}

	ctx.textAlign = 'left';

	if (content.fact) {
		ctx.font = `600 ${1.1 * rem}px ${SANS}`;
		ctx.fillStyle = theme.foreground;

		for (const [index, line] of wrap(ctx, content.fact, inner).entries()) {
			ctx.fillText(
				line,
				margin,
				height - margin - foot - factSpace + 2.5 * rem + index * 1.5 * rem
			);
		}
	}

	ctx.fillStyle = theme.border;
	ctx.fillRect(margin, height - margin - foot + rem, inner, 2);
	ctx.font = `700 ${0.75 * rem}px ${MONO}`;
	ctx.fillStyle = theme.muted;
	ctx.fillText(content.site, margin, height - margin - 0.2 * rem);
	ctx.textAlign = 'right';
	ctx.font = `italic 900 ${1 * rem}px ${SANS}`;
	ctx.fillStyle = theme.foreground;
	ctx.fillText(content.brand.toUpperCase(), width - margin, height - margin - 0.2 * rem);
	ctx.textAlign = 'left';
}

/** The card as a PNG. */
export async function h2hCardBlob(size: CardSize, content: H2HCardContent): Promise<Blob> {
	await loadCardFonts();

	const canvas = document.createElement('canvas');

	canvas.width = size.width;
	canvas.height = size.height;

	const ctx = canvas.getContext('2d');

	if (!ctx) {
		throw new Error('This browser cannot draw the card');
	}

	drawH2HCard(ctx, size, content);

	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('The card did not encode'))),
			'image/png'
		);
	});
}
