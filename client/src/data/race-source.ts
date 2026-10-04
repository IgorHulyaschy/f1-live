import {
	applyEvent,
	EMPTY_SNAPSHOT,
	type RaceEvent,
	type RaceSnapshot,
	SESSION_TYPES
} from '@f1-live/shared';
import { type SeasonResults, seasonResultsSchema } from '@f1-live/shared/results';
import { z } from 'zod';

import { isKnockout } from '../insights/qualifying.ts';
import { ArchiveFetches, apiArchiveFetch } from './archive-fetch.ts';
import { type Catalog, catalogSchema } from './catalog.ts';
import { apiMapTelemetry, type MapTelemetry, mockMapTelemetry } from './map-telemetry.ts';
import {
	createTelemetrySource,
	lazyTelemetrySource,
	type TelemetrySource
} from './telemetry-source.ts';

export type RaceSourceKind = 'mock' | 'api';

/** Where sessions come from. The UI slices a loaded session per lap or per minute. */
export type RaceSource = {
	kind: RaceSourceKind;
	loadCatalog: () => Promise<Catalog>;
	/** Everything known about a saved session, by archive key. */
	loadSession: (key: string) => Promise<RaceSnapshot>;
	/** A season's results index; null when the source has none for it. */
	loadResults: (season: number) => Promise<SeasonResults | null>;
	/** `WS /live` (docs/product/live-protocol.md), or null when the source has no live feed. */
	liveUrl: string | null;
	/** Saved sessions' telemetry, or null when the source has none. */
	telemetry: TelemetrySource | null;
	/** Circuits and replay positions for the track maps (docs/product/telemetry.md). */
	maps: MapTelemetry;
};

/** The archive key of the 2025 Las Vegas race, which the mock replays. */
const MOCK_SESSION_KEY = '9858';

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

const eventSchema = z.object({ kind: z.string(), at: z.string() });

/**
 * A session folded again from its saved events with this client's reducer. Snapshots written
 * before the reducer logged session statuses cannot tell qualifying's parts apart; the events
 * can, and folding a session takes milliseconds.
 */
async function fetchFolded(apiUrl: string, key: string): Promise<RaceSnapshot> {
	const response = await fetchOk(`${apiUrl}/events/${encodeURIComponent(key)}.jsonl.gz`);
	const lines = (await response.text()).split('\n').filter((line) => line.trim() !== '');

	return lines.reduce((snapshot, line) => {
		const body: unknown = JSON.parse(line);

		eventSchema.parse(body);

		// SAFETY: checked above; the server wrote these events for the same reducer.
		return applyEvent(snapshot, body as RaceEvent);
	}, EMPTY_SNAPSHOT);
}

async function fetchResults(apiUrl: string, season: number): Promise<SeasonResults | null> {
	const response = await fetch(`${apiUrl}/results/${season}.json.gz`);

	if (response.status === 404) {
		return null;
	}

	if (!response.ok) {
		throw new Error(`GET results for ${season} failed with ${response.status}`);
	}

	return seasonResultsSchema.parse(await response.json());
}

/** The server sends the gzip file with Content-Encoding: gzip, so fetch unpacks it. */
async function fetchSnapshot(apiUrl: string, key: string): Promise<RaceSnapshot> {
	const response = await fetchOk(`${apiUrl}/snapshots/${encodeURIComponent(key)}.json.gz`);
	const body: unknown = await response.json();

	savedSnapshotSchema.parse(body);

	// SAFETY: checked above; the rest of the body comes from the same reducer as the client's.
	const snapshot = body as RaceSnapshot;

	return isKnockout(snapshot.session.type) && !snapshot.statusLog
		? fetchFolded(apiUrl, key)
		: snapshot;
}

export function createRaceSource(
	kind: RaceSourceKind,
	urls: { apiUrl: string; liveUrl: string }
): RaceSource {
	if (kind === 'api') {
		const telemetry = createTelemetrySource(urls.apiUrl);
		const archive = new ArchiveFetches(apiArchiveFetch(urls.apiUrl));

		archive.onReady((key) => telemetry.forgetSession(key));

		return {
			kind,
			loadCatalog: () => fetchCatalog(urls.apiUrl),
			loadSession: (key) => fetchSnapshot(urls.apiUrl, key),
			loadResults: (season) => fetchResults(urls.apiUrl, season),
			liveUrl: urls.liveUrl,
			telemetry,
			maps: { ...apiMapTelemetry(urls.apiUrl), archive }
		};
	}

	return {
		kind,
		loadCatalog: () => Promise.resolve(MOCK_CATALOG),
		// The modelled race stays out of the main bundle for real data.
		loadSession: async (key) => {
			if (key !== MOCK_SESSION_KEY) {
				throw new Error(`The offline replay has only session ${MOCK_SESSION_KEY}`);
			}

			return (await import('./mock/simulate-race.ts')).simulateLasVegas2025();
		},
		loadResults: async (season) => (await import('./mock/sample-results.ts')).sampleResults(season),
		liveUrl: null,
		telemetry: lazyTelemetrySource(async () =>
			(await import('./mock/sample-telemetry.ts')).createSampleTelemetrySource()
		),
		maps: mockMapTelemetry(MOCK_SESSION_KEY)
	};
}

export function raceSourceKindFromEnv(value: string | undefined): RaceSourceKind {
	return value === 'api' ? 'api' : 'mock';
}
