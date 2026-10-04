import { readFile } from 'node:fs/promises';

import { type Facts, factsSchema } from '@f1-live/shared/facts';
import { z } from 'zod';

import { fetchPolitely, mapLimited, POLITE_PAUSE_MS, userAgent } from '../../pkg/http.js';
import { factsPathOf, sourceCacheOf, writeAtomic } from '../../sinks/files.js';
import {
	CIRCUIT_LINKS,
	circuitFactsOf,
	DRIVER_LINKS,
	driverFactsOf,
	type Entity,
	entitySchema,
	linkedItems
} from './entity.js';
import { CIRCUIT_ITEMS, DRIVER_ITEMS } from './ids.js';

const API_URL = 'https://www.wikidata.org/w/api.php';

/** `wbgetentities` takes at most this many ids. */
const BATCH = 50;

/** The properties the facts read; the rest of an item is left out of the cache. */
const PROPERTIES = new Set(['P569', 'P19', 'P27', 'P2043', 'P571', 'P131', 'P17', 'P625']);

const responseSchema = z.object({ entities: z.record(z.string(), z.unknown()) });

const cacheSchema = z.record(z.string(), entitySchema);

type Cache = z.infer<typeof cacheSchema>;

const cachePathOf = (dataDir: string) => sourceCacheOf(dataDir, 'wikidata', 'entities.json');

async function readCache(dataDir: string): Promise<Cache> {
	const text = await readFile(cachePathOf(dataDir), 'utf8').catch(() => null);

	return text === null ? {} : cacheSchema.parse(JSON.parse(text));
}

async function fetchEntities(ids: readonly string[], properties: boolean): Promise<Entity[]> {
	const batches = Array.from({ length: Math.ceil(ids.length / BATCH) }, (_, index) =>
		ids.slice(index * BATCH, (index + 1) * BATCH)
	);

	const found = await mapLimited(batches, 1, async (batch) => {
		const query = new URLSearchParams({
			action: 'wbgetentities',
			ids: batch.join('|'),
			props: properties ? 'labels|claims' : 'labels',
			languages: 'en',
			format: 'json'
		});

		const response = await fetchPolitely(`${API_URL}?${query}`, undefined, undefined, {
			'User-Agent': userAgent()
		});

		if (!response.ok) {
			throw new Error(`Wikidata answered ${response.status} for ${batch.join(', ')}`);
		}

		await new Promise((resolve) => setTimeout(resolve, POLITE_PAUSE_MS));

		return Object.values(responseSchema.parse(await response.json()).entities).map((raw) => {
			const entity = entitySchema.parse(raw);

			return {
				...entity,
				claims: Object.fromEntries(
					Object.entries(entity.claims).filter(([property]) => PROPERTIES.has(property))
				)
			};
		});
	});

	return found.flat();
}

function linkedItemsOf(cache: Cache, id: string, properties: readonly string[]): string[] {
	const entity = cache[id];

	return entity === undefined ? [] : linkedItems(entity, properties);
}

/**
 * Saves the items of every mapped driver and circuit, and the labels of the places they point
 * to, to `<data>/wikidata/entities.json`. Items already saved are not asked for again, unless
 * `refresh` is set. Returns how many were fetched.
 */
export async function fetchFacts(dataDir: string, refresh = false): Promise<number> {
	const cache: Cache = refresh ? {} : await readCache(dataDir);
	const wanted = [...DRIVER_ITEMS.values(), ...CIRCUIT_ITEMS.values()];
	const missing = [...new Set(wanted)].filter((id) => cache[id] === undefined);

	for (const entity of await fetchEntities(missing, true)) {
		cache[entity.id] = entity;
	}

	const linked = new Set([
		...[...DRIVER_ITEMS.values()].flatMap((id) => linkedItemsOf(cache, id, DRIVER_LINKS)),
		...[...CIRCUIT_ITEMS.values()].flatMap((id) => linkedItemsOf(cache, id, CIRCUIT_LINKS))
	]);

	const missingLabels = [...linked].filter((id) => cache[id] === undefined);

	for (const entity of await fetchEntities(missingLabels, false)) {
		cache[entity.id] = entity;
	}

	await writeAtomic(cachePathOf(dataDir), JSON.stringify(cache));

	return missing.length + missingLabels.length;
}

/** The facts of every mapped driver and circuit, from what `fetchFacts` saved. */
export async function buildFacts(dataDir: string, now: Date): Promise<Facts> {
	const cache = await readCache(dataDir);

	const labels = new Map(
		Object.values(cache).flatMap((entity) => {
			const label = entity.labels['en']?.value;

			return label === undefined ? [] : [[entity.id, label] as const];
		})
	);

	const known = (id: string): Entity => {
		const entity = cache[id];

		if (entity === undefined) {
			throw new Error(`Wikidata item ${id} is not saved; run npm run facts -w server`);
		}

		return entity;
	};

	return factsSchema.parse({
		fetchedAt: now.toISOString().slice(0, 10),
		drivers: Object.fromEntries(
			[...DRIVER_ITEMS].map(([id, item]) => [id, driverFactsOf(known(item), labels)])
		),
		circuits: Object.fromEntries(
			[...CIRCUIT_ITEMS].map(([id, item]) => [id, circuitFactsOf(known(item), labels)])
		)
	});
}

/** Writes `out/facts.json` from the saved items; false when none are saved yet. */
export async function writeFacts(dataDir: string, now: Date): Promise<boolean> {
	if ((await readFile(cachePathOf(dataDir)).catch(() => null)) === null) {
		return false;
	}

	await writeAtomic(factsPathOf(dataDir), JSON.stringify(await buildFacts(dataDir, now)));

	return true;
}
