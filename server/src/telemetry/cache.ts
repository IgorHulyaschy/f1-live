import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { writeAtomic } from '../sinks/files.js';
import { sessionTelemetryDir } from './files.js';

/**
 * A session whose positions and car data were fetched on demand: their raw streams sit in the
 * cache and its telemetry in `out/telemetry/<key>`, both counted in `bytes`.
 */
export interface CachedSession {
	key: number;
	/** The session's archive path, e.g. `2019/2019-06-30_Austrian_Grand_Prix/2019-06-30_Race`. */
	path: string;
	bytes: number;
	/** When a viewer last opened its telemetry, ISO 8601 UTC. */
	openedAt: string;
}

export interface EvictionPlan {
	/** Least recently opened first. */
	evict: CachedSession[];
	/** What the cache still holds over its cap after the evictions, because the rest is kept. */
	overBytes: number;
}

const ledgerSchema = z.object({
	sessions: z.array(
		z.object({
			key: z.number().int(),
			path: z.string(),
			bytes: z.number().nonnegative(),
			openedAt: z.iso.datetime()
		})
	)
});

/** The archive cache: `<DATA_DIR>/cache`. */
export function cacheDirOf(dataDir: string): string {
	return path.join(dataDir, 'cache');
}

/** Where a session's fetched streams go, in the archive's own layout and format. */
export function cachedStreamsDir(dataDir: string, archivePath: string): string {
	return path.join(cacheDirOf(dataDir), 'raw', archivePath);
}

function ledgerFile(dataDir: string): string {
	return path.join(cacheDirOf(dataDir), 'sessions.json');
}

/**
 * The sessions to drop so the cache fits its cap, least recently opened first; a kept session is
 * never dropped, even when the cache stays over the cap.
 */
export function planEviction(
	sessions: readonly CachedSession[],
	capBytes: number,
	keep: ReadonlySet<number> = new Set()
): EvictionPlan {
	let total = sessions.reduce((sum, session) => sum + session.bytes, 0);
	const evict: CachedSession[] = [];

	const oldestFirst = sessions.toSorted(
		(a, b) => a.openedAt.localeCompare(b.openedAt) || a.key - b.key
	);

	for (const session of oldestFirst) {
		if (total <= capBytes) {
			break;
		}

		if (!keep.has(session.key)) {
			evict.push(session);
			total -= session.bytes;
		}
	}

	return { evict, overBytes: Math.max(0, total - capBytes) };
}

/** The cached sessions; none when the cache is new. */
export async function readLedger(dataDir: string): Promise<CachedSession[]> {
	const text = await readFile(ledgerFile(dataDir), 'utf8').catch(() => null);

	return text === null ? [] : ledgerSchema.parse(JSON.parse(text)).sessions;
}

export async function writeLedger(dataDir: string, sessions: readonly CachedSession[]) {
	const sorted = sessions.toSorted((a, b) => a.key - b.key);

	await writeAtomic(ledgerFile(dataDir), `${JSON.stringify({ sessions: sorted }, null, '\t')}\n`);
}

/** Removes a cached session's streams and telemetry; the circuit outline it drew stays. */
export async function removeCached(dataDir: string, session: CachedSession) {
	await rm(cachedStreamsDir(dataDir, session.path), { recursive: true, force: true });
	await rm(sessionTelemetryDir(dataDir, session.key), { recursive: true, force: true });
}
