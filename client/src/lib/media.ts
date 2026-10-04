import type { Driver } from '@f1-live/shared';
import { teamFolderOf } from '@f1-live/shared/pictures';

/**
 * Driver, team and car pictures, loaded straight from formula1.com in the viewer's browser. None
 * are stored in this repository: they belong to Formula 1 and the teams, and a paid product needs
 * a media licence before showing them. Every picture has a drawn fallback, so the app reads the
 * same when they are blocked, missing or turned off with VITE_F1_MEDIA=off.
 */
const MEDIA_HOST = 'https://media.formula1.com/image/upload';

export const MEDIA_ENABLED = import.meta.env.VITE_F1_MEDIA !== 'off';

/** A driver as a picture subject: a live `Driver`, or one read from the results index of a season. */
export type Face = Pick<
	Driver,
	'number' | 'team' | 'teamColour' | 'firstName' | 'lastName' | 'imageId' | 'headshotUrl'
> & { season?: number };

/** A team as a picture subject; a `Face` is one too. */
export type TeamSubject = Pick<Face, 'team' | 'teamColour' | 'imageId' | 'season'>;

/** One picture to try; `srcSet` adds the 2x file for dense screens. */
export interface Picture {
	src: string;
	srcSet?: string;
}

/** The team's folder in the media host, e.g. "common/f1/2025/mclaren", from the driver's id or the season. */
function teamFolder(subject: TeamSubject): { path: string; year: string; team: string } | null {
	const fromId = /^(common\/f1\/(\d{4})\/([a-z0-9]+))\//.exec(subject.imageId ?? '');

	const path =
		fromId?.[1] ??
		(subject.season === undefined ? null : teamFolderOf(subject.season, subject.team));

	const match = /^common\/f1\/(\d{4})\/([a-z0-9]+)$/.exec(path ?? '');

	return path && match?.[1] && match[2] ? { path, year: match[1], team: match[2] } : null;
}

function transformed(publicId: string, transform: string): string {
	return `${MEDIA_HOST}/${transform}/q_auto/${publicId}.webp`;
}

/** The file at the box's width and, for dense screens, at twice that. */
function scaled(publicId: string, mode: 'c_lfill' | 'c_fit', width: number): Picture {
	const at = (factor: number) => transformed(publicId, `${mode},w_${width * factor}`);

	return { src: at(1), srcSet: `${at(1)} 1x, ${at(2)} 2x` };
}

/** The driver's pictures to try in order: the side-on cut-out, then the feed's own headshot. */
export function driverPictures(face: Face, width: number): Picture[] {
	if (!MEDIA_ENABLED) {
		return [];
	}

	const pictures: Picture[] = [];

	if (face.imageId) {
		pictures.push(scaled(face.imageId, 'c_lfill', width));
	}

	if (face.headshotUrl) {
		pictures.push({ src: face.headshotUrl });
	}

	return pictures;
}

/** Whether the media host has a logo and a car for the team; false for the seasons before it does and with pictures off. */
export function hasTeamPictures(subject: TeamSubject): boolean {
	return MEDIA_ENABLED && teamFolder(subject) !== null;
}

export function teamLogoPicture(
	subject: TeamSubject,
	tone: 'white' | 'black',
	width: number
): Picture | null {
	const folder = teamFolder(subject);

	return MEDIA_ENABLED && folder
		? scaled(`${folder.path}/${folder.year}${folder.team}logo${tone}`, 'c_fit', width)
		: null;
}

export function carPicture(subject: TeamSubject, width: number): Picture | null {
	const folder = teamFolder(subject);

	return MEDIA_ENABLED && folder
		? scaled(`${folder.path}/${folder.year}${folder.team}carright`, 'c_fit', width)
		: null;
}

/**
 * Team radio audio also belongs to Formula 1. Clips are announced on the story either way; with
 * VITE_TEAM_RADIO=link a viewer can open each one from the official archive.
 */
export const TEAM_RADIO_LINKS = import.meta.env.VITE_TEAM_RADIO === 'link';

const ARCHIVE_HOST = 'https://livetiming.formula1.com/static';

/** The clip's address in the official archive, or null while linking to it is off. */
export function teamRadioUrl(path: string): string | null {
	return TEAM_RADIO_LINKS ? `${ARCHIVE_HOST}/${path}` : null;
}
