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

/** The dashboard a path shows, or null for any other page. */
export function dashboardIdFromPath(pathname: string): string | null {
	for (const [id, path] of LEGACY_PATHS) {
		if (path === pathname) {
			return id;
		}
	}

	const match = /^\/d\/([^/]+)$/.exec(pathname);

	return match?.[1] ? safeDecode(match[1]) : null;
}

/** A path segment, decoded; a malformed escape reads as nothing rather than throwing. */
export function safeDecode(segment: string): string | null {
	try {
		return decodeURIComponent(segment);
	} catch {
		return null;
	}
}
