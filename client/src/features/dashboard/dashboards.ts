import { z } from 'zod';

import type { Metric } from '../analysis/lap-series.ts';

/** Every dashboard is laid out on this many columns, whatever the screen width. */
export const GRID_COLUMNS = 24;

export const TILE_KINDS = [
	'timing',
	'focus',
	'gaps',
	'box-now',
	'race-control',
	'chart',
	'compare',
	'pace',
	'fastest-laps',
	'stints',
	'degradation',
	'pit-stops'
] as const;

export type TileKind = (typeof TILE_KINDS)[number];

export type TileSettings = { metric?: Metric };

export type Tile = { id: string; kind: TileKind; settings?: TileSettings };

/** Where a tile sits, in grid columns and rows. `i` is the tile id. */
export type TilePlacement = { i: string; x: number; y: number; w: number; h: number };

export type Dashboard = {
	id: string;
	name: string;
	tiles: Tile[];
	layout: TilePlacement[];
};

type TileInfo = {
	title: string;
	description: string;
	size: { w: number; h: number };
	min: { w: number; h: number };
	pro?: boolean;
};

export const TILE_INFO: Record<TileKind, TileInfo> = {
	timing: {
		title: 'Timing',
		description: 'The running order with gaps, last lap, sectors, tyres and stops.',
		size: { w: 14, h: 23 },
		min: { w: 5, h: 6 }
	},
	focus: {
		title: 'Focus',
		description: 'The driver you follow: position, laps, tyres, gaps and pit prediction.',
		size: { w: 8, h: 14 },
		min: { w: 5, h: 6 }
	},
	gaps: {
		title: 'Gaps',
		description: 'Two cars ahead and two behind your driver, closing or opening.',
		size: { w: 7, h: 6 },
		min: { w: 4, h: 4 }
	},
	'box-now': {
		title: 'Box now',
		description: 'Where your driver would rejoin if they pitted this lap.',
		size: { w: 7, h: 6 },
		min: { w: 4, h: 4 },
		pro: true
	},
	'race-control': {
		title: 'Race control',
		description: 'Flags, stewards and track conditions, filterable.',
		size: { w: 8, h: 10 },
		min: { w: 5, h: 4 }
	},
	chart: {
		title: 'Chart',
		description: 'Lap times, gap to leader, positions or the battle with the car ahead.',
		size: { w: 12, h: 12 },
		min: { w: 6, h: 6 }
	},
	compare: {
		title: 'Compare',
		description: 'Pick the drivers every chart compares.',
		size: { w: 4, h: 18 },
		min: { w: 3, h: 4 }
	},
	pace: {
		title: 'True pace',
		description: 'Pace with fuel load and tyre age taken out.',
		size: { w: 12, h: 12 },
		min: { w: 6, h: 5 },
		pro: true
	},
	'fastest-laps': {
		title: 'Fastest laps',
		description: 'Each driver’s best lap so far.',
		size: { w: 8, h: 11 },
		min: { w: 5, h: 4 }
	},
	stints: {
		title: 'Stints',
		description: 'Every car’s tyre history across the race.',
		size: { w: 24, h: 16 },
		min: { w: 8, h: 6 }
	},
	degradation: {
		title: 'Tyre wear',
		description: 'How fast each stint is losing time per lap.',
		size: { w: 12, h: 12 },
		min: { w: 6, h: 5 },
		pro: true
	},
	'pit-stops': {
		title: 'Pit stops',
		description: 'Every stop against the typical stop time.',
		size: { w: 12, h: 12 },
		min: { w: 6, h: 5 }
	}
};

const METRIC_TITLE: Record<Metric, string> = {
	lapTime: 'Lap times',
	gap: 'Gap',
	position: 'Positions',
	battle: 'Battle'
};

export function tileTitle(tile: Tile): string {
	return tile.kind === 'chart' && tile.settings?.metric
		? `Chart: ${METRIC_TITLE[tile.settings.metric]}`
		: TILE_INFO[tile.kind].title;
}

type PresetTile = [kind: TileKind, x: number, y: number, w: number, h: number, TileSettings?];

function preset(id: string, name: string, tiles: readonly PresetTile[]): Dashboard {
	return {
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
	preset('live', 'Live', [
		['timing', 0, 0, 16, 23],
		['focus', 16, 0, 8, 13],
		['race-control', 16, 13, 8, 10]
	]),
	preset('analysis', 'Analysis', [
		['compare', 0, 0, 4, 18],
		['chart', 4, 0, 20, 18, { metric: 'lapTime' }],
		['pace', 0, 18, 14, 12],
		['fastest-laps', 14, 18, 10, 12]
	]),
	preset('strategy', 'Strategy', [
		['stints', 0, 0, 24, 16],
		['degradation', 0, 16, 12, 12],
		['pit-stops', 12, 16, 12, 12]
	]),
	preset('battle', 'Battle', [
		['timing', 0, 0, 9, 23],
		['chart', 9, 0, 15, 13, { metric: 'battle' }],
		['gaps', 9, 13, 7, 10],
		['box-now', 16, 13, 8, 10]
	]),
	preset('wall', 'Pit wall', [
		['timing', 0, 0, 10, 23],
		['focus', 10, 0, 7, 13],
		['race-control', 10, 13, 7, 10],
		['chart', 17, 0, 7, 11, { metric: 'gap' }],
		['stints', 17, 11, 7, 12]
	])
];

export function isPreset(id: string): boolean {
	return PRESETS.some((dashboard) => dashboard.id === id);
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

const placementSchema = z.object({
	i: z.string(),
	x: z
		.int()
		.min(0)
		.max(GRID_COLUMNS - 1),
	y: z.int().min(0).max(1000),
	w: z.int().min(1).max(GRID_COLUMNS),
	h: z.int().min(1).max(1000)
});

const tileSchema = z.object({
	id: z.string(),
	kind: z.enum(TILE_KINDS),
	settings: z
		.object({ metric: z.enum(['lapTime', 'gap', 'position', 'battle']).optional() })
		.optional()
});

/** Lenient on the parts: a tile or placement that does not parse is dropped, not the dashboard. */
const dashboardSchema = z.object({
	id: z.string().min(1),
	name: z.string(),
	tiles: z.array(z.json()).transform((entries) =>
		entries.flatMap((entry) => {
			const tile = tileSchema.safeParse(entry);

			return tile.success ? [tile.data] : [];
		})
	),
	layout: z.array(z.json()).transform((entries) =>
		entries.flatMap((entry) => {
			const place = placementSchema.safeParse(entry);

			return place.success ? [place.data] : [];
		})
	)
});

/** Keeps the first entry for each key; ids must be unique for keys, routes and the grid. */
function uniqueBy<Entry>(entries: readonly Entry[], key: (entry: Entry) => string): Entry[] {
	const seen = new Set<string>();

	return entries.filter((entry) => {
		const id = key(entry);

		if (seen.has(id)) {
			return false;
		}

		seen.add(id);

		return true;
	});
}

function cleanDashboard(parsed: z.infer<typeof dashboardSchema>): Dashboard {
	const placed = new Set(parsed.layout.map((place) => place.i));
	const tiles = uniqueBy(parsed.tiles, (tile) => tile.id).filter((tile) => placed.has(tile.id));
	const ids = new Set(tiles.map((tile) => tile.id));

	return {
		id: parsed.id,
		name: parsed.name.slice(0, 40) || 'Untitled',
		tiles,
		layout: uniqueBy(parsed.layout, (place) => place.i).filter((place) => ids.has(place.i))
	};
}

/** JSON text, parsed. Text that is not JSON fails like any other schema mismatch. */
const jsonText = z.string().transform((text, context) => {
	try {
		return z.json().parse(JSON.parse(text));
	} catch {
		context.addIssue({ code: 'custom', message: 'Not JSON' });

		return z.NEVER;
	}
});

/** Reads an exported dashboard file. */
export function parseDashboardText(text: string): Dashboard | null {
	const parsed = jsonText.pipe(dashboardSchema).safeParse(text);

	return parsed.success ? cleanDashboard(parsed.data) : null;
}

/** Reads the saved list, keeping every dashboard that still parses. */
export function parseDashboardListText(text: string): Dashboard[] {
	const list = jsonText.pipe(z.array(z.json())).safeParse(text);

	const dashboards = (list.success ? list.data : []).flatMap((entry) => {
		const parsed = dashboardSchema.safeParse(entry);

		return parsed.success ? [cleanDashboard(parsed.data)] : [];
	});

	return uniqueBy(dashboards, (dashboard) => dashboard.id);
}
