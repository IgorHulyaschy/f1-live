/**
 * Picture ids on the media host, derived from what the timing feed already says about a driver:
 * the team name, the season and the driver's reference, which the headshot address carries
 * (".../drivers/L/LANNOR01_Lando_Norris/lannor01.png"). Nothing is listed by hand, so a new
 * season or team needs no change here.
 */

/**
 * The first season the media host has a side-on cut-out, a team logo and a car for. Earlier
 * seasons fall back to the feed's own headshot (2019 to 2023), then to the drawn plate.
 */
export const PICTURES_FROM_SEASON = 2024;

/** The driver's reference in the feed, lower case: "lannor01". */
export function referenceOf(headshotUrl: string | undefined): string | undefined {
	return /\/drivers\/[A-Z]\/([A-Z0-9]+)_/.exec(headshotUrl ?? '')?.[1]?.toLowerCase();
}

/** A team's name as the media host writes it in paths: "Red Bull Racing" is "redbullracing". */
export function teamSlug(team: string): string {
	return team.toLowerCase().replaceAll(/[^a-z0-9]/g, '');
}

/** The team's folder for a season, e.g. "common/f1/2025/mclaren"; null where the host has none. */
export function teamFolderOf(season: number, team: string): string | null {
	const slug = teamSlug(team);

	return season >= PICTURES_FROM_SEASON && slug !== '' ? `common/f1/${season}/${slug}` : null;
}

/**
 * The media id of the driver's side-on cut-out, e.g.
 * "common/f1/2025/mclaren/lannor01/2025mclarenlannor01right". The feed's own `publicId` wins;
 * without it the id is built from the season, team and reference.
 */
export function driverImageId({
	season,
	team,
	headshotUrl,
	publicId
}: {
	season: number;
	team: string;
	headshotUrl?: string | undefined;
	publicId?: string | undefined;
}): string | undefined {
	if (publicId) {
		return publicId;
	}

	const folder = teamFolderOf(season, team);
	const reference = referenceOf(headshotUrl);

	return folder && reference
		? `${folder}/${reference}/${season}${teamSlug(team)}${reference}right`
		: undefined;
}
