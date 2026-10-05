import * as React from 'react';

/** What counts as one row: a list item, a table row, a card, or anything marked `data-row`. */
const ROW = 'li, tr, article, [data-row]';

const SCROLLS = new Set(['auto', 'scroll']);

/** Where an element starts and ends inside the scroller's content, ignoring the scroll offset. */
function spanWithin(element: Element, body: HTMLElement) {
	const rect = element.getBoundingClientRect();
	const origin = body.getBoundingClientRect().top - body.scrollTop;

	return { top: rect.top - origin, bottom: rect.bottom - origin };
}

/** True when the element sits in a scroller of its own, inside `body`, which keeps its own edge. */
function inNestedScroller(element: Element, body: HTMLElement): boolean {
	for (let node = element.parentElement; node && node !== body; node = node.parentElement) {
		if (SCROLLS.has(getComputedStyle(node).overflowY)) {
			return true;
		}
	}

	return false;
}

/** True for text a screen reader gets and the eye does not: inside a box clipped to a pixel. */
function clippedAway(element: Element, body: HTMLElement): boolean {
	for (let node: Element | null = element; node && node !== body; node = node.parentElement) {
		if (
			node.clientWidth <= 1 &&
			node.clientHeight <= 1 &&
			getComputedStyle(node).overflowY === 'hidden'
		) {
			return true;
		}
	}

	return false;
}

/**
 * The height the tile body ends at so no row or line of text is cut by its bottom edge: the top of
 * the first unit that would straddle it, repeated until none does. Null when nothing is cut or
 * the tile has no room for even one unit.
 */
function wholeHeight(body: HTMLElement, room: number): number | null {
	const units = [...body.querySelectorAll('*')].flatMap((element) => {
		const own = [...element.childNodes].some(
			(node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
		);

		if (
			!own ||
			element.closest('svg, [data-slot=panel-header]') ||
			inNestedScroller(element, body) ||
			clippedAway(element, body)
		) {
			return [];
		}

		const row = element.closest(ROW);

		return [spanWithin(row && body.contains(row) ? row : element, body)];
	});

	let height = room;

	for (let pass = 0; pass < 8; pass += 1) {
		const cut = units.filter((unit) => unit.top < height - 1 && unit.bottom > height + 1);

		if (cut.length === 0) {
			break;
		}

		height = Math.min(...cut.map((unit) => unit.top));
	}

	return height < room && height > room * 0.4 ? Math.floor(height) : null;
}

/**
 * Makes a scrolling tile body end on a whole row: it stops above the first row or line the tile
 * is too short for, and the rest scrolls inside it.
 */
export function useWholeRows(body: React.RefObject<HTMLElement | null>, active: boolean) {
	React.useLayoutEffect(() => {
		const element = body.current;

		if (!element || !active) {
			return;
		}

		const fit = () => {
			element.style.removeProperty('max-height');

			const height = wholeHeight(element, element.clientHeight);

			if (height !== null) {
				element.style.setProperty('max-height', `${height}px`);
			}
		};

		fit();

		// Tiles arrive lazily and rows come and go: refit once after a burst of changes.
		let frame = 0;

		const refit = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(fit);
		};

		const resize = new ResizeObserver(refit);
		const mutation = new MutationObserver(refit);

		resize.observe(element.parentElement ?? element);
		mutation.observe(element, { childList: true, subtree: true });

		for (const child of element.children) {
			resize.observe(child);
		}

		return () => {
			cancelAnimationFrame(frame);
			resize.disconnect();
			mutation.disconnect();
			element.style.removeProperty('max-height');
		};
	}, [body, active]);
}
