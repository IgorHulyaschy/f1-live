import { SESSION_TYPES, type RaceSnapshot } from '@f1-live/shared';
import { z } from 'zod';

import { type Catalog, catalogSchema } from './catalog.ts';
import { simulateLasVegas2025 } from './mock/simulate-race.ts';

export type RaceSourceKind = 'mock' | 'api';

/** Where sessions come from. The UI slices a loaded session per lap or per minute. */
export type RaceSource = {
	kind: RaceSourceKind;
	loadCatalog: () => Promise<Catalog>;
	/** Everything known about a saved session, by archive key. */
	loadSession: (key: string) => Promise<RaceSnapshot>;
	/** `WS /live` (docs/product/live-protocol.md), or null when the source has no live feed. */
	liveUrl: string | null;
};

/** The archive key of the 2025 Las Vegas race, which the mock replays. */
export const MOCK_SESSION_KEY = '9858';

const MOCK_CATALOG: Catalog = {
	seasons: [
		{
			year: 2025,
			meetings: [
				{
					key: 1274,
					name: 'Las Vegas Grand Prix',
					officialName: 'Las Vegas Grand Prix 2025',
					location: 'Las Vegas',
					sessions: [
						{
							key: Number(MOCK_SESSION_KEY),
							type: 'race',
							name: 'Race',
							startsAt: '2025-11-23T04:00:00.000Z',
							status: 'finished',
							circuit: 'Las Vegas',
							country: { code: 'USA', name: 'United States' },
							outputs: { raw: false, events: false, snapshot: true }
						}
					]
				}
			]
		}
	]
};

/**
 * The fields every screen reads before it looks deeper. The server writes the rest with the same
 * `applyEvent` the client runs, so a body with these is trusted to be a whole `RaceSnapshot`.
 */
const savedSnapshotSchema = z.object({
	session: z.object({ id: z.string(), type: z.enum(SESSION_TYPES), totalLaps: z.number() }),
	currentLap: z.number(),
	drivers: z.array(z.object({ number: z.string(), code: z.string() })),
	laps: z.array(z.object({ driverNumber: z.string(), lap: z.number() })),
	stints: z.array(z.unknown()),
	pitStops: z.array(z.unknown()),
	raceControl: z.array(z.unknown()),
	weather: z.array(z.unknown()),
	retirements: z.array(z.unknown())
});

async function fetchOk(url: string): Promise<Response> {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`GET ${url} failed with ${response.status}`);
	}

	return response;
}

async function fetchCatalog(apiUrl: string): Promise<Catalog> {
	const response = await fetchOk(`${apiUrl}/catalog.json`);

	return catalogSchema.parse(await response.json());
}

/** The server sends the gzip file with Content-Encoding: gzip, so fetch unpacks it. */
async function fetchSnapshot(apiUrl: string, key: string): Promise<RaceSnapshot> {
	const response = await fetchOk(`${apiUrl}/snapshots/${encodeURIComponent(key)}.json.gz`);
	const body: unknown = await response.json();

	savedSnapshotSchema.parse(body);

	// SAFETY: checked above; the rest of the body comes from the same reducer as the client's.
	return body as RaceSnapshot;
}

export function createRaceSource(
	kind: RaceSourceKind,
	urls: { apiUrl: string; liveUrl: string }
): RaceSource {
	if (kind === 'api') {
		return {
			kind,
			loadCatalog: () => fetchCatalog(urls.apiUrl),
			loadSession: (key) => fetchSnapshot(urls.apiUrl, key),
			liveUrl: urls.liveUrl
		};
	}

	return {
		kind,
		loadCatalog: () => Promise.resolve(MOCK_CATALOG),
		loadSession: (key) =>
			key === MOCK_SESSION_KEY
				? Promise.resolve(simulateLasVegas2025())
				: Promise.reject(new Error(`The offline replay has only session ${MOCK_SESSION_KEY}`)),
		liveUrl: null
	};
}

export function raceSourceKindFromEnv(value: string | undefined): RaceSourceKind {
	return value === 'api' ? 'api' : 'mock';
}
