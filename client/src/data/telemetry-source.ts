import type {
	LapIndex,
	LapTelemetry,
	ReplayChunk,
	ReplayManifest,
	TrackOutline
} from '@f1-live/shared';
import { TELEMETRY_VERSION } from '@f1-live/shared';
import { z } from 'zod';

/**
 * A session's telemetry as the pipeline publishes it (docs/product/telemetry.md): `index.json`
 * names the circuit and where the replay and laps are.
 */
export type SessionTelemetry = {
	circuitKey: string;
	hasCarData: boolean;
	/** Paths inside the session's folder; null when the pipeline wrote none. */
	replay: string | null;
	laps: string | null;
};

/** Where circuits, replay positions and lap telemetry come from. */
export type TelemetrySource = {
	/** The session's telemetry; null when it has none (yet). */
	loadSession: (sessionKey: string) => Promise<SessionTelemetry | null>;
	/** The circuit's outline; null when no session there has been built. */
	loadOutline: (circuitKey: string) => Promise<TrackOutline | null>;
	loadReplayManifest: (sessionKey: string, path: string) => Promise<ReplayManifest>;
	loadReplayChunk: (sessionKey: string, file: string) => Promise<ReplayChunk>;
	loadLapIndex: (sessionKey: string, path: string) => Promise<LapIndex>;
	loadLap: (sessionKey: string, file: string) => Promise<LapTelemetry>;
};

const version = z.literal(TELEMETRY_VERSION);

const pointSchema = z.tuple([z.number(), z.number()]);

const sessionSchema = z.object({
	v: version,
	circuitKey: z.string(),
	hasCarData: z.boolean(),
	laps: z.string().nullable().optional(),
	replay: z.string().nullable().optional()
});

const outlineSchema = z.object({
	v: version,
	circuitKey: z.string(),
	name: z.string(),
	lengthM: z.number().positive(),
	points: z.array(pointSchema).min(8),
	rotationDeg: z.number(),
	sectorBoundariesM: z.tuple([z.number(), z.number()]),
	miniSectorsPerSector: z.tuple([z.number(), z.number(), z.number()]),
	miniSectorStartsM: z.array(z.number()).min(3),
	pitLane: z
		.object({ points: z.array(pointSchema), entryM: z.number(), exitM: z.number() })
		.nullable(),
	source: z.object({
		sessionKey: z.number(),
		driverNumber: z.string(),
		lap: z.number(),
		lapTimeMs: z.number(),
		miniSectors: z.enum(['timing', 'even'])
	})
});

const manifestSchema = z.object({
	v: version,
	originAt: z.iso.datetime(),
	stepMs: z.number().positive(),
	chunkMs: z.number().positive(),
	quantM: z.number().positive(),
	driverNumbers: z.array(z.string()),
	chunks: z.array(
		z.object({ file: z.string(), t0: z.number(), n: z.int().nonnegative(), bytes: z.number() })
	)
});

const replayCarSchema = z.object({
	x: z.array(z.number()),
	y: z.array(z.number()),
	off: z.array(z.tuple([z.int(), z.int()])).optional()
});

const chunkSchema = z.object({
	v: version,
	t0: z.number(),
	stepMs: z.number().positive(),
	n: z.int().nonnegative(),
	quantM: z.number().positive(),
	cars: z.record(z.string(), replayCarSchema)
});

const lapIndexSchema = z.object({
	v: version,
	sessionKey: z.number(),
	circuitKey: z.string(),
	stepMs: z.number(),
	hasCarData: z.boolean(),
	laps: z.array(
		z.object({
			driverNumber: z.string(),
			lap: z.int(),
			file: z.string(),
			startedAt: z.string(),
			lapTimeMs: z.number(),
			rows: z.int(),
			distanceM: z.number(),
			bytes: z.number(),
			partial: z.boolean(),
			pitIn: z.boolean(),
			pitOut: z.boolean()
		})
	)
});

const column = z.array(z.number());

const lapSchema = z.object({
	v: version,
	driverNumber: z.string(),
	lap: z.int(),
	startedAt: z.string(),
	lapTimeMs: z.number(),
	t: column,
	d: column,
	x: column,
	y: column,
	speed: column.optional(),
	throttle: column.optional(),
	brake: column.optional(),
	gear: column.optional(),
	rpm: column.optional(),
	drs: column.optional()
});

class NotFound extends Error {}

/** A path the server will serve: names of letters, digits, dots and dashes. */
function safePath(path: string): string {
	if (!path.split('/').every((part) => /^[\w.-]+$/.test(part) && !part.startsWith('.'))) {
		throw new Error(`Unexpected telemetry path ${path}`);
	}

	return path;
}

async function fetchParsed<T>(url: string, schema: z.ZodType<T>): Promise<T> {
	const response = await fetch(url);

	if (response.status === 404) {
		throw new NotFound(url);
	}

	if (!response.ok) {
		throw new Error(`GET ${url} failed with ${response.status}`);
	}

	return schema.parse(await response.json());
}

async function orNull<T>(loading: Promise<T>): Promise<T | null> {
	try {
		return await loading;
	} catch (error) {
		if (error instanceof NotFound) {
			return null;
		}

		throw error;
	}
}

function folder(sessionKey: string): string {
	return encodeURIComponent(sessionKey);
}

/**
 * Telemetry from the server (or a CDN in front of `<DATA_DIR>/out`). Files never change once
 * written, so each is fetched once per page; a failed fetch is forgotten so it can be retried.
 */
export function apiTelemetry(apiUrl: string): TelemetrySource {
	const cache = new Map<string, Promise<unknown>>();

	function load<T>(path: string, schema: z.ZodType<T>): Promise<T> {
		const url = `${apiUrl}/telemetry/${safePath(path)}`;
		const cached = cache.get(url);

		if (cached) {
			// SAFETY: every entry under this url was stored from `schema`.
			return cached as Promise<T>;
		}

		const pending = fetchParsed(url, schema);

		pending.catch(() => cache.delete(url));
		cache.set(url, pending);

		return pending;
	}

	return {
		loadSession: async (sessionKey) => {
			const index = await orNull(load(`${folder(sessionKey)}/index.json`, sessionSchema));

			return index
				? {
						circuitKey: index.circuitKey,
						hasCarData: index.hasCarData,
						replay: index.replay ?? null,
						laps: index.laps ?? null
					}
				: null;
		},
		loadOutline: (circuitKey) =>
			orNull(load(`circuits/${encodeURIComponent(circuitKey)}.json`, outlineSchema)),
		loadReplayManifest: (sessionKey, path) => load(`${folder(sessionKey)}/${path}`, manifestSchema),
		loadReplayChunk: (sessionKey, file) =>
			load(`${folder(sessionKey)}/replay/${file}`, chunkSchema),
		loadLapIndex: (sessionKey, path) => load(`${folder(sessionKey)}/${path}`, lapIndexSchema),
		loadLap: (sessionKey, file) => load(`${folder(sessionKey)}/${file}`, lapSchema)
	};
}

/** A circuit outline from the text of its JSON file, checked like one from the server. */
export function parseOutlineText(text: string): TrackOutline {
	return outlineSchema.parse(JSON.parse(text));
}

function missing(what: string): () => Promise<never> {
	return () => Promise.reject(new Error(`The offline replay has no ${what}`));
}

/** The modelled replay has the Las Vegas outline from the real pipeline and no positions. */
export function mockTelemetry(sessionKey: string): TelemetrySource {
	return {
		loadSession: (key) =>
			Promise.resolve(
				key === sessionKey
					? { circuitKey: '152', hasCarData: false, replay: null, laps: null }
					: null
			),
		loadOutline: async (circuitKey) =>
			circuitKey === '152'
				? parseOutlineText((await import('./mock/las-vegas-outline.json?raw')).default)
				: null,
		loadReplayManifest: missing('replay'),
		loadReplayChunk: missing('replay'),
		loadLapIndex: missing('lap telemetry'),
		loadLap: missing('lap telemetry')
	};
}
