/**
 * What the product is called and where it lives. Plan 4 leaves the name, domain, support inbox
 * and social handles to the owner, so every value marked "Owner item" is a placeholder until
 * then. The build reads this file as well: page titles, the web app manifest, robots.txt, the
 * sitemap and the share cards all follow it.
 */

export type SocialLink = { label: string; url: string };

export type Brand = {
	name: string;
	/** Under a home-screen icon, where about 12 characters fit. */
	shortName: string;
	/** Follows the name in the home page title and on the share card. */
	tagline: string;
	/** The search result and share card text when a page has none of its own. */
	description: string;
	/** Where the production site is served, without a trailing slash. */
	origin: string;
	supportEmail: string;
	social: readonly SocialLink[];
};

export const BRAND: Brand = {
	// Owner item: a working name until the trademark, domain and handle checks clear.
	name: 'Pitwall',
	shortName: 'Pitwall',
	tagline: 'live race timing and insights',
	description:
		'Live timing, gaps, tyres, pit windows and pace for every car, on dashboards you build for a phone, a laptop or a wall monitor.',
	// Owner item: the production domain. `.example` is reserved and never resolves.
	origin: 'https://pitwall.example',
	// Owner item: the support inbox.
	supportEmail: 'support@pitwall.example',
	// Owner item: handles, once registered. The footer lists whatever is here.
	social: []
};

/** The name as it appears in file names, such as exported dashboards. */
export function brandSlug(): string {
	return BRAND.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
}
