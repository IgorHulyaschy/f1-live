import { cloneLayout, moveElement, verticalCompactor } from 'react-grid-layout/core';

import { type Dashboard, GRID_COLUMNS, TILE_INFO } from './dashboards.ts';

export type ArrangeKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

/**
 * Moves or resizes a tile from the keyboard, the way dragging would: tiles in the way are pushed
 * aside and the grid closes gaps upward. Up and down jump past the neighbouring tile, since a
 * one-row step would be undone by that upward packing.
 */
export function arrangeTile(
	dashboard: Dashboard,
	tileId: string,
	key: ArrangeKey,
	resize: boolean
): Dashboard {
	const layout = cloneLayout(dashboard.layout);
	const item = layout.find((entry) => entry.i === tileId);
	const tile = dashboard.tiles.find((entry) => entry.id === tileId);

	if (!item || !tile) {
		return dashboard;
	}

	const min = TILE_INFO[tile.kind].min;
	let x = item.x;
	let y = item.y;

	if (resize) {
		const dw = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
		const dh = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;

		item.w = Math.min(Math.max(item.w + dw, min.w), GRID_COLUMNS - item.x);
		item.h = Math.max(item.h + dh, min.h);
	} else if (key === 'ArrowLeft' || key === 'ArrowRight') {
		x = Math.min(Math.max(x + (key === 'ArrowRight' ? 1 : -1), 0), GRID_COLUMNS - item.w);
	} else {
		const sideBySide = layout.filter(
			(other) => other !== item && other.x < item.x + item.w && item.x < other.x + other.w
		);

		const neighbour =
			key === 'ArrowUp'
				? sideBySide.filter((other) => other.y < item.y).toSorted((a, b) => b.y - a.y)[0]
				: sideBySide.filter((other) => other.y > item.y).toSorted((a, b) => a.y - b.y)[0];

		if (!neighbour) {
			return dashboard;
		}

		y = key === 'ArrowUp' ? neighbour.y : neighbour.y + neighbour.h;
	}

	const moved = verticalCompactor.compact(
		moveElement(layout, item, x, y, true, false, 'vertical', GRID_COLUMNS),
		GRID_COLUMNS
	);

	return {
		...dashboard,
		layout: moved.map(({ i, x: left, y: top, w, h }) => ({ i, x: left, y: top, w, h }))
	};
}
