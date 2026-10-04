import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PRESET_IDS, sameDashboard } from '@f1-live/shared/dashboard';
import { SEED_EXAMPLES } from '@f1-live/shared/library-examples';

import { arrangeTile } from './arrange.ts';
import {
	addTile,
	buildDashboard,
	drillDashboard,
	GRID_COLUMNS,
	moveInStack,
	onScreen,
	parseDashboardListText,
	parseDashboardText,
	PRESETS,
	readingOrder,
	removeTile,
	SCREEN_ROWS,
	stackOrder,
	TILE_INFO,
	withPlacements
} from './dashboards.ts';
import { decodeShare, encodeShare } from '../library/share.ts';

function overlaps(
	a: { x: number; y: number; w: number; h: number },
	b: { x: number; y: number; w: number; h: number }
): boolean {
	return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe('presets and library dashboards', () => {
	it('match the preset ids the account server leaves out of the Free count', () => {
		assert.deepEqual(
			PRESETS.map((dashboard) => dashboard.id),
			[...PRESET_IDS]
		);
	});

	it('fit the grid, respect tile minimums and do not overlap, on every screen class', () => {
		for (const dashboard of [...PRESETS, ...SEED_EXAMPLES.map((entry) => entry.dashboard)]) {
			for (const layout of [dashboard.layout, dashboard.wide ?? []]) {
				for (const place of layout) {
					const kind = dashboard.tiles.find((tile) => tile.id === place.i)?.kind;

					assert.ok(kind, `${dashboard.id} ${place.i}`);
					assert.ok(place.x + place.w <= GRID_COLUMNS, `${dashboard.id} ${place.i}`);
					assert.ok(place.w >= TILE_INFO[kind].min.w, `${dashboard.id} ${place.i} width`);
					assert.ok(place.h >= TILE_INFO[kind].min.h, `${dashboard.id} ${place.i} height`);
				}

				for (const [index, place] of layout.entries()) {
					for (const other of layout.slice(index + 1)) {
						assert.equal(overlaps(place, other), false, `${dashboard.id} ${place.i} ${other.i}`);
					}
				}
			}
		}
	});

	it('fill their first screen with no holes, on every screen class', () => {
		for (const preset of PRESETS) {
			assert.ok(preset.wide, `${preset.id} has an ultrawide arrangement`);
			assert.deepEqual(parseDashboardText(JSON.stringify(preset)), preset);

			for (const layout of [preset.layout, preset.wide]) {
				for (let row = 0; row < SCREEN_ROWS; row++) {
					for (let column = 0; column < GRID_COLUMNS; column++) {
						const cell = { x: column, y: row, w: 1, h: 1 };

						assert.ok(
							layout.some((place) => overlaps(place, cell)),
							`${preset.id} hole at ${column},${row}`
						);
					}
				}
			}
		}
	});
});

/** The Live preset as it shipped before the session layouts: a fixed layout to edit. */
const live = buildDashboard('live', 'Live', [
	['session', 0, 0, 16, 3],
	['replay', 16, 0, 8, 3],
	['lap-strip', 0, 3, 24, 2],
	['timing', 0, 5, 16, 23],
	['focus', 16, 5, 8, 15],
	['race-control', 16, 20, 8, 8]
]);

describe('dashboard edits', () => {
	it('adds a tile under everything else', () => {
		const next = addTile(live, 'pit-stops', 'new');
		const place = next.layout.find((entry) => entry.i === 'new');

		assert.deepEqual(place && { x: place.x, y: place.y }, { x: 0, y: 28 });
	});

	it('stacks tiles top to bottom, then left to right', () => {
		assert.deepEqual(
			readingOrder(live).map((tile) => tile.kind),
			['session', 'replay', 'lap-strip', 'timing', 'focus', 'race-control']
		);
	});

	it('stacks the Replay tile first on a phone', () => {
		const quali = PRESETS.find((preset) => preset.id === 'quali');

		assert.ok(quali);
		assert.deepEqual(
			stackOrder(quali)
				.slice(0, 2)
				.map((tile) => tile.kind),
			['replay', 'timing']
		);
	});

	it('stacks Analysis answers before the chart on a phone, and an added Replay first', () => {
		const analysis = PRESETS.find((preset) => preset.id === 'analysis');

		assert.ok(analysis);
		assert.deepEqual(
			stackOrder(addTile(analysis, 'replay', 'new')).map((tile) => tile.kind),
			['replay', 'pace', 'fastest-laps', 'compare', 'chart', 'telemetry']
		);
	});

	it('moves a tile in the phone stack without touching the grids', () => {
		const moved = moveInStack(live, 'live-4', 'live-3');

		assert.deepEqual(
			stackOrder(moved).map((tile) => tile.kind),
			['replay', 'session', 'lap-strip', 'focus', 'timing', 'race-control']
		);
		assert.deepEqual(moved.layout, live.layout);
		assert.deepEqual(
			stackOrder(removeTile(moved, 'live-4')).map((tile) => tile.kind),
			['replay', 'session', 'lap-strip', 'timing', 'race-control']
		);
	});

	it('keeps an ultrawide edit to the ultrawide screen', () => {
		const race = PRESETS.find((preset) => preset.id === 'live');

		assert.ok(race?.wide);

		const wide = onScreen(race, 'wide').layout.map((place) =>
			place.i === 'live-0' ? { ...place, w: place.w + 1 } : place
		);

		const edited = withPlacements(race, 'wide', wide);

		assert.deepEqual(edited.layout, race.layout);
		assert.deepEqual(edited.wide, wide);
		assert.equal(withPlacements(race, 'standard', race.layout), race);
		assert.deepEqual(onScreen(live, 'wide').layout, live.layout);

		const added = addTile(edited, 'pit-stops', 'new');

		assert.equal(added.wide?.at(-1)?.i, 'new');
		assert.equal(parseDashboardText(JSON.stringify(added))?.wide?.length, added.tiles.length);
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

	it('drops the old Fit switch, and a phone order or ultrawide arrangement missing a tile', () => {
		const parsed = parseDashboardText(
			JSON.stringify({
				...live,
				fit: true,
				wide: live.layout.slice(1),
				order: ['live-0', 'live-1']
			})
		);

		assert.deepEqual(parsed, live);
	});

	it('rejects text that is not a dashboard', () => {
		assert.equal(parseDashboardText('not json'), null);
		assert.equal(parseDashboardText('{"name": 3}'), null);
		assert.deepEqual(parseDashboardListText('{"broken"'), []);
	});

	it('keeps a map tile’s settings, and counts a change to them as an edit', () => {
		const track = PRESETS.find((preset) => preset.id === 'track');

		assert.ok(track);

		const following = {
			...track,
			tiles: track.tiles.map((tile) =>
				tile.kind === 'track-map' ? { ...tile, settings: { camera: 'follow' as const } } : tile
			)
		};

		assert.deepEqual(parseDashboardText(JSON.stringify(following)), following);
		assert.equal(sameDashboard(track, following), false);
		assert.equal(sameDashboard(following, structuredClone(following)), true);
	});

	it('keeps a driver view tile bound to its driver, and drops a car number that cannot be one', () => {
		const board = drillDashboard('Norris', [
			{ section: 'stints', driver: '4' },
			{ section: 'compare', driver: '4', vs: '81' },
			{ section: 'laps' }
		]);

		assert.deepEqual(parseDashboardText(JSON.stringify(board)), board);
		assert.deepEqual(
			board.layout.map(({ x, y }) => [x, y]),
			[
				[0, 0],
				[12, 0],
				[0, 16]
			]
		);

		const broken = JSON.stringify({
			...board,
			tiles: [{ id: 'drill-0', kind: 'drill', settings: { section: 'stints', driver: '' } }]
		});

		assert.equal(parseDashboardText(broken)?.tiles.length, 0);
	});
});

describe('share links', () => {
	it('carry a dashboard whole, names with any characters included', () => {
		const named = { ...live, name: 'Vegas – Ферарі 🏁' };

		assert.deepEqual(decodeShare(encodeShare(named)), named);
	});

	it('read a broken link as nothing', () => {
		assert.equal(decodeShare('not-a-dashboard'), null);
		assert.equal(decodeShare('%%%'), null);
	});
});

describe('keyboard arranging', () => {
	it('moves a tile above the one over it', () => {
		assert.deepEqual(
			readingOrder(arrangeTile(live, 'live-5', 'ArrowUp', false)).map((tile) => tile.kind),
			['session', 'replay', 'lap-strip', 'timing', 'race-control', 'focus']
		);
	});

	it('resizes within the grid and the tile minimum', () => {
		const wider = arrangeTile(live, 'live-4', 'ArrowRight', true);
		const narrower = arrangeTile(live, 'live-4', 'ArrowLeft', true);

		assert.equal(wider.layout.find((place) => place.i === 'live-4')?.w, 8);
		assert.equal(narrower.layout.find((place) => place.i === 'live-4')?.w, 7);
	});
});
