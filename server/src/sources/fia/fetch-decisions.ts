import { readFile } from 'node:fs/promises';

import { z } from 'zod';
import { extractText, getDocumentProxy } from 'unpdf';

import { fetchPolitely, POLITE_PAUSE_MS, userAgent } from '../../pkg/http.js';
import { sourceCacheOf, writeAtomic } from '../../sinks/files.js';
import { type EventListing, isDecisionTitle } from './build.js';
import { type ParsedDecision, parseDecisionText } from './decision-text.js';
import {
	eventPageUrl,
	FIA_SEASON_PAGES,
	type ListedDocument,
	listedDocumentSchema,
	parseEventDocuments,
	parseEventNames,
	seasonPageUrl
} from './listing.js';

/** Bump when the reader of the text changes, so saved readings are made again. */
const READER_VERSION = 1;

const SAVE_EVERY = 25;

const listingSchema = z.array(
	z.object({ event: z.string(), documents: z.array(listedDocumentSchema) })
);

const parsedSchema = z.object({
	document: z.int().nullable(),
	car: z.string().nullable(),
	driverName: z.string().nullable(),
	team: z.string().nullable(),
	time: z.string().nullable(),
	session: z.enum(['practice', 'sprint_qualifying', 'sprint', 'qualifying', 'race']).nullable(),
	fact: z.string().nullable(),
	infringement: z.string().nullable(),
	decision: z.string().nullable(),
	outcome: z.enum(['penalty', 'no_action', 'investigation', 'unreadable']),
	penalties: z.array(
		z.object({
			kind: z.enum([
				'time',
				'grid',
				'drive_through',
				'stop_go',
				'reprimand',
				'disqualification',
				'fine',
				'penalty_points',
				'other'
			]),
			seconds: z.number().optional(),
			places: z.number().optional(),
			amount: z.number().optional()
		})
	)
});

/** What was read from each document's PDF, by address; `null` for one that could not be read. */
const documentsSchema = z.object({
	version: z.literal(READER_VERSION),
	documents: z.record(z.string(), parsedSchema.nullable())
});

const listingPathOf = (dataDir: string, season: number) =>
	sourceCacheOf(dataDir, 'fia', `listing-${season}.json`);

const documentsPathOf = (dataDir: string) => sourceCacheOf(dataDir, 'fia', 'documents.json');

/** What an earlier run saved at `file`; null when there is none. */
async function readSaved<T extends z.ZodType>(
	file: string,
	schema: T
): Promise<z.output<T> | null> {
	const text = await readFile(file, 'utf8').catch(() => null);

	return text === null ? null : schema.parse(JSON.parse(text));
}

export async function readListing(dataDir: string, season: number): Promise<EventListing[]> {
	return (await readSaved(listingPathOf(dataDir, season), listingSchema)) ?? [];
}

export async function readDocuments(dataDir: string): Promise<Map<string, ParsedDecision | null>> {
	const saved = await readSaved(documentsPathOf(dataDir), documentsSchema).catch(() => null);

	return new Map(Object.entries(saved?.documents ?? {}));
}

const pause = () => new Promise((resolve) => setTimeout(resolve, POLITE_PAUSE_MS));

/**
 * The text of a document's PDF; null when the FIA no longer serves it or it is not a PDF.
 * A busy site throws, and the document is tried again on the next run.
 */
async function fetchText(url: string): Promise<string | null> {
	const response = await fetchPolitely(url, undefined, undefined, { 'User-Agent': userAgent() });

	if (response.status === 403 || response.status === 404) {
		return null;
	}

	if (!response.ok) {
		throw new Error(`status ${response.status}`);
	}

	const bytes = new Uint8Array(await response.arrayBuffer());

	try {
		const pdf = await getDocumentProxy(bytes, { verbosity: 0 });

		return (await extractText(pdf, { mergePages: true })).text;
	} catch {
		return null;
	}
}

async function fetchHtml(url: string): Promise<string> {
	const response = await fetchPolitely(url, undefined, undefined, { 'User-Agent': userAgent() });

	if (!response.ok) {
		throw new Error(`The FIA answered ${response.status} for ${url}`);
	}

	await pause();

	return response.text();
}

/**
 * Saves the document list of each season to `<data>/fia/listing-<season>.json`. A season already
 * saved is kept, unless `refresh` is set or it is the newest, whose events still get documents.
 */
export async function fetchListings(
	dataDir: string,
	seasons: readonly number[],
	refresh: boolean
): Promise<void> {
	const newest = Math.max(...FIA_SEASON_PAGES.keys());

	for (const season of seasons) {
		// oxlint-disable-next-line no-await-in-loop -- a few requests a second at most.
		if (!refresh && season !== newest && (await readListing(dataDir, season)).length > 0) {
			continue;
		}

		const names = parseEventNames(await fetchHtml(seasonPageUrl(season))); // oxlint-disable-line no-await-in-loop
		const listing: EventListing[] = [];

		for (const event of names) {
			// oxlint-disable-next-line no-await-in-loop -- one request at a time, paused.
			const documents = parseEventDocuments(await fetchHtml(eventPageUrl(season, event)));

			listing.push({ event, documents });
		}

		// oxlint-disable-next-line no-await-in-loop -- written as each season is done.
		await writeAtomic(listingPathOf(dataDir, season), JSON.stringify(listing));
	}
}

/**
 * Reads the decision documents the saved listings name and no earlier run read, and saves what
 * they say (never the PDF) to `<data>/fia/documents.json`. Returns how many were read and how
 * many could not be fetched this time and will be tried again.
 */
export async function fetchDocuments(
	dataDir: string,
	seasons: readonly number[],
	log: (line: string) => void
): Promise<{ read: number; failed: number }> {
	const documents = await readDocuments(dataDir);
	const wanted: ListedDocument[] = [];

	for (const season of seasons) {
		// oxlint-disable-next-line no-await-in-loop -- reads small files.
		for (const { documents: listed } of await readListing(dataDir, season)) {
			wanted.push(
				...listed.filter(({ url, title }) => isDecisionTitle(title) && !documents.has(url))
			);
		}
	}

	const save = () =>
		writeAtomic(
			documentsPathOf(dataDir),
			JSON.stringify({ version: READER_VERSION, documents: Object.fromEntries(documents) })
		);

	let read = 0;
	let failed = 0;

	for (const { url, title } of wanted) {
		try {
			// oxlint-disable-next-line no-await-in-loop -- one request at a time, paused.
			const text = await fetchText(url);
			const parsed = text === null ? null : parseDecisionText(text, /summons/i.test(title));

			documents.set(url, parsed?.outcome === 'unreadable' ? null : parsed);
			read += 1;

			if (read % SAVE_EVERY === 0) {
				// oxlint-disable-next-line no-await-in-loop -- progress survives an interruption.
				await save();
				log(`${read}/${wanted.length}`);
			}
		} catch (error) {
			failed += 1;
			log(`skipped ${url}: ${error instanceof Error ? error.message : 'failed'}`);
		}

		// oxlint-disable-next-line no-await-in-loop -- the pause between requests.
		await pause();
	}

	await save();

	return { read, failed };
}
