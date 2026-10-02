import type { Driver } from '@f1-live/shared';

/**
 * Driver, team and car pictures, loaded straight from formula1.com in the viewer's browser. None
 * are stored in this repository: they belong to Formula 1 and the teams, and a paid product needs
 * a media licence before showing them. Every picture has a drawn fallback, so the app reads the
 * same when they are blocked, missing or turned off with VITE_F1_MEDIA=off.
 */
const MEDIA_HOST = 'https://media.formula1.com/image/upload';

export const MEDIA_ENABLED = import.meta.env.VITE_F1_MEDIA !== 'off';

/** The team's folder in the driver's media id, e.g. "common/f1/2025/mclaren". */
function teamFolder(driver: Driver): { path: string; year: string; team: string } | null {
	const match = /^(common\/f1\/(\d{4})\/([a-z0-9]+))\//.exec(driver.imageId ?? '');

	return match?.[1] && match[2] && match[3]
		? { path: match[1], year: match[2], team: match[3] }
		: null;
}

function transformed(publicId: string, transform: string): string {
	return `${MEDIA_HOST}/${transform}/q_auto/${publicId}.webp`;
}

/** Head and shoulders, cut out: the feed's own headshot link, else the side-on picture. */
export function driverPhotoUrl(driver: Driver, width: number): string | null {
	if (!MEDIA_ENABLED) {
		return null;
	}

	if (driver.imageId) {
		return transformed(driver.imageId, `c_lfill,w_${width}`);
	}

	return driver.headshotUrl ?? null;
}

export function teamLogoUrl(driver: Driver, tone: 'white' | 'black', width: number): string | null {
	const folder = teamFolder(driver);

	return MEDIA_ENABLED && folder
		? transformed(`${folder.path}/${folder.year}${folder.team}logo${tone}`, `c_fit,w_${width}`)
		: null;
}

export function carImageUrl(driver: Driver, width: number): string | null {
	const folder = teamFolder(driver);

	return MEDIA_ENABLED && folder
		? transformed(`${folder.path}/${folder.year}${folder.team}carright`, `c_fit,w_${width}`)
		: null;
}
