import type { LapIndex, LapIndexEntry, LapTelemetry, TrackOutline } from '@f1-live/shared';
import { z } from 'zod';

/** A saved session's telemetry (docs/product/telemetry.md): the laps that have it, and the circuit. */
export type SessionTelemetry = { index: LapIndex; circuit: TrackOutline };

export type TelemetrySource = {
	/** Null when the session has none, as for a live one before its import. */
	loadSession: (key: string) => Promise<SessionTelemetry | null>;
	loadLap: (key: string, entry: LapIndexEntry) => Promise<LapTelemetry>;
	/** What has already loaded, so a tile drawn again shows it at once; undefined until then. */
	loadedSession: (key: string) => SessionTelemetry | null | undefined;
	loadedLap: (key: string, entry: LapIndexEntry) => LapTelemetry | undefined;
};

/**
 * The fields the charts read before they look deeper. The server writes the rest with the shared
 * types, so a body with these is trusted to be whole.
 */
const sessionIndexSchema = z.object({ circuitKey: z.string(), laps: z.string() });

export const lapIndexSchema = z.object({
	hasCarData: z.boolean(),
	laps: z.array(
		z.object({ driverNumber: z.string(), lap: z.number(), file: z.string(), distanceM: z.number() })
	)
});

export const outlineSchema = z.object({
	lengthM: z.number(),
	points: z.array(z.tuple([z.number(), z.number()])),
	miniSectorStartsM: z.array(z.number())
});

export const lapSchema = z.object({ t: z.array(z.number()), d: z.array(z.number()) });

class NotFound extends Error {}

/** The server sends gzip files with Content-Encoding: gzip, so fetch unpacks them. */
async function fetchOk(url: string): Promise<Response> {
	const response = await fetch(url);

	if (response.status === 404) {
		throw new NotFound(`GET ${url} found nothing`);
	}

	if (!response.ok) {
		throw new Error(`GET ${url} failed with ${response.status}`);
	}

	return response;
}

async function fetchLapIndex(url: string): Promise<LapIndex> {
	const body: unknown = await (await fetchOk(url)).json();

	lapIndexSchema.parse(body);

	// SAFETY: checked above; the server writes the index for the shared types.
	return body as LapIndex;
}

async function fetchOutline(url: string): Promise<TrackOutline> {
	const body: unknown = await (await fetchOk(url)).json();

	outlineSchema.parse(body);

	// SAFETY: checked above; the server writes outlines for the shared types.
	return body as TrackOutline;
}

async function fetchLap(url: string): Promise<LapTelemetry> {
	const body: unknown = await (await fetchOk(url)).json();

	lapSchema.parse(body);

	// SAFETY: checked above; the server writes laps for the shared types.
	return body as LapTelemetry;
}

/** One fetch per URL for the page's life; a failed one is forgotten so it can be tried again. */
export function createCache<T>() {
	const pending = new Map<string, Promise<T>>();
	const done = new Map<string, T>();

	return {
		once(url: string, load: () => Promise<T>): Promise<T> {
			const known = pending.get(url);

			if (known) {
				return known;
			}

			const loading = load().then(
				(value) => {
					done.set(url, value);

					return value;
				},
				(error: Error) => {
					pending.delete(url);

					throw error;
				}
			);

			pending.set(url, loading);

			return loading;
		},
		loaded(url: string): T | undefined {
			return done.get(url);
		}
	};
}

/** Telemetry files from the server: a viewer flicks between laps and sessions, and they never change. */
export function createTelemetrySource(apiUrl: string): TelemetrySource {
	const base = `${apiUrl}/telemetry`;
	const sessions = createCache<SessionTelemetry | null>();
	const circuits = createCache<TrackOutline>();
	const laps = createCache<LapTelemetry>();
	const sessionUrl = (key: string) => `${base}/${encodeURIComponent(key)}/index.json`;

	const lapUrl = (key: string, entry: LapIndexEntry) =>
		`${base}/${encodeURIComponent(key)}/${entry.file}`;

	async function loadSession(key: string): Promise<SessionTelemetry | null> {
		try {
			const body: unknown = await (await fetchOk(sessionUrl(key))).json();
			const session = sessionIndexSchema.parse(body);
			const circuitUrl = `${base}/circuits/${encodeURIComponent(session.circuitKey)}.json`;

			const [index, circuit] = await Promise.all([
				fetchLapIndex(`${base}/${encodeURIComponent(key)}/${session.laps}`),
				circuits.once(circuitUrl, () => fetchOutline(circuitUrl))
			]);

			return { index, circuit };
		} catch (error) {
			if (error instanceof NotFound) {
				return null;
			}

			throw error;
		}
	}

	return {
		loadSession: (key) => sessions.once(sessionUrl(key), () => loadSession(key)),
		loadLap: (key, entry) => laps.once(lapUrl(key, entry), () => fetchLap(lapUrl(key, entry))),
		loadedSession: (key) => sessions.loaded(sessionUrl(key)),
		loadedLap: (key, entry) => laps.loaded(lapUrl(key, entry))
	};
}

/** A source whose code loads on first use, for one that only some deployments need. */
export function lazyTelemetrySource(load: () => Promise<TelemetrySource>): TelemetrySource {
	let source: TelemetrySource | null = null;
	let loading: Promise<TelemetrySource> | null = null;

	const ready = () => {
		loading ??= load().then(
			(loaded) => {
				source = loaded;

				return loaded;
			},
			(error: Error) => {
				// Forgotten, so the next attempt loads the code again.
				loading = null;

				throw error;
			}
		);

		return loading;
	};

	return {
		loadSession: async (key) => (await ready()).loadSession(key),
		loadLap: async (key, entry) => (await ready()).loadLap(key, entry),
		loadedSession: (key) => source?.loadedSession(key),
		loadedLap: (key, entry) => source?.loadedLap(key, entry)
	};
}
