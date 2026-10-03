import { BRAND } from '../brand.ts';

/** Site-wide values the running app needs too; the files the build writes are in site-files.ts. */

/** Hex twins of `--background` in index.css, for the manifest and the browser's own toolbar. */
export const THEME_COLOURS = { dark: '#0d0c0a', light: '#f8f7f3' } as const;

export const OG_IMAGE = { path: '/og-image.png', width: 1200, height: 630 } as const;

export function siteUrl(path: string): string {
	return new URL(path, BRAND.origin).href;
}

/** The home page title; every other page is "<page> | <brand>". */
export function documentTitle(title: string | null): string {
	return title ? `${title} | ${BRAND.name}` : `${BRAND.name}: ${BRAND.tagline}`;
}
