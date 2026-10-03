import * as React from 'react';
import { type UIMatch, useLocation, useMatches, useSearchParams } from 'react-router';

import { BRAND } from '@/brand';
import { useDashboards } from '@/features/dashboard/dashboard-store';

import type { PageMeta, RouteMeta } from './route-meta';
import { documentTitle, siteUrl } from './site';

/** For a page whose route has no meta of its own: the brand's own title and description. */
const SITE_META: PageMeta = { title: null, description: BRAND.description, indexed: true };

/** Set as a route's `handle`; the deepest route that has one names the page. */
export type RouteHandle = { meta: RouteMeta };

function setHeadAttribute(selector: string, attribute: string, value: string): void {
	document.head.querySelector(selector)?.setAttribute(attribute, value);
}

/**
 * The canonical link and share URL exist only once the route is known: a static one in index.html
 * would name the home page as canonical for every page until the script ran.
 */
function upsertHeadElement(
	tag: 'link' | 'meta',
	key: [string, string],
	attribute: string,
	value: string
): void {
	const [keyName, keyValue] = key;
	const existing = document.head.querySelector(`${tag}[${keyName}="${keyValue}"]`);
	const element = existing ?? document.head.appendChild(document.createElement(tag));

	element.setAttribute(keyName, keyValue);
	element.setAttribute(attribute, value);
}

/** The robots value index.html shipped with: a private preview build says noindex everywhere. */
const siteRobots =
	document.head.querySelector('meta[name="robots"]')?.getAttribute('content') ?? 'index, follow';

export function applyPageMeta(meta: PageMeta, pathname: string): void {
	const title = documentTitle(meta.title);
	const url = siteUrl(pathname);

	document.title = title;
	setHeadAttribute('meta[name="description"]', 'content', meta.description);
	setHeadAttribute('meta[name="robots"]', 'content', meta.indexed ? siteRobots : 'noindex');
	upsertHeadElement('link', ['rel', 'canonical'], 'href', url);
	setHeadAttribute('meta[property="og:title"]', 'content', title);
	setHeadAttribute('meta[property="og:description"]', 'content', meta.description);
	upsertHeadElement('meta', ['property', 'og:url'], 'content', url);
	setHeadAttribute('meta[name="twitter:title"]', 'content', title);
	setHeadAttribute('meta[name="twitter:description"]', 'content', meta.description);
}

/** Keeps the document title, description, canonical link and share card in step with the route. */
export function usePageMeta(): void {
	// SAFETY: every route in main.tsx and every lazy route module sets `handle` to a RouteHandle or
	// leaves it out.
	const matches = useMatches() as UIMatch<unknown, RouteHandle | undefined>[];
	const { pathname } = useLocation();
	const [search] = useSearchParams();
	const { dashboards } = useDashboards();
	const match = matches.findLast((entry) => entry.handle);

	const { title, description, indexed } = match?.handle
		? match.handle.meta({ params: match.params, search, dashboards })
		: SITE_META;

	React.useEffect(() => {
		applyPageMeta({ title, description, indexed }, pathname);
	}, [title, description, indexed, pathname]);
}
