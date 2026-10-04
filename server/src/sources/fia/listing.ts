import { z } from 'zod';

export const FIA_URL = 'https://www.fia.com';

/**
 * The seasons the FIA documents site lists. Its season pages carry an id in the path, and the
 * site has none before 2019.
 */
export const FIA_SEASON_PAGES = new Map([
	[2019, 'season-2019-971'],
	[2020, 'season-2020-1059'],
	[2021, 'season-2021-1108'],
	[2022, 'season-2022-2005'],
	[2023, 'season-2023-2042'],
	[2024, 'season-2024-2043'],
	[2025, 'season-2025-2071'],
	[2026, 'season-2026-2072']
]);

const CHAMPIONSHIP = '/documents/championships/fia-formula-one-world-championship-14';

export function seasonPageUrl(season: number): string {
	const page = FIA_SEASON_PAGES.get(season);

	if (page === undefined) {
		throw new Error(`The FIA documents site has no page for the ${season} season`);
	}

	return `${FIA_URL}${CHAMPIONSHIP}/season/${page}`;
}

export function eventPageUrl(season: number, event: string): string {
	return `${seasonPageUrl(season)}/event/${encodeURIComponent(event)}`;
}

/** One document as the event page lists it: the title is the site's, the date is CET or CEST. */
export const listedDocumentSchema = z.object({
	url: z.url(),
	title: z.string().min(1),
	/** "07.12.25 17:35" as printed, in the Paris time zone. */
	published: z.string().regex(/^\d{2}\.\d{2}\.\d{2} \d{2}:\d{2}$/)
});

export type ListedDocument = z.infer<typeof listedDocumentSchema>;

function decodeEntities(text: string): string {
	return text
		.replaceAll('&amp;', '&')
		.replaceAll('&#039;', "'")
		.replaceAll('&quot;', '"')
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

/** The events a season page offers in its filter, in the site's order, tests included. */
export function parseEventNames(html: string): string[] {
	const names = new Set<string>();

	for (const match of html.matchAll(/<option value="[^"]*\/event\/([^"/]+)"/g)) {
		names.add(decodeURIComponent(match[1] ?? ''));
	}

	return [...names];
}

const DOCUMENT_HREF = /<a href="(\/[^"]*\/decision-document\/[^"]+)"/;

const DOCUMENT_TITLE = /<div class="title">([\s\S]*?)<\/div>\s*(?:<div class="published">|<\/a>)/;

const DOCUMENT_DATE = /<span\s+class="date-display-single">([^<]+)<\/span>/;

/** The documents of one event page, newest first as the site lists them. */
export function parseEventDocuments(html: string): ListedDocument[] {
	return html
		.split('<li class="document-row ')
		.slice(1)
		.map((row) =>
			listedDocumentSchema.parse({
				url: `${FIA_URL}${encodeURI(decodeEntities(DOCUMENT_HREF.exec(row)?.[1] ?? ''))}`,
				title: decodeEntities(
					(DOCUMENT_TITLE.exec(row)?.[1] ?? '').replaceAll(/<[^>]*>|\s+/g, ' ').trim()
				),
				published: (DOCUMENT_DATE.exec(row)?.[1] ?? '').trim()
			})
		);
}
