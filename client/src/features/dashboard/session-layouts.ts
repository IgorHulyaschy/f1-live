import type { SessionType } from '@f1-live/shared';

import {
	type Dashboard,
	isPreset,
	PRESETS,
	removeTile,
	type SessionKind,
	sessionKind,
	type Tile,
	TILE_INFO,
	type TilePlacement
} from './dashboards.ts';
import { dashboardPath, SESSION_PATH } from './paths.ts';

/** The ready-made dashboard each kind of session opens on, at `/`. */
export const SESSION_LAYOUT: Record<SessionKind, string> = {
	race: 'live',
	quali: 'quali',
	practice: 'practice'
};

/** Ready-made dashboards that earn a tab beside the session's layout; the rest are under More. */
const SESSION_TABS: Record<SessionKind, readonly string[]> = {
	race: ['strategy', 'battle', 'analysis'],
	quali: ['analysis'],
	practice: ['analysis', 'strategy']
};

/** What the session's tab says, short enough for a phone. */
const TAB_LABEL: Record<SessionType, string> = {
	race: 'Race',
	sprint: 'Sprint',
	qualifying: 'Quali',
	sprint_qualifying: 'Sprint quali',
	practice: 'Practice'
};

const KIND_LABEL: Record<SessionKind, string> = {
	race: 'races',
	quali: 'qualifying',
	practice: 'practice'
};

export function sessionLayoutId(type: SessionType): string {
	return SESSION_LAYOUT[sessionKind(type)];
}

export function isSessionLayout(id: string): boolean {
	return Object.values(SESSION_LAYOUT).includes(id);
}

/** The layout's own name for its kind of session, unless the viewer renamed it. */
export function sessionLayoutName(dashboard: Dashboard, type: SessionType): string {
	const shipped = PRESETS.find((preset) => preset.id === dashboard.id)?.name;

	return dashboard.name === shipped ? TAB_LABEL[type] : dashboard.name;
}

export function tileApplies(tile: Tile, kind: SessionKind): boolean {
	return TILE_INFO[tile.kind].sessions?.includes(kind) ?? true;
}

/** "Races only", "Races and practice": what a tile that does not apply here is for. */
export function appliesTo(tile: Tile): string {
	const kinds = TILE_INFO[tile.kind].sessions ?? [];
	const named = kinds.map((kind) => KIND_LABEL[kind]);
	const text = named.length === 1 ? `${named[0]} only` : named.join(' and ');

	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Rows a tile for another kind of session keeps elsewhere: one line saying what it is for. */
export const AWAY_ROWS = 2;

const NONE_AWAY: ReadonlySet<string> = new Set();

/** Moves every tile up as far as it goes, top to bottom, closing the rows freed above it. */
function closeGaps(layout: readonly TilePlacement[]): TilePlacement[] {
	const placed: TilePlacement[] = [];

	for (const place of layout.toSorted((a, b) => a.y - b.y || a.x - b.x)) {
		const below = placed.filter(
			(other) => other.x < place.x + place.w && place.x < other.x + other.w
		);

		const y = Math.max(0, ...below.map((other) => other.y + other.h));

		placed.push({ ...place, y: Math.min(place.y, y) });
	}

	return layout.map((place) => placed.find((entry) => entry.i === place.i) ?? place);
}

/**
 * The dashboard as this session shows it, without changing what is saved: tiles for another
 * kind of session are left out of the session layouts, and shrink to one line elsewhere.
 * `away` holds the shrunk tiles.
 */
export type SessionView = { dashboard: Dashboard; away: ReadonlySet<string> };

export function forSession(dashboard: Dashboard, kind: SessionKind): SessionView {
	const away = dashboard.tiles.filter((tile) => !tileApplies(tile, kind));

	if (away.length === 0) {
		return { dashboard, away: NONE_AWAY };
	}

	if (isSessionLayout(dashboard.id)) {
		const shown = away.reduce((kept, tile) => removeTile(kept, tile.id), dashboard);

		return { dashboard: { ...shown, layout: closeGaps(shown.layout) }, away: NONE_AWAY };
	}

	const ids = new Set(away.map((tile) => tile.id));

	return {
		dashboard: {
			...dashboard,
			layout: closeGaps(
				dashboard.layout.map((place) => (ids.has(place.i) ? { ...place, h: AWAY_ROWS } : place))
			)
		},
		away: ids
	};
}

/**
 * A dashboard built for another kind of session: it holds tiles that mean nothing in this one.
 * Only the viewer's own are asked about; ready-made ones are opened on purpose.
 */
export function wantsSessionOffer(dashboard: Dashboard, kind: SessionKind): boolean {
	return (
		!isPreset(dashboard.id) &&
		dashboard.sessionOffer !== false &&
		dashboard.tiles.some((tile) => !tileApplies(tile, kind))
	);
}

export type NavEntry = { dashboard: Dashboard; path: string; label: string };

export type DashboardNav = { tabs: NavEntry[]; more: NavEntry[] };

function navEntry(dashboard: Dashboard): NavEntry {
	return { dashboard, path: dashboardPath(dashboard.id), label: dashboard.name || 'Untitled' };
}

/**
 * The top bar for a session: its own layout first, a few ready-made dashboards that suit it, the
 * viewer's own, and everything else under More.
 */
export function dashboardNav(dashboards: readonly Dashboard[], type: SessionType): DashboardNav {
	const kind = sessionKind(type);
	const byId = new Map(dashboards.map((dashboard) => [dashboard.id, dashboard]));
	const layout = byId.get(SESSION_LAYOUT[kind]);
	const shown = new Set([SESSION_LAYOUT[kind], ...SESSION_TABS[kind]]);

	const tabs = [
		...(layout
			? [{ dashboard: layout, path: SESSION_PATH, label: sessionLayoutName(layout, type) }]
			: []),
		...SESSION_TABS[kind].flatMap((id) => {
			const dashboard = byId.get(id);

			return dashboard ? [navEntry(dashboard)] : [];
		}),
		...dashboards.flatMap((dashboard) => (isPreset(dashboard.id) ? [] : [navEntry(dashboard)]))
	];

	const more = dashboards.flatMap((dashboard) =>
		isPreset(dashboard.id) && !shown.has(dashboard.id) ? [navEntry(dashboard)] : []
	);

	return { tabs, more };
}
