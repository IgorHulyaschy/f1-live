import { access, rm } from 'node:fs/promises';
import path from 'node:path';

import type { TelemetryFetchStatus } from '@f1-live/shared';

import type { IndexedSession } from '../catalog/season-index.js';
import { ArchiveMissing, TELEMETRY_STREAMS } from '../import/fetch.js';
import { readSeasonIndexes } from '../import/local.js';
import { describeShortfall, freeBytes, hasRoom, sizeOnDisk } from '../pkg/disk.js';
import { rawDirOf } from '../sinks/files.js';
import type { EventLog } from '../sources/f1/live.js';
import type { BuildOptions, TelemetryReport } from './build.js';
import { cachedStreamsDir, planEviction, readLedger, removeCached, writeLedger } from './cache.js';
import type { CachedSession } from './cache.js';
import { sessionTelemetryDir } from './files.js';
import { fetchTelemetryStreams } from './fetch-streams.js';

/**
 * From this season on an import keeps every stream, so nothing is fetched on demand, unless the
 * session was recorded live and finished without its position streams (the archive had them later).
 */
export const FIRST_STORED_SEASON = 2025;

/** A session's telemetry takes about this share of its raw streams again; the floor counts both. */
const OUTPUT_SHARE = 0.6;

/** Without a length from the archive, a race's two streams are about this big. */
const UNKNOWN_STREAMS_BYTES = 40e6;

/** A session the archive had no positions for is asked again after this long: it may publish them later. */
const RETRY_UNAVAILABLE_MS = 30 * 60_000;

const NO_POSITIONS = 'The archive holds no car positions for this session.';

/** A session opened this recently may still be replaying, so no other session's fetch evicts it. */
const IN_USE_MS = 3 * 60 * 60 * 1000;

export interface CacheSettings {
	dataDir: string;
	archiveUrl: string;
	capBytes: number;
	/** Free space on the data volume never drops below this. */
	floorBytes: number;
	/** Tests replace the disk and the build. */
	freeBytes?: (directory: string) => Promise<number>;
	build: (options: Omit<BuildOptions, 'log' | 'rebuildOutline'>) => Promise<TelemetryReport>;
	now?: () => Date;
}

/** A download that would leave the data volume under its floor. */
export class DiskFloorReached extends Error {}

export interface CacheOutcome {
	status: Extract<TelemetryFetchStatus, { state: 'ready' | 'unavailable' | 'failed' }>;
	/** Sessions dropped to fit the cap. */
	evicted: CachedSession[];
	/** What the cache holds over its cap because every other session is kept. */
	overBytes: number;
	/** The download stopped at the disk floor. */
	floorReached: boolean;
}

async function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false
	);
}

export async function hasTelemetry(dataDir: string, key: number): Promise<boolean> {
	return exists(path.join(sessionTelemetryDir(dataDir, key), 'index.json'));
}

/** Serializes changes to the cache's ledger, which a build and a viewer may touch at once. */
let ledgerQueue: Promise<unknown> = Promise.resolve();

function changeLedger<T>(
	dataDir: string,
	change: (sessions: CachedSession[]) => Promise<{ sessions: CachedSession[]; result: T }>
): Promise<T> {
	const next = ledgerQueue.then(async () => {
		const { sessions, result } = await change(await readLedger(dataDir));

		await writeLedger(dataDir, sessions);

		return result;
	});

	ledgerQueue = next.catch(() => undefined);

	return next;
}

/** Marks a cached session as just opened, so it is evicted last; a stored session is not cached. */
export async function markOpened(dataDir: string, key: number, now: Date): Promise<void> {
	const cached = await readLedger(dataDir);

	if (!cached.some((session) => session.key === key)) {
		return;
	}

	await changeLedger(dataDir, async (sessions) => ({
		sessions: sessions.map((session) =>
			session.key === key ? { ...session, openedAt: now.toISOString() } : session
		),
		result: undefined
	}));
}

/**
 * Fetches a session's positions and car data into the cache, builds its telemetry and evicts the
 * least recently opened sessions until the cache fits its cap; `keep` and this session stay.
 * Streams already in the raw folder are used as they are.
 */
export async function cacheSessionTelemetry(
	session: IndexedSession & { path: string },
	settings: CacheSettings,
	hooks: { onStatus?: (status: TelemetryFetchStatus) => void; keep?: ReadonlySet<number> } = {}
): Promise<CacheOutcome> {
	const { dataDir, floorBytes } = settings;
	const now = settings.now ?? (() => new Date());
	const free = settings.freeBytes ?? freeBytes;
	const rawDir = path.join(rawDirOf(dataDir), session.path);
	const streamsDir = cachedStreamsDir(dataDir, session.path);
	const stored = await exists(path.join(rawDir, TELEMETRY_STREAMS[0]));
	const nothing = { evicted: [], overBytes: 0, floorReached: false };

	try {
		if (!stored) {
			hooks.onStatus?.({ state: 'fetching', receivedBytes: 0, totalBytes: null });

			await fetchTelemetryStreams({
				baseUrl: settings.archiveUrl,
				archivePath: session.path,
				directory: streamsDir,
				beforeWrite: async (totalBytes) => {
					const need = (totalBytes ?? UNKNOWN_STREAMS_BYTES) * (1 + OUTPUT_SHARE);
					const disk = { freeBytes: await free(dataDir), floorBytes };

					if (!hasRoom(disk, need)) {
						throw new DiskFloorReached(`Not fetched: ${describeShortfall(disk, need)}.`);
					}
				},
				onProgress: (progress) => hooks.onStatus?.({ state: 'fetching', ...progress })
			});
		}

		hooks.onStatus?.({ state: 'building' });

		const report = await settings.build({
			rawDir,
			streamsDir: stored ? undefined : streamsDir,
			key: session.key,
			dataDir
		});

		if (report.status === 'skipped') {
			await rm(streamsDir, { recursive: true, force: true });

			return { status: { state: 'unavailable', reason: report.reason }, ...nothing };
		}
	} catch (error) {
		if (error instanceof ArchiveMissing) {
			await rm(streamsDir, { recursive: true, force: true });

			return { status: { state: 'unavailable', reason: NO_POSITIONS }, ...nothing };
		}

		// Streams that arrived are kept for the next try, and counted so eviction can reclaim them.
		if (!stored) {
			await keepPartial(dataDir, session, streamsDir, now()).catch(() => undefined);
		}

		const message = error instanceof Error ? error.message : String(error);

		return {
			status: { state: 'failed', message },
			...nothing,
			floorReached: error instanceof DiskFloorReached
		};
	}

	const bytes =
		(await sizeOnDisk(streamsDir)) + (await sizeOnDisk(sessionTelemetryDir(dataDir, session.key)));

	const entry: CachedSession = {
		key: session.key,
		path: session.path,
		bytes,
		openedAt: now().toISOString()
	};

	return changeLedger(dataDir, async (sessions) => {
		const all = [...sessions.filter((cached) => cached.key !== session.key), entry];

		const plan = planEviction(
			all,
			settings.capBytes,
			new Set([...(hooks.keep ?? []), session.key])
		);

		for (const evicted of plan.evict) {
			await removeCached(dataDir, evicted);
		}

		const dropped = new Set(plan.evict.map((evicted) => evicted.key));

		return {
			sessions: all.filter((cached) => !dropped.has(cached.key)),
			result: {
				status: { state: 'ready' },
				evicted: plan.evict,
				overBytes: plan.overBytes,
				floorReached: false
			}
		};
	});
}

async function keepPartial(
	dataDir: string,
	session: IndexedSession & { path: string },
	streamsDir: string,
	now: Date
): Promise<void> {
	const bytes = await sizeOnDisk(streamsDir);

	if (bytes === 0) {
		return;
	}

	await changeLedger(dataDir, async (sessions) => ({
		sessions: [
			...sessions.filter((cached) => cached.key !== session.key),
			{ key: session.key, path: session.path, bytes, openedAt: now.toISOString() }
		],
		result: undefined
	}));
}

/** Removes one session from the cache, files and ledger entry; the prefetch backs out with it. */
export async function uncache(dataDir: string, key: number): Promise<void> {
	await changeLedger(dataDir, async (sessions) => {
		for (const session of sessions.filter((cached) => cached.key === key)) {
			await removeCached(dataDir, session);
		}

		return { sessions: sessions.filter((cached) => cached.key !== key), result: undefined };
	});
}

/** The sessions of the saved season indexes that have an archive path, by key; paths lose their trailing slash. */
export async function indexedSessions(
	dataDir: string
): Promise<Map<number, IndexedSession & { path: string }>> {
	const seasons = await readSeasonIndexes(rawDirOf(dataDir));

	return new Map(
		seasons.flatMap((season) =>
			season.meetings.flatMap((meeting) =>
				meeting.sessions.flatMap((session) =>
					session.path === null
						? []
						: [[session.key, { ...session, path: session.path.replace(/\/$/, '') }] as const]
				)
			)
		)
	);
}

/** Why a session cannot be fetched on demand; null when it can. */
export async function refusal(
	dataDir: string,
	session: (IndexedSession & { path: string }) | undefined
): Promise<string | null> {
	if (session === undefined) {
		return 'No imported session has this key.';
	}

	const folder = path.join(rawDirOf(dataDir), session.path);

	if (!(await exists(path.join(folder, 'SessionInfo.jsonStream')))) {
		return 'This session is not imported yet.';
	}

	if (
		Number(session.path.slice(0, 4)) >= FIRST_STORED_SEASON &&
		(await exists(path.join(folder, TELEMETRY_STREAMS[0])))
	) {
		return 'This session was stored without car positions.';
	}

	return null;
}

/**
 * Fetches older sessions' telemetry when viewers ask for it, one session at a time in the order
 * asked, and answers where each one is.
 */
export class TelemetryOnDemand {
	private readonly settings: CacheSettings;
	private readonly log: EventLog;
	private readonly states = new Map<number, TelemetryFetchStatus>();
	private readonly unavailableSince = new Map<number, number>();
	private readonly queue: number[] = [];
	private readonly requests = new Map<number, Promise<TelemetryFetchStatus>>();
	private readonly lastOpened = new Map<number, number>();
	private running: Promise<void> = Promise.resolve();
	private sessions: Map<number, IndexedSession & { path: string }> | null = null;

	constructor(settings: CacheSettings, log: EventLog) {
		this.settings = settings;
		this.log = log;
	}

	async status(key: number): Promise<TelemetryFetchStatus> {
		const state = this.states.get(key);
		const since = this.unavailableSince.get(key);

		if (
			state?.state === 'unavailable' &&
			since !== undefined &&
			this.now().getTime() - since >= RETRY_UNAVAILABLE_MS
		) {
			this.states.delete(key);
			this.unavailableSince.delete(key);

			return this.status(key);
		}

		if (state?.state === 'queued') {
			return { state: 'queued', ahead: this.queue.indexOf(key) };
		}

		if (state !== undefined && state.state !== 'ready') {
			return state;
		}

		return (await hasTelemetry(this.settings.dataDir, key))
			? { state: 'ready' }
			: { state: 'idle' };
	}

	/** Starts fetching the session unless it is ready, under way or cannot be; a failure is tried again. */
	request(key: number): Promise<TelemetryFetchStatus> {
		// Two viewers asking at once share one answer, so the session is queued once.
		let asked = this.requests.get(key);

		if (asked === undefined) {
			asked = this.enqueue(key).finally(() => this.requests.delete(key));
			this.requests.set(key, asked);
		}

		return asked;
	}

	private async enqueue(key: number): Promise<TelemetryFetchStatus> {
		const current = await this.status(key);

		if (current.state !== 'idle' && current.state !== 'failed') {
			return current;
		}

		const session = await this.find(key);
		const reason = await refusal(this.settings.dataDir, session);

		// Not remembered: a session imported later can be fetched then.
		if (reason !== null || session === undefined) {
			return { state: 'unavailable', reason: reason ?? '' };
		}

		this.states.set(key, { state: 'queued', ahead: this.queue.length });
		this.queue.push(key);
		this.running = this.running.then(() => this.run(session));

		return this.status(key);
	}

	/** A viewer opened the session's telemetry. */
	async opened(key: number): Promise<void> {
		const now = this.now();

		this.lastOpened.set(key, now.getTime());
		await markOpened(this.settings.dataDir, key, now);
	}

	/** Resolves once every queued session is done; for tests and shutdown. */
	async idle(): Promise<void> {
		await this.running;
	}

	private now(): Date {
		return (this.settings.now ?? (() => new Date()))();
	}

	private inUse(): Set<number> {
		const since = this.now().getTime() - IN_USE_MS;

		return new Set(
			[...this.lastOpened].flatMap(([key, openedAt]) => (openedAt >= since ? [key] : []))
		);
	}

	private async find(key: number) {
		if (this.sessions === null || !this.sessions.has(key)) {
			this.sessions = await indexedSessions(this.settings.dataDir);
		}

		return this.sessions.get(key);
	}

	private async run(session: IndexedSession & { path: string }): Promise<void> {
		this.queue.shift();

		const started = performance.now();

		let outcome: CacheOutcome;

		try {
			outcome = await cacheSessionTelemetry(session, this.settings, {
				onStatus: (status) => this.states.set(session.key, status),
				keep: this.inUse()
			});
		} catch (error) {
			// The ledger could not be read or written; the sessions queued behind still run.
			outcome = {
				status: {
					state: 'failed',
					message: error instanceof Error ? error.message : String(error)
				},
				evicted: [],
				overBytes: 0,
				floorReached: false
			};
		}

		const { status } = outcome;

		this.states.set(session.key, status);

		if (status.state === 'unavailable') {
			this.unavailableSince.set(session.key, this.now().getTime());
		}

		this.log('telemetry-on-demand', {
			key: session.key,
			state: status.state,
			why:
				status.state === 'unavailable'
					? status.reason
					: status.state === 'failed'
						? status.message
						: null,
			evicted: outcome.evicted.map((evicted) => String(evicted.key)),
			elapsedMs: Math.round(performance.now() - started)
		});
	}
}
