import type { LapIndex, LapTelemetry, TrackOutline } from '@f1-live/shared';

import {
	createCache,
	lapIndexSchema,
	lapSchema,
	outlineSchema,
	type SessionTelemetry,
	type TelemetrySource
} from '../telemetry-source.ts';

/**
 * Real telemetry of the 2025 Las Vegas race for the modelled replay of it: the e2e fixture's laps,
 * served as files by the app's own build. Only the laps in the fixture can be compared.
 */
const FILES = import.meta.glob<string>(
	[
		'../../../e2e/real/data/out/telemetry/9858/**/*.gz',
		'../../../e2e/real/data/out/telemetry/circuits/152.json'
	],
	{ query: '?url', import: 'default' }
);

const SESSION_KEY = '9858';

const FOLDER = '../../../e2e/real/data/out/telemetry/';

async function fileUrl(name: string): Promise<string> {
	const load = FILES[`${FOLDER}${name}`];

	if (!load) {
		throw new Error(`The replay has no telemetry file ${name}`);
	}

	return load();
}

/** A gzip file as served, unpacked here unless the server already said it is gzip encoded. */
async function gunzipped(url: string): Promise<Response> {
	const response = await fetch(url);

	if (!response.ok || !response.body) {
		throw new Error(`GET ${url} failed with ${response.status}`);
	}

	return response.headers.get('content-encoding')?.includes('gzip')
		? response
		: new Response(response.body.pipeThrough(new DecompressionStream('gzip')));
}

async function loadSession(): Promise<SessionTelemetry> {
	const index: unknown = await (
		await gunzipped(await fileUrl(`${SESSION_KEY}/laps.json.gz`))
	).json();

	const circuit: unknown = await (await fetch(await fileUrl('circuits/152.json'))).json();

	lapIndexSchema.parse(index);
	outlineSchema.parse(circuit);

	// SAFETY: checked above; the fixture was written by the server for the shared types.
	const full = index as LapIndex;

	return {
		// Only the laps whose files the fixture keeps.
		index: {
			...full,
			laps: full.laps.filter((entry) => `${FOLDER}${SESSION_KEY}/${entry.file}` in FILES)
		},
		// SAFETY: as above.
		circuit: circuit as TrackOutline
	};
}

export function createSampleTelemetrySource(): TelemetrySource {
	const sessions = createCache<SessionTelemetry | null>();
	const laps = createCache<LapTelemetry>();

	return {
		loadSession: (key) =>
			sessions.once(key, async () => (key === SESSION_KEY ? loadSession() : null)),
		loadLap: (key, entry) =>
			laps.once(`${key}/${entry.file}`, async () => {
				const lap: unknown = await (await gunzipped(await fileUrl(`${key}/${entry.file}`))).json();

				lapSchema.parse(lap);

				// SAFETY: checked above; the fixture was written by the server for the shared types.
				return lap as LapTelemetry;
			}),
		loadedSession: (key) => sessions.loaded(key),
		loadedLap: (key, entry) => laps.loaded(`${key}/${entry.file}`),
		// The sample telemetry never changes.
		forgetSession: () => undefined
	};
}
