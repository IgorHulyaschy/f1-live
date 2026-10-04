import type { SessionType } from '@f1-live/shared';
import {
	type Dashboard,
	type DrillSection,
	GRID_COLUMNS,
	isPresetId,
	samePlacements,
	type Tile,
	type TileKind,
	type TilePlacement,
	type TileSettings
} from '@f1-live/shared/dashboard';

export {
	type Dashboard,
	DRILL_SECTIONS,
	type DrillSection,
	GRID_COLUMNS,
	parseDashboardListText,
	parseDashboardText,
	type Tile,
	TILE_KINDS,
	type TileKind,
	type TilePlacement,
	type TileSettings
} from '@f1-live/shared/dashboard';

import type { Metric } from '../analysis/lap-series.ts';

export const TILE_GROUPS = ['Race', 'Drivers', 'Timing', 'Track', 'Analysis', 'Strategy'] as const;

/** Sessions by what they are for: racing, a knockout for the grid, or practice. */
export type SessionKind = 'race' | 'quali' | 'practice';

export function sessionKind(type: SessionType): SessionKind {
	if (type === 'race' || type === 'sprint') {
		return 'race';
	}

	return type === 'practice' ? 'practice' : 'quali';
}

type TileInfo = {
	title: string;
	group: (typeof TILE_GROUPS)[number];
	description: string;
	size: { w: number; h: number };
	min: { w: number; h: number };
	pro?: boolean;
	/** At most one per dashboard: the masthead and the lap clock. */
	single?: boolean;
	/** The kinds of session the tile means something in; every kind when absent. */
	sessions?: readonly SessionKind[];
};

export const TILE_INFO: Record<TileKind, TileInfo> = {
	session: {
		group: 'Race',
		title: 'Session',
		description: 'The race, circuit, feed and track status: the screen’s masthead.',
		size: { w: 16, h: 3 },
		min: { w: 6, h: 3 },
		single: true
	},
	replay: {
		group: 'Race',
		title: 'Replay',
		description:
			'The timeline: play at three speeds, jump between events, scrub the laps or minutes.',
		size: { w: 24, h: 4 },
		min: { w: 4, h: 3 },
		single: true
	},
	'lap-strip': {
		group: 'Race',
		title: 'Lap strip',
		description: 'One bar per lap: flags, pit traffic and fastest laps. Click to jump.',
		size: { w: 24, h: 2 },
		min: { w: 6, h: 2 }
	},
	weather: {
		group: 'Race',
		title: 'Weather',
		description: 'Air and track temperature, humidity, wind and rain.',
		size: { w: 8, h: 5 },
		min: { w: 4, h: 4 }
	},
	timing: {
		group: 'Timing',
		title: 'Timing',
		description: 'The running order with gaps, last lap, sectors, tyres and stops.',
		size: { w: 14, h: 23 },
		min: { w: 5, h: 6 }
	},
	focus: {
		group: 'Drivers',
		title: 'Focus',
		description: 'The driver you follow: position, laps, tyres, gaps and pit prediction.',
		size: { w: 8, h: 14 },
		min: { w: 5, h: 6 }
	},
	gaps: {
		group: 'Timing',
		title: 'Gaps',
		description: 'Two cars ahead and two behind your driver, closing or opening.',
		size: { w: 7, h: 6 },
		min: { w: 4, h: 4 },
		sessions: ['race']
	},
	'box-now': {
		group: 'Strategy',
		title: 'Box now',
		description: 'Where your driver would rejoin if they pitted this lap.',
		size: { w: 7, h: 6 },
		min: { w: 4, h: 4 },
		pro: true,
		sessions: ['race']
	},
	'race-control': {
		group: 'Race',
		title: 'Race control',
		description: 'Flags, stewards and track conditions, filterable.',
		size: { w: 8, h: 10 },
		min: { w: 5, h: 4 }
	},
	chart: {
		group: 'Analysis',
		title: 'Chart',
		description: 'Lap times, gap to leader, positions or the battle with the car ahead.',
		size: { w: 12, h: 12 },
		min: { w: 6, h: 6 }
	},
	compare: {
		group: 'Analysis',
		title: 'Compare',
		description: 'Pick the drivers every chart compares.',
		size: { w: 4, h: 18 },
		min: { w: 3, h: 4 }
	},
	pace: {
		group: 'Analysis',
		title: 'True pace',
		description: 'Pace with fuel load and tyre age taken out.',
		size: { w: 12, h: 12 },
		min: { w: 6, h: 5 },
		pro: true,
		sessions: ['race', 'practice']
	},
	'fastest-laps': {
		group: 'Timing',
		title: 'Fastest laps',
		description: 'Each driver’s best lap so far.',
		size: { w: 8, h: 11 },
		min: { w: 5, h: 4 }
	},
	stints: {
		group: 'Strategy',
		title: 'Stints',
		description: 'Every car’s tyre history across the race.',
		size: { w: 24, h: 16 },
		min: { w: 6, h: 6 },
		sessions: ['race', 'practice']
	},
	degradation: {
		group: 'Strategy',
		title: 'Tyre wear',
		description: 'How fast each stint is losing time per lap.',
		size: { w: 12, h: 12 },
		min: { w: 6, h: 5 },
		pro: true,
		sessions: ['race', 'practice']
	},
	'pit-stops': {
		group: 'Strategy',
		title: 'Pit stops',
		description: 'Every stop against the typical stop time.',
		size: { w: 12, h: 12 },
		min: { w: 6, h: 5 },
		sessions: ['race']
	},
	driver: {
		group: 'Drivers',
		title: 'Driver',
		description: 'The driver you follow, large: picture, car, team, position and gap.',
		size: { w: 8, h: 14 },
		min: { w: 5, h: 8 }
	},
	grid: {
		group: 'Drivers',
		title: 'Grid',
		description: 'Every driver as a picture plate in running order. Pick one to follow.',
		size: { w: 24, h: 10 },
		min: { w: 6, h: 6 }
	},
	telemetry: {
		group: 'Analysis',
		title: 'Telemetry',
		description:
			'Speed, throttle, brake, gear and revs by distance for up to three laps, with the delta.',
		size: { w: 24, h: 34 },
		min: { w: 6, h: 18 }
	},
	story: {
		group: 'Race',
		title: 'Story',
		description:
			'The race in lanes: flags, lead, passes, stops, penalties, cars out and radio. Click to jump; short, it is a strip.',
		size: { w: 24, h: 18 },
		min: { w: 6, h: 3 }
	},
	undercut: {
		group: 'Strategy',
		title: 'Undercut ledger',
		description:
			'Each pit stop exchange: the in-lap, stop and out-laps that won or lost the place.',
		size: { w: 12, h: 24 },
		min: { w: 6, h: 8 },
		pro: true,
		sessions: ['race']
	},
	'pit-cost': {
		group: 'Strategy',
		title: 'Stop cost',
		description: 'What a pit stop costs in race time at this circuit, under green and under a VSC.',
		size: { w: 12, h: 12 },
		min: { w: 6, h: 6 },
		sessions: ['race']
	},
	'pit-crews': {
		group: 'Strategy',
		title: 'Pit crews',
		description: 'Every team’s stops at a standstill, ranked by their usual stop.',
		size: { w: 12, h: 12 },
		min: { w: 6, h: 6 },
		sessions: ['race']
	},
	championship: {
		group: 'Analysis',
		title: 'Championship',
		description:
			'The standings as the race runs, how far each contender is from the lead, and what each place is worth.',
		size: { w: 12, h: 28 },
		min: { w: 6, h: 10 },
		sessions: ['race']
	},
	'season-standings': {
		group: 'Analysis',
		title: 'Season standings',
		description:
			'The drivers’ or constructors’ championship of this session’s season after the latest round you have seen.',
		size: { w: 10, h: 18 },
		min: { w: 5, h: 10 }
	},
	conditions: {
		group: 'Analysis',
		title: 'Conditions',
		description: 'Wind along each straight, and track temperature beside the field’s pace.',
		size: { w: 12, h: 24 },
		min: { w: 6, h: 10 },
		pro: true
	},
	knockout: {
		group: 'Timing',
		title: 'Knockout',
		description:
			'Qualifying as it stands: the drop zone with each car’s gap to the cut, pole, and who just improved.',
		size: { w: 9, h: 13 },
		min: { w: 5, h: 8 },
		sessions: ['quali']
	},
	sectors: {
		group: 'Timing',
		title: 'Best sectors',
		description:
			'Who holds each fastest sector, and every driver’s ideal lap from their own best sectors.',
		size: { w: 10, h: 12 },
		min: { w: 5, h: 6 }
	},
	'long-runs': {
		group: 'Analysis',
		title: 'Long runs',
		description:
			'Practice race runs: each driver’s longest run on one set, its pace and fall-off, and laps per compound.',
		size: { w: 9, h: 14 },
		min: { w: 5, h: 6 },
		sessions: ['practice']
	},
	'track-map': {
		group: 'Track',
		title: 'Track map',
		description:
			'Every car on the circuit, live or in the replay; follow a driver or colour the sectors.',
		size: { w: 12, h: 16 },
		min: { w: 5, h: 8 }
	},
	'battle-map': {
		group: 'Track',
		title: 'Battle map',
		description:
			'Your driver and the cars either side on the circuit: road gaps, closing rate and laps until in range.',
		size: { w: 10, h: 16 },
		min: { w: 5, h: 10 }
	},
	'pit-rejoin': {
		group: 'Track',
		title: 'Pit rejoin',
		description:
			'Where your driver would come out if they boxed now, drawn among the cars, from this circuit’s pit loss.',
		size: { w: 10, h: 16 },
		min: { w: 5, h: 10 },
		pro: true,
		sessions: ['race']
	},
	dominance: {
		group: 'Track',
		title: 'Dominance',
		description:
			'The circuit painted by who is quickest in each mini sector, for two or three drivers.',
		size: { w: 10, h: 16 },
		min: { w: 5, h: 10 },
		pro: true
	},
	'flag-map': {
		group: 'Track',
		title: 'Flag map',
		description:
			'Yellow and double-yellow marshal sectors on the circuit, with the messages that raised them.',
		size: { w: 12, h: 14 },
		min: { w: 5, h: 8 }
	},
	'speed-map': {
		group: 'Track',
		title: 'Speed map',
		description:
			'One lap painted by speed, gear, throttle or braking, with top speed and the slowest corners.',
		size: { w: 10, h: 16 },
		min: { w: 5, h: 10 },
		pro: true
	},
	'gap-distance': {
		group: 'Track',
		title: 'Gap distance',
		description:
			'Every car on one straight, behind the fastest by the metres its gap is worth: by part, by sector, or the race as it runs.',
		size: { w: 24, h: 16 },
		min: { w: 6, h: 10 }
	},
	'ghost-lap': {
		group: 'Track',
		title: 'Ghost lap',
		description:
			'The best laps run together from the same line, so the gaps grow and shrink corner by corner.',
		size: { w: 12, h: 18 },
		min: { w: 6, h: 12 },
		pro: true
	},
	drill: {
		group: 'Drivers',
		title: 'Driver view',
		description:
			'One part of a driver’s session, from their view: laps, stints, sectors, telemetry or a comparison. For a set driver or the one you follow.',
		size: { w: 12, h: 16 },
		min: { w: 6, h: 8 }
	}
};

export const DRILL_SECTION_TITLE: Record<DrillSection, string> = {
	laps: 'Laps',
	runs: 'Runs',
	stints: 'Stints',
	position: 'Position',
	sectors: 'Best sectors',
	telemetry: 'Best lap telemetry',
	mentions: 'Race control and radio',
	compare: 'Compare'
};

const METRIC_TITLE: Record<Metric, string> = {
	lapTime: 'Lap times',
	gap: 'Gap',
	position: 'Positions',
	battle: 'Battle',
	versus: 'Versus'
};

export function tileTitle(tile: Tile): string {
	if (tile.kind === 'drill') {
		return DRILL_SECTION_TITLE[tile.settings?.section ?? 'laps'];
	}

	return tile.kind === 'chart' && tile.settings?.metric
		? `Chart: ${METRIC_TITLE[tile.settings.metric]}`
		: TILE_INFO[tile.kind].title;
}

export type TileSpec = [kind: TileKind, x: number, y: number, w: number, h: number, TileSettings?];

/** A tile's place on an ultrawide screen: x, y, w and h, in the same order as the tiles. */
export type WideSpec = [x: number, y: number, w: number, h: number];

/**
 * Builds a dashboard from compact tile specs: kind, x, y, w, h and optional settings, and, when
 * it has its own ultrawide arrangement, one place per tile for that.
 */
export function buildDashboard(
	id: string,
	name: string,
	tiles: readonly TileSpec[],
	wide?: readonly WideSpec[],
	order?: readonly number[]
): Dashboard {
	const dashboard: Dashboard = {
		id,
		name,
		tiles: tiles.map(([kind, , , , , settings], index) =>
			settings ? { id: `${id}-${index}`, kind, settings } : { id: `${id}-${index}`, kind }
		),
		layout: tiles.map(([, x, y, w, h], index) => ({ i: `${id}-${index}`, x, y, w, h }))
	};

	if (wide) {
		dashboard.wide = wide.map(([x, y, w, h], index) => ({ i: `${id}-${index}`, x, y, w, h }));
	}

	if (order) {
		dashboard.order = order.map((index) => `${id}-${index}`);
	}

	return dashboard;
}

/**
 * Rows one screen holds. Every ready-made dashboard fills its first screen in this many rows, on
 * a laptop and an ultrawide alike; the grid stretches them to the window. Tiles below row 21
 * are a scroll away.
 */
export const SCREEN_ROWS = 21;

/**
 * Ready-made dashboards. Each can be edited; edits are saved over it and can be reset. The first
 * three are the session layouts: `/session` opens the one for the session on screen, and only
 * they carry the Replay tile, the session's timeline; elsewhere the top bar holds the transport.
 * The second list of places is the ultrawide arrangement: four columns instead of two.
 */
export const PRESETS: readonly Dashboard[] = [
	// Race keeps the Live preset's id, so an edited Live opens as an edited Race.
	buildDashboard(
		'live',
		'Race',
		[
			['replay', 10, 17, 14, 4],
			['timing', 0, 0, 10, 21],
			['track-map', 17, 0, 7, 9],
			['stints', 17, 9, 7, 8],
			['focus', 10, 0, 7, 11],
			['race-control', 10, 11, 7, 6]
		],
		[
			[11, 16, 13, 5],
			[0, 0, 6, 21],
			[11, 0, 7, 16],
			[18, 0, 6, 16],
			[6, 0, 5, 11],
			[6, 11, 5, 10]
		]
	),
	buildDashboard(
		'quali',
		'Quali',
		[
			['replay', 10, 17, 14, 4],
			['timing', 0, 0, 10, 21],
			['knockout', 10, 0, 7, 9],
			['track-map', 10, 9, 7, 8],
			['sectors', 17, 0, 7, 9],
			['race-control', 17, 9, 7, 8],
			['gap-distance', 0, 21, 24, 12]
		],
		[
			[18, 17, 6, 4],
			[0, 0, 6, 21],
			[6, 0, 6, 11],
			[18, 0, 6, 11],
			[12, 0, 6, 11],
			[18, 11, 6, 6],
			[6, 11, 12, 10]
		]
	),
	buildDashboard(
		'practice',
		'Practice',
		[
			['replay', 10, 17, 14, 4],
			['timing', 0, 0, 10, 21],
			['long-runs', 10, 0, 7, 9],
			['track-map', 10, 9, 7, 8],
			['stints', 17, 0, 7, 9],
			['race-control', 17, 9, 7, 8]
		],
		[
			[18, 17, 6, 4],
			[0, 0, 6, 21],
			[6, 0, 12, 11],
			[18, 0, 6, 11],
			[6, 11, 12, 10],
			[18, 11, 6, 6]
		]
	),
	buildDashboard(
		'analysis',
		'Analysis',
		[
			['compare', 20, 0, 4, 21],
			['chart', 9, 0, 11, 21, { metric: 'lapTime' }],
			['pace', 0, 0, 9, 13],
			['fastest-laps', 0, 13, 9, 8],
			['telemetry', 0, 21, 24, 20]
		],
		[
			[21, 0, 3, 21],
			[6, 0, 8, 21],
			[0, 0, 6, 11],
			[0, 11, 6, 10],
			[14, 0, 7, 21]
		],
		// A phone reads the answers before the chart, which also keeps the chart library off the
		// first screen and out of the first load.
		[2, 3, 0, 1, 4]
	),
	buildDashboard(
		'strategy',
		'Strategy',
		[
			['stints', 0, 0, 14, 11],
			['degradation', 8, 11, 8, 10],
			['undercut', 14, 0, 10, 11],
			['pit-stops', 0, 11, 8, 10],
			['pit-cost', 16, 11, 8, 10],
			['pit-crews', 0, 21, 24, 12]
		],
		[
			[0, 0, 11, 11],
			[0, 11, 6, 10],
			[11, 0, 7, 11],
			[18, 0, 6, 21],
			[6, 11, 6, 10],
			[12, 11, 6, 10]
		]
	),
	buildDashboard(
		'battle',
		'Battle',
		[
			['timing', 16, 0, 8, 21],
			['chart', 0, 0, 16, 15, { metric: 'battle' }],
			['gaps', 0, 15, 8, 6],
			['box-now', 8, 15, 8, 6]
		],
		[
			[18, 0, 6, 21],
			[0, 0, 12, 21],
			[12, 0, 6, 10],
			[12, 10, 6, 11]
		]
	),
	buildDashboard(
		'track',
		'Track',
		[
			['track-map', 0, 0, 12, 11],
			['battle-map', 12, 0, 6, 11],
			['pit-rejoin', 18, 0, 6, 11],
			['dominance', 0, 11, 8, 10],
			['flag-map', 8, 11, 8, 10],
			['speed-map', 16, 11, 8, 10],
			['gap-distance', 0, 21, 12, 12],
			['ghost-lap', 12, 21, 12, 12]
		],
		[
			[0, 0, 6, 11],
			[6, 0, 6, 11],
			[12, 0, 6, 10],
			[0, 11, 6, 10],
			[18, 12, 6, 9],
			[6, 11, 6, 10],
			[12, 10, 6, 11],
			[18, 0, 6, 12]
		]
	),
	buildDashboard(
		'drivers',
		'Drivers',
		[
			['grid', 0, 0, 24, 9],
			['driver', 0, 9, 8, 12],
			['chart', 8, 9, 16, 12, { metric: 'position' }]
		],
		[
			[6, 0, 18, 9],
			[0, 0, 6, 21],
			[6, 9, 18, 12]
		]
	),
	buildDashboard(
		'wall',
		'Pit wall',
		[
			['timing', 0, 0, 8, 21],
			['track-map', 8, 0, 9, 12],
			['chart', 8, 12, 9, 9, { metric: 'gap' }],
			['focus', 17, 0, 7, 12],
			['race-control', 17, 12, 7, 9]
		],
		[
			[0, 0, 6, 21],
			[6, 0, 9, 13],
			[6, 13, 9, 8],
			[15, 0, 9, 10],
			[15, 10, 9, 11]
		]
	),
	buildDashboard(
		'story',
		'Race story',
		[
			['story', 0, 0, 24, 9],
			['chart', 0, 9, 10, 12, { metric: 'position' }],
			['championship', 10, 9, 7, 12],
			['race-control', 17, 9, 7, 12],
			['conditions', 0, 21, 24, 12]
		],
		[
			[0, 0, 17, 11],
			[0, 11, 6, 10],
			[17, 0, 7, 21],
			[6, 11, 5, 10],
			[11, 11, 6, 10]
		]
	)
];

/** Ready-made: saved under a preset id, a dashboard is an edited preset and never counts as own. */
export function isPreset(id: string): boolean {
	return isPresetId(id);
}

/** Tiles in reading order: top to bottom, then left to right. Phones stack them this way. */
export function readingOrder(dashboard: Dashboard): Tile[] {
	const places = new Map(dashboard.layout.map((place) => [place.i, place]));

	return dashboard.tiles.toSorted((a, b) => {
		const first = places.get(a.id);
		const second = places.get(b.id);

		return (first?.y ?? 0) - (second?.y ?? 0) || (first?.x ?? 0) - (second?.x ?? 0);
	});
}

/**
 * The order a phone stacks the tiles in: the order set on a phone when there is one, otherwise
 * reading order with the Replay tile first, since its clock and keys move every other tile.
 */
export function stackOrder(dashboard: Dashboard): Tile[] {
	if (dashboard.order) {
		const tiles = new Map(dashboard.tiles.map((tile) => [tile.id, tile]));

		return dashboard.order.flatMap((id) => tiles.get(id) ?? []);
	}

	const ordered = readingOrder(dashboard);

	return [
		...ordered.filter((tile) => tile.kind === 'replay'),
		...ordered.filter((tile) => tile.kind !== 'replay')
	];
}

/** Moves a tile to another's place in the phone stack. The grids on bigger screens stay as they are. */
export function moveInStack(dashboard: Dashboard, tileId: string, otherId: string): Dashboard {
	const order = stackOrder(dashboard).map((tile) => tile.id);
	const from = order.indexOf(tileId);
	const to = order.indexOf(otherId);

	if (from < 0 || to < 0) {
		return dashboard;
	}

	order.splice(to, 0, ...order.splice(from, 1));

	return { ...dashboard, order };
}

/**
 * Screens wide enough for four columns of tiles rather than two: ultrawide monitors and the like.
 * A dashboard can keep its own arrangement for them; otherwise they show the standard one.
 */
export type ScreenClass = 'standard' | 'wide';

/** The dashboard as a screen class shows it: `layout` is the arrangement on that screen. */
export function onScreen(dashboard: Dashboard, screen: ScreenClass): Dashboard {
	return screen === 'wide' && dashboard.wide ? { ...dashboard, layout: dashboard.wide } : dashboard;
}

/**
 * Saves an arrangement made on one screen class, leaving the other's as it was. The first change
 * on an ultrawide screen gives the dashboard its own ultrawide arrangement.
 */
export function withPlacements(
	dashboard: Dashboard,
	screen: ScreenClass,
	layout: readonly TilePlacement[]
): Dashboard {
	if (samePlacements(onScreen(dashboard, screen).layout, layout)) {
		return dashboard;
	}

	return screen === 'wide'
		? { ...dashboard, wide: [...layout] }
		: { ...dashboard, layout: [...layout] };
}

function placedBelow(layout: readonly TilePlacement[], id: string, kind: TileKind): TilePlacement {
	const bottom = Math.max(0, ...layout.map((place) => place.y + place.h));
	const { w, h } = TILE_INFO[kind].size;

	return { i: id, x: 0, y: bottom, w, h };
}

/** Adds a tile under everything else, at its default size, on every screen class. */
export function addTile(
	dashboard: Dashboard,
	kind: TileKind,
	id: string,
	settings?: TileSettings
): Dashboard {
	const next: Dashboard = {
		...dashboard,
		tiles: [...dashboard.tiles, settings ? { id, kind, settings } : { id, kind }],
		layout: [...dashboard.layout, placedBelow(dashboard.layout, id, kind)]
	};

	if (dashboard.wide) {
		next.wide = [...dashboard.wide, placedBelow(dashboard.wide, id, kind)];
	}

	if (dashboard.order) {
		next.order = kind === 'replay' ? [id, ...dashboard.order] : [...dashboard.order, id];
	}

	return next;
}

/**
 * A dashboard of driver view tiles, two to a row at their default size: what "Make a dashboard of
 * this view" saves.
 */
export function drillDashboard(name: string, parts: readonly TileSettings[]): Dashboard {
	const { w, h } = TILE_INFO.drill.size;
	const perRow = Math.floor(GRID_COLUMNS / w);

	return buildDashboard(
		'drill',
		name,
		parts.map((settings, index): TileSpec => [
			'drill',
			(index % perRow) * w,
			Math.floor(index / perRow) * h,
			w,
			h,
			settings
		])
	);
}

export function removeTile(dashboard: Dashboard, tileId: string): Dashboard {
	const next: Dashboard = {
		...dashboard,
		tiles: dashboard.tiles.filter((tile) => tile.id !== tileId),
		layout: dashboard.layout.filter((place) => place.i !== tileId)
	};

	if (dashboard.wide) {
		next.wide = dashboard.wide.filter((place) => place.i !== tileId);
	}

	if (dashboard.order) {
		next.order = dashboard.order.filter((id) => id !== tileId);
	}

	return next;
}
