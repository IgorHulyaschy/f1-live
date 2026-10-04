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
	'grid',
	'telemetry',
	'story',
	'undercut',
	'pit-cost',
	'pit-crews',
	'championship',
	'conditions',
	'knockout',
	'sectors',
	'long-runs',
	'track-map',
	'battle-map',
	'pit-rejoin',
	'dominance',
	'flag-map',
	'speed-map',
	'gap-distance',
	'ghost-lap',
	'drill',
	'season-standings',
	'fights',
	'pace-now',
	'duel'
] as const;

export type TileKind = (typeof TILE_KINDS)[number];

export const TILE_METRICS = ['lapTime', 'gap', 'position', 'battle', 'versus'] as const;

/** What a speed map paints its lap by. */
export const MAP_CHANNELS = ['speed', 'gear', 'throttle', 'brake'] as const;

/** What a map tile keeps: its camera, how the track is painted, and how cars are labelled. */
export const trackMapSettingsSchema = z.object({
	camera: z.enum(['full', 'follow']).optional(),
	paint: z.enum(['plain', 'sectors']).optional(),
	zones: z.boolean().optional(),
	labels: z.enum(['code', 'number']).optional(),
	/** Dominance: each driver's best lap, or the best of each mini sector. */
	span: z.enum(['lap', 'best']).optional(),
	/** Speed map: what the lap is painted by. */
	channel: z.enum(MAP_CHANNELS).optional()
});

export type TrackMapSettings = z.infer<typeof trackMapSettingsSchema>;

/** What the gap distance tile keeps: the field it shows, how many cars, and by lap or sector. */
export const gapSettingsSchema = z.object({
	view: z.enum(['best', 'q1', 'q2', 'q3', 'race']).optional(),
	field: z.enum(['top10', 'all']).optional(),
	split: z.enum(['lap', 'sectors']).optional()
});

export type GapSettings = z.infer<typeof gapSettingsSchema>;

/** The parts of the driver view a tile can show on its own; `compare` is the whole compare view. */
export const DRILL_SECTIONS = [
	'laps',
	'runs',
	'stints',
	'position',
	'sectors',
	'telemetry',
	'mentions',
	'compare'
] as const;

export type DrillSection = (typeof DRILL_SECTIONS)[number];

/** What a driver view tile keeps: the part, and whose. No driver means the one followed. */
export const drillSettingsSchema = z.object({
	section: z.enum(DRILL_SECTIONS).optional(),
	driver: z.string().min(1).max(3).optional(),
	/** For compare: the other driver. */
	vs: z.string().min(1).max(3).optional()
});

export type DrillSettings = z.infer<typeof drillSettingsSchema>;

export type TileSettings = { metric?: (typeof TILE_METRICS)[number] } & TrackMapSettings &
	GapSettings &
	DrillSettings;

export type Tile = { id: string; kind: TileKind; settings?: TileSettings };

/** Where a tile sits, in grid columns and rows. `i` is the tile id. */
export type TilePlacement = { i: string; x: number; y: number; w: number; h: number };

export type Dashboard = {
	id: string;
	name: string;
	tiles: Tile[];
	/** Where the tiles sit on laptop and desktop screens, and on any screen without its own. */
	layout: TilePlacement[];
	/** Where the tiles sit on an ultrawide screen, once it has its own arrangement. */
	wide?: TilePlacement[];
	/** The order a phone stacks the tiles in, once a viewer moved one there; ids of every tile. */
	order?: string[];
	/**
	 * False once the viewer said not to offer the session's own layout over this dashboard when
	 * it holds tiles for another kind of session.
	 */
	sessionOffer?: false;
};

/** Ids of the ready-made dashboards. Saved under one of these, a dashboard is an edited preset. */
export const PRESET_IDS = [
	'live',
	'quali',
	'practice',
	'analysis',
	'strategy',
	'battle',
	'track',
	'drivers',
	'wall',
	'story'
] as const;

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
	settings: z
		.object({ metric: z.enum(TILE_METRICS).optional() })
		.extend(trackMapSettingsSchema.shape)
		.extend(gapSettingsSchema.shape)
		.extend(drillSettingsSchema.shape)
		.optional()
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

const placementsSchema = z.array(z.json()).transform((entries) =>
	entries.flatMap((entry) => {
		const place = placementSchema.safeParse(entry);

		return place.success ? [place.data] : [];
	})
);

/** Exactly one entry for each tile id, in any order. */
function coversTiles(ids: ReadonlySet<string>, keys: readonly string[]): boolean {
	return (
		keys.length === ids.size && new Set(keys).size === ids.size && keys.every((key) => ids.has(key))
	);
}

/**
 * Lenient on the parts: a tile or placement that does not parse is dropped, not the dashboard.
 * An ultrawide arrangement or phone order that no longer covers every tile is dropped, and the
 * screen falls back to the main layout. `fit`, from when rows could be stretched by hand, is
 * left out: every grid now fits its window.
 */
export const dashboardSchema = z
	.object({
		id: z.string().min(1),
		name: z.string(),
		sessionOffer: z.boolean().optional(),
		tiles: z.array(z.json()).transform((entries) =>
			entries.flatMap((entry) => {
				const tile = tileSchema.safeParse(entry);

				return tile.success ? [tile.data] : [];
			})
		),
		layout: placementsSchema,
		wide: placementsSchema.optional(),
		order: z.array(z.string()).optional()
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

		const wide = parsed.wide?.filter((place) => ids.has(place.i));
		const wideIds = wide?.map((place) => place.i) ?? [];

		if (wide && coversTiles(ids, wideIds)) {
			dashboard.wide = wide;
		}

		if (parsed.order && coversTiles(ids, parsed.order)) {
			dashboard.order = parsed.order;
		}

		if (parsed.sessionOffer === false) {
			dashboard.sessionOffer = false;
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

const SETTING_KEYS = [
	'metric',
	...trackMapSettingsSchema.keyof().options,
	...gapSettingsSchema.keyof().options,
	...drillSettingsSchema.keyof().options
] as const satisfies readonly (keyof TileSettings)[];

function sameSettings(a: TileSettings | undefined, b: TileSettings | undefined): boolean {
	return SETTING_KEYS.every((key) => a?.[key] === b?.[key]);
}

/** Same content, field by field: stored JSON can come back with its keys in another order. */
export function sameDashboard(a: Dashboard, b: Dashboard): boolean {
	return (
		a.id === b.id &&
		a.name === b.name &&
		a.sessionOffer === b.sessionOffer &&
		a.tiles.length === b.tiles.length &&
		a.tiles.every((tile, index) => {
			const other = b.tiles[index];

			return (
				other !== undefined &&
				tile.id === other.id &&
				tile.kind === other.kind &&
				sameSettings(tile.settings, other.settings)
			);
		}) &&
		samePlacements(a.layout, b.layout) &&
		(a.wide === b.wide ||
			(a.wide !== undefined && b.wide !== undefined && samePlacements(a.wide, b.wide))) &&
		a.order?.length === b.order?.length &&
		(a.order ?? []).every((id, index) => id === b.order?.[index])
	);
}

/** The same tiles at the same places, in the same order. */
export function samePlacements(a: readonly TilePlacement[], b: readonly TilePlacement[]): boolean {
	return (
		a.length === b.length &&
		a.every((place, index) => {
			const other = b[index];

			return (
				other !== undefined &&
				place.i === other.i &&
				place.x === other.x &&
				place.y === other.y &&
				place.w === other.w &&
				place.h === other.h
			);
		})
	);
}
