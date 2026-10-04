import type { SessionType } from '@f1-live/shared';

import type { IndexedSession } from '../catalog/season-index.js';
import { GB } from '../pkg/disk.js';
import type { CacheSettings } from './on-demand.js';
import { readLedger } from './cache.js';
import { cacheSessionTelemetry, hasTelemetry, refusal, uncache } from './on-demand.js';

type ArchivedSession = IndexedSession & { path: string };

export interface PrefetchSelection {
	year?: number;
	types?: readonly SessionType[];
	keys?: readonly number[];
}

/** The sessions a prefetch asks for, oldest first. */
export function selectSessions(
	sessions: Iterable<ArchivedSession>,
	selection: PrefetchSelection
): ArchivedSession[] {
	return [...sessions]
		.filter(
			(session) =>
				(selection.keys === undefined || selection.keys.includes(session.key)) &&
				(selection.year === undefined || session.path.startsWith(`${selection.year}/`)) &&
				(selection.types === undefined || selection.types.includes(session.type))
		)
		.toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export interface PrefetchLine {
	key: number;
	name: string;
	state: 'ready' | 'unavailable' | 'failed' | 'skipped';
	detail: string | null;
}

export interface PrefetchResult {
	lines: PrefetchLine[];
	/** Why the prefetch stopped before the last session; null when it went through them all. */
	stopped: string | null;
}

/**
 * Caches the sessions' telemetry one after another. Sessions fetched by this run are never evicted
 * for each other: the run stops when the next one would push the cache over its cap, or the disk
 * under its floor.
 */
export async function prefetch(
	sessions: readonly ArchivedSession[],
	settings: CacheSettings,
	report: (line: PrefetchLine) => void = () => undefined
): Promise<PrefetchResult> {
	const lines: PrefetchLine[] = [];
	const kept = new Set<number>();
	const cached = new Set((await readLedger(settings.dataDir)).map((session) => session.key));

	const note = (line: PrefetchLine) => {
		lines.push(line);
		report(line);
	};

	for (const session of sessions) {
		const name = `${session.path} (${session.name})`;
		const reason = await refusal(settings.dataDir, session);

		if (reason !== null) {
			note({ key: session.key, name, state: 'skipped', detail: reason });

			continue;
		}

		// Already cached by an earlier run or a viewer: kept, not built again.
		if (cached.has(session.key) && (await hasTelemetry(settings.dataDir, session.key))) {
			kept.add(session.key);
			note({ key: session.key, name, state: 'ready', detail: 'already cached' });

			continue;
		}

		const outcome = await cacheSessionTelemetry(session, settings, { keep: kept });
		const { status } = outcome;

		if (outcome.overBytes > 0) {
			await uncache(settings.dataDir, session.key);

			return {
				lines,
				stopped: `Cache cap reached at ${name}: ${(settings.capBytes / GB).toFixed(1)} GB holds the sessions fetched so far.`
			};
		}

		if (outcome.floorReached && status.state === 'failed') {
			note({ key: session.key, name, state: 'failed', detail: status.message });

			return { lines, stopped: status.message };
		}

		kept.add(session.key);
		note({
			key: session.key,
			name,
			state: status.state,
			detail:
				status.state === 'unavailable'
					? status.reason
					: status.state === 'failed'
						? status.message
						: null
		});
	}

	return { lines, stopped: null };
}
