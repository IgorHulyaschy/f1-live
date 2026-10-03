import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

import type { RaceSnapshot, TrackOutline } from '@f1-live/shared';

/**
 * The real-data e2e fixture for unit tests: the 2025 Las Vegas race (9858), qualifying (9854) and
 * second practice (9852), and 2026 Baku (11373) and Bahrain (11730) qualifying, derived from the
 * official timing data by e2e/real/derive-fixtures.ts.
 */
const FIXTURE = path.join(import.meta.dirname, '../../e2e/real/data/out');

export function fixtureJson<T>(file: string): T {
	const bytes = readFileSync(path.join(FIXTURE, file));
	const text = file.endsWith('.gz') ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8');

	// SAFETY: the fixture was written by the server and the reducer for the shared types.
	return JSON.parse(text) as T;
}

export function fixtureSession(key: '9852' | '9854' | '9858' | '11373' | '11730'): RaceSnapshot {
	return fixtureJson<RaceSnapshot>(`snapshots/${key}.json.gz`);
}

export function lasVegasOutline(): TrackOutline {
	return fixtureJson<TrackOutline>('telemetry/circuits/152.json');
}
