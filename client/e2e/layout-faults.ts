import { expect, type Page } from '@playwright/test';

import { openRace } from './fixtures.ts';

export const LAYOUT_SIZES = [
	{ width: 1280, height: 720 },
	{ width: 1512, height: 860 },
	{ width: 1440, height: 900 },
	{ width: 1920, height: 1080 }
];

/**
 * What a viewer sees cut or crowded on a dashboard: tiles that overlap, text that runs past its
 * tile where nothing scrolls, and a row or line sliced by the edge of a list that scrolls.
 */
/* oxlint-disable unicorn/consistent-function-scoping -- this runs inside the page, so every helper lives in it. */
function findLayoutFaults(): string[] {
	const faults: string[] = [];

	const tiles = [...document.querySelectorAll<HTMLElement>('[data-tile-id]')].filter(
		(tile) => tile.getBoundingClientRect().height > 0
	);

	const name = (tile: Element) => tile.getAttribute('data-testid');

	for (const [index, tile] of tiles.entries()) {
		const a = tile.getBoundingClientRect();

		for (const other of tiles.slice(index + 1)) {
			const b = other.getBoundingClientRect();

			if (
				a.left < b.right - 1 &&
				b.left < a.right - 1 &&
				a.top < b.bottom - 1 &&
				b.top < a.bottom - 1
			) {
				faults.push(`overlap: ${name(tile)} and ${name(other)}`);
			}
		}
	}

	const scrolls = (element: Element) => {
		const { overflowY } = getComputedStyle(element);

		return (
			(overflowY === 'auto' || overflowY === 'scroll') &&
			element.scrollHeight > element.clientHeight + 1
		);
	};

	// Text a screen reader gets and the eye does not: inside a box clipped to a pixel.
	const clippedAway = (element: Element, tile: Element) => {
		for (let node: Element | null = element; node && node !== tile; node = node.parentElement) {
			if (
				node.clientWidth <= 1 &&
				node.clientHeight <= 1 &&
				getComputedStyle(node).overflowY === 'hidden'
			) {
				return true;
			}
		}

		return false;
	};

	for (const tile of tiles) {
		const frame = tile.getBoundingClientRect();

		const candidates = [...tile.querySelectorAll<HTMLElement | SVGElement>('*')].filter(
			(element) => {
				const rect = element.getBoundingClientRect();

				const own = [...element.childNodes].some(
					(node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
				);

				return (
					rect.height > 0 &&
					rect.width > 0 &&
					getComputedStyle(element).visibility !== 'hidden' &&
					!element.closest(
						'[data-slot=panel-header], [data-testid=tile-bar], .react-resizable-handle'
					) &&
					!clippedAway(element, tile) &&
					(own || element.matches('li, tr, article, [data-row]'))
				);
			}
		);

		for (const element of candidates) {
			const rect = element.getBoundingClientRect();
			let scroller: Element | null = element.parentElement;

			while (scroller && scroller !== tile && !scrolls(scroller)) {
				scroller = scroller.parentElement;
			}

			const label = `${name(tile)}: ${(element.textContent ?? '').trim().slice(0, 28)}`;

			if (scroller && scroller !== tile) {
				const edge = scroller.getBoundingClientRect().bottom;

				if (rect.top < edge - 1 && rect.bottom > edge + 1) {
					faults.push(`partial row: ${label}`);
				}
			} else if (rect.bottom > frame.bottom + 1 || rect.right > frame.right + 1) {
				faults.push(`overflow: ${label}`);
			}
		}
	}

	return faults;
}
/* oxlint-enable unicorn/consistent-function-scoping */

/** Waits until the tiles have stopped changing: lazy tiles and charts arrive after the grid. */
async function settled(page: Page) {
	await page.evaluate(() => document.fonts.ready);

	let last = '';
	let steady = 0;

	while (steady < 4) {
		// oxlint-disable-next-line no-await-in-loop -- sampling over time is the point.
		const now = await page.evaluate(() =>
			[...document.querySelectorAll('[data-tile-id]')]
				.map((tile) => `${tile.innerHTML.length}:${tile.getBoundingClientRect().height}`)
				.join(',')
		);

		steady = now === last ? steady + 1 : 0;
		last = now;
		// oxlint-disable-next-line no-await-in-loop -- as above.
		await page.waitForTimeout(250);
	}
}

/** Opens each tab at the size and fails for every overlap, overflow and cut row on any of them. */
export async function expectNoLayoutFaults(
	page: Page,
	size: { width: number; height: number },
	paths: readonly string[]
) {
	await page.setViewportSize(size);

	for (const path of paths) {
		// oxlint-disable-next-line no-await-in-loop -- one tab after another, each measured once.
		await openRace(page, path);
		// oxlint-disable-next-line no-await-in-loop -- as above.
		await expect(page.getByTestId('dashboard-grid')).toBeVisible();
		// oxlint-disable-next-line no-await-in-loop -- as above.
		await settled(page);
		// oxlint-disable-next-line no-await-in-loop -- as above.
		await expect.soft.poll(() => page.evaluate(findLayoutFaults), { message: path }).toEqual([]);
	}
}
