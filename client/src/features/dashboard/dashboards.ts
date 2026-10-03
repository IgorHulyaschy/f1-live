import {
	type Dashboard,
	isPresetId,
	type Tile,
	type TileKind,
	type TileSettings
} from '@f1-live/shared/dashboard';

export {
	type Dashboard,
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

export const TILE_GROUPS = ['Race', 'Drivers', 'Timing', 'Analysis', 'Strategy'] as const;

type TileInfo = {
	title: string;
	group: (typeof TILE_GROUPS)[number];
	description: string;
	size: { w: number; h: number };
	min: { w: number; h: number };
	pro?: boolean;
	/** At most one per dashboard: the masthead and the lap clock. */
	single?: boolean;
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
		description: 'Lap counter with previous, play and next.',
		size: { w: 8, h: 3 },
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
		min: { w: 4, h: 4 }
	},
	'box-now': {
		group: 'Strategy',
		title: 'Box now',
		description: 'Where your driver would rejoin if they pitted this lap.',
		size: { w: 7, h: 6 },
		min: { w: 4, h: 4 },
		pro: true
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
		pro: true
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
		min: { w: 6, h: 6 }
	},
	degradation: {
		group: 'Strategy',
		title: 'Tyre wear',
		description: 'How fast each stint is losing time per lap.',
		size: { w: 12, h: 12 },
		min: { w: 6, h: 5 },
		pro: true
	},
	'pit-stops': {
		group: 'Strategy',
		title: 'Pit stops',
		description: 'Every stop against the typical stop time.',
		size: { w: 12, h: 12 },
		min: { w: 6, h: 5 }
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
		pro: true
	},
	'pit-cost': {
		group: 'Strategy',
		title: 'Stop cost',
		description: 'What a pit stop costs in race time at this circuit, under green and under a VSC.',
		size: { w: 12, h: 12 },
		min: { w: 6, h: 6 }
	},
	'pit-crews': {
		group: 'Strategy',
		title: 'Pit crews',
		description: 'Every team’s stops at a standstill, ranked by their usual stop.',
		size: { w: 12, h: 12 },
		min: { w: 6, h: 6 }
	},
	championship: {
		group: 'Analysis',
		title: 'Championship',
		description:
			'The standings as the race runs, how far each contender is from the lead, and what each place is worth.',
		size: { w: 12, h: 28 },
		min: { w: 6, h: 10 }
	},
	conditions: {
		group: 'Analysis',
		title: 'Conditions',
		description: 'Wind along each straight, and track temperature beside the field’s pace.',
		size: { w: 12, h: 24 },
		min: { w: 6, h: 10 },
		pro: true
	}
};

const METRIC_TITLE: Record<Metric, string> = {
	lapTime: 'Lap times',
	gap: 'Gap',
	position: 'Positions',
	battle: 'Battle',
	versus: 'Versus'
};

export function tileTitle(tile: Tile): string {
	return tile.kind === 'chart' && tile.settings?.metric
		? `Chart: ${METRIC_TITLE[tile.settings.metric]}`
		: TILE_INFO[tile.kind].title;
}

export type TileSpec = [kind: TileKind, x: number, y: number, w: number, h: number, TileSettings?];

/** Builds a dashboard from compact tile specs: kind, x, y, w, h and optional settings. */
export function buildDashboard(
	id: string,
	name: string,
	tiles: readonly TileSpec[],
	options: { fit?: boolean } = {}
): Dashboard {
	return {
		...options,
		id,
		name,
		tiles: tiles.map(([kind, , , , , settings], index) =>
			settings ? { id: `${id}-${index}`, kind, settings } : { id: `${id}-${index}`, kind }
		),
		layout: tiles.map(([, x, y, w, h], index) => ({ i: `${id}-${index}`, x, y, w, h }))
	};
}

/** Ready-made dashboards. Each can be edited; edits are saved over it and can be reset. */
export const PRESETS: readonly Dashboard[] = [
	buildDashboard('live', 'Live', [
		['session', 0, 0, 16, 3],
		['replay', 16, 0, 8, 3],
		['lap-strip', 0, 3, 24, 2],
		['timing', 0, 5, 16, 23],
		['focus', 16, 5, 8, 15],
		['race-control', 16, 20, 8, 8]
	]),
	buildDashboard('analysis', 'Analysis', [
		['lap-strip', 0, 0, 18, 3],
		['replay', 18, 0, 6, 3],
		['compare', 0, 6, 4, 18],
		['chart', 4, 6, 20, 18, { metric: 'lapTime' }],
		['pace', 0, 58, 14, 12],
		['fastest-laps', 14, 58, 10, 12],
		// Added after the first six so their tile ids, and pop-out links to them, stay the same.
		['story', 0, 3, 24, 3],
		['telemetry', 0, 24, 24, 34]
	]),
	buildDashboard('strategy', 'Strategy', [
		['lap-strip', 0, 0, 18, 3],
		['replay', 18, 0, 6, 3],
		['stints', 0, 6, 24, 16],
		['degradation', 0, 22, 12, 18],
		['pit-stops', 12, 22, 12, 18],
		// As in Analysis, new tiles come after the first five.
		['story', 0, 3, 24, 3],
		['undercut', 0, 40, 12, 26],
		['pit-cost', 12, 40, 12, 13],
		['pit-crews', 12, 53, 12, 13]
	]),
	buildDashboard('battle', 'Battle', [
		['lap-strip', 0, 0, 18, 3],
		['replay', 18, 0, 6, 3],
		['timing', 0, 3, 9, 23],
		['chart', 9, 3, 15, 15, { metric: 'battle' }],
		['gaps', 9, 18, 7, 8],
		['box-now', 16, 18, 8, 8]
	]),
	buildDashboard('drivers', 'Drivers', [
		['session', 0, 0, 16, 3],
		['replay', 16, 0, 8, 3],
		['grid', 0, 3, 24, 10],
		['driver', 0, 13, 8, 16],
		['chart', 8, 13, 16, 16, { metric: 'position' }]
	]),
	buildDashboard(
		'wall',
		'Pit wall',
		[
			['timing', 0, 0, 10, 23],
			['focus', 10, 0, 7, 13],
			['race-control', 10, 13, 7, 10],
			['chart', 17, 0, 7, 11, { metric: 'gap' }],
			['stints', 17, 11, 7, 12]
		],
		{ fit: true }
	),
	buildDashboard('story', 'Race story', [
		['session', 0, 0, 16, 3],
		['replay', 16, 0, 8, 3],
		['story', 0, 3, 24, 20],
		['chart', 0, 23, 14, 18, { metric: 'position' }],
		['championship', 14, 23, 10, 36],
		['race-control', 0, 41, 14, 18],
		['conditions', 0, 59, 24, 26]
	])
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

/** Adds a tile under everything else, at its default size. */
export function addTile(dashboard: Dashboard, kind: TileKind, id: string): Dashboard {
	const bottom = Math.max(0, ...dashboard.layout.map((place) => place.y + place.h));
	const { w, h } = TILE_INFO[kind].size;

	return {
		...dashboard,
		tiles: [...dashboard.tiles, { id, kind }],
		layout: [...dashboard.layout, { i: id, x: 0, y: bottom, w, h }]
	};
}

export function removeTile(dashboard: Dashboard, tileId: string): Dashboard {
	return {
		...dashboard,
		tiles: dashboard.tiles.filter((tile) => tile.id !== tileId),
		layout: dashboard.layout.filter((place) => place.i !== tileId)
	};
}

/** Swaps two tiles' places: how phones move a tile up or down the stack. */
export function swapTiles(dashboard: Dashboard, firstId: string, secondId: string): Dashboard {
	const first = dashboard.layout.find((place) => place.i === firstId);
	const second = dashboard.layout.find((place) => place.i === secondId);

	if (!first || !second) {
		return dashboard;
	}

	return {
		...dashboard,
		layout: dashboard.layout.map((place) =>
			place.i === firstId
				? { ...second, i: firstId }
				: place.i === secondId
					? { ...first, i: secondId }
					: place
		)
	};
}
