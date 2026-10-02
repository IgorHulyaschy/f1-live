import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { arrangeTile } from './arrange.ts';
import {
	addTile,
	GRID_COLUMNS,
	parseDashboardListText,
	parseDashboardText,
	PRESETS,
	readingOrder,
	swapTiles
} from './dashboards.ts';

function overlaps(
	a: { x: number; y: number; w: number; h: number },
	b: { x: number; y: number; w: number; h: number }
): boolean {
	return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe('presets', () => {
	it('fit the grid without overlapping tiles', () => {
		for (const dashboard of PRESETS) {
			for (const place of dashboard.layout) {
				assert.ok(place.x + place.w <= GRID_COLUMNS, `${dashboard.id} ${place.i}`);
			}

			for (const [index, place] of dashboard.layout.entries()) {
				for (const other of dashboard.layout.slice(index + 1)) {
					assert.equal(overlaps(place, other), false, `${dashboard.id} ${place.i} ${other.i}`);
				}
			}
		}
	});
});

describe('dashboard edits', () => {
	const live = PRESETS[0];

	it('adds a tile under everything else', () => {
		assert.ok(live);
		const next = addTile(live, 'pit-stops', 'new');
		const place = next.layout.find((entry) => entry.i === 'new');

		assert.deepEqual(place && { x: place.x, y: place.y }, { x: 0, y: 23 });
	});

	it('stacks tiles top to bottom, then left to right', () => {
		assert.ok(live);
		assert.deepEqual(
			readingOrder(live).map((tile) => tile.kind),
			['timing', 'focus', 'race-control']
		);
	});

	it('moves a tile by swapping places', () => {
		assert.ok(live);
		const swapped = swapTiles(live, 'live-0', 'live-1');

		assert.deepEqual(
			readingOrder(swapped).map((tile) => tile.kind),
			['focus', 'timing', 'race-control']
		);
	});
});

describe('parsing', () => {
	it('round-trips an exported dashboard', () => {
		const [analysis] = PRESETS.slice(1);

		assert.deepEqual(parseDashboardText(JSON.stringify(analysis)), analysis);
	});

	it('drops unknown tiles and broken placements, keeps the rest', () => {
		const parsed = parseDashboardText(
			JSON.stringify({
				id: 'mine',
				name: 'Mine',
				tiles: [
					{ id: 'a', kind: 'timing' },
					{ id: 'b', kind: 'not-a-tile' },
					{ id: 'c', kind: 'chart', settings: { metric: 'nonsense' } }
				],
				layout: [
					{ i: 'a', x: 0, y: 0, w: 12, h: 10 },
					{ i: 'b', x: 0, y: 10, w: 12, h: 10 },
					{ i: 'c', x: 40, y: 0, w: 12, h: 10 }
				]
			})
		);

		assert.deepEqual(parsed?.tiles, [{ id: 'a', kind: 'timing' }]);
	});

	it('rejects text that is not a dashboard', () => {
		assert.equal(parseDashboardText('not json'), null);
		assert.equal(parseDashboardText('{"name": 3}'), null);
		assert.deepEqual(parseDashboardListText('{"broken"'), []);
	});
});

describe('keyboard arranging', () => {
	const live = PRESETS[0];

	it('moves a tile above the one over it', () => {
		assert.ok(live);
		assert.deepEqual(
			readingOrder(arrangeTile(live, 'live-2', 'ArrowUp', false)).map((tile) => tile.kind),
			['timing', 'race-control', 'focus']
		);
	});

	it('resizes within the grid and the tile minimum', () => {
		assert.ok(live);
		const wider = arrangeTile(live, 'live-1', 'ArrowRight', true);
		const narrower = arrangeTile(live, 'live-1', 'ArrowLeft', true);

		assert.equal(wider.layout.find((place) => place.i === 'live-1')?.w, 8);
		assert.equal(narrower.layout.find((place) => place.i === 'live-1')?.w, 7);
	});
});
