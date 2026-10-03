import { z } from 'zod';

/**
 * The dashboard document: what the browser saves, a share link carries and the account server
 * stores. Both sides read it with the same lenient rules, so a dashboard that opens here also
 * syncs, and the other way round.
 */

/** Every dashboard is laid out on this many columns, whatever the screen width. */
export const GRID_COLUMNS = 24;

export const TILE_KINDS = [
	'session',
	'replay',
	'lap-strip',
	'weather',
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
	'pit-stops',
	'driver',
	'grid'
] as const;

export type TileKind = (typeof TILE_KINDS)[number];

export const TILE_METRICS = ['lapTime', 'gap', 'position', 'battle'] as const;

export type TileSettings = { metric?: (typeof TILE_METRICS)[number] };

export type Tile = { id: string; kind: TileKind; settings?: TileSettings };

/** Where a tile sits, in grid columns and rows. `i` is the tile id. */
export type TilePlacement = { i: string; x: number; y: number; w: number; h: number };

export type Dashboard = {
	id: string;
	name: string;
	tiles: Tile[];
	layout: TilePlacement[];
	/** Stretch rows so the whole layout fills the window height: for wall screens and TVs. */
	fit?: boolean;
};

/** Ids of the ready-made dashboards. Saved under one of these, a dashboard is an edited preset. */
export const PRESET_IDS = ['live', 'analysis', 'strategy', 'battle', 'drivers', 'wall'] as const;

export function isPresetId(id: string): boolean {
	return PRESET_IDS.some((preset) => preset === id);
}

export const DASHBOARD_NAME_MAX = 40;

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
	settings: z.object({ metric: z.enum(TILE_METRICS).optional() }).optional()
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

/** Lenient on the parts: a tile or placement that does not parse is dropped, not the dashboard. */
export const dashboardSchema = z
	.object({
		id: z.string().min(1),
		name: z.string(),
		fit: z.boolean().optional(),
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
	})
	.transform((parsed): Dashboard => {
		const placed = new Set(parsed.layout.map((place) => place.i));
		const tiles = uniqueBy(parsed.tiles, (tile) => tile.id).filter((tile) => placed.has(tile.id));
		const ids = new Set(tiles.map((tile) => tile.id));

		const dashboard: Dashboard = {
			id: parsed.id,
			name: parsed.name.slice(0, DASHBOARD_NAME_MAX) || 'Untitled',
			tiles,
			layout: uniqueBy(parsed.layout, (place) => place.i).filter((place) => ids.has(place.i))
		};

		if (parsed.fit) {
			dashboard.fit = true;
		}

		return dashboard;
	});

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

	return parsed.success ? parsed.data : null;
}

/** Reads the saved list, keeping every dashboard that still parses. */
export function parseDashboardListText(text: string): Dashboard[] {
	const list = jsonText.pipe(z.array(z.json())).safeParse(text);

	const dashboards = (list.success ? list.data : []).flatMap((entry) => {
		const parsed = dashboardSchema.safeParse(entry);

		return parsed.success ? [parsed.data] : [];
	});

	return uniqueBy(dashboards, (dashboard) => dashboard.id);
}
