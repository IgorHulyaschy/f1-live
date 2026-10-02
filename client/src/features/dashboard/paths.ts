/** Presets that kept the address they had before dashboards existed. */
const LEGACY_PATHS = new Map([
	['live', '/'],
	['analysis', '/analysis'],
	['strategy', '/strategy']
]);

export function dashboardPath(id: string): string {
	return LEGACY_PATHS.get(id) ?? `/d/${encodeURIComponent(id)}`;
}

export function tilePath(dashboardId: string, tileId: string): string {
	return `/tile/${encodeURIComponent(dashboardId)}/${encodeURIComponent(tileId)}`;
}
