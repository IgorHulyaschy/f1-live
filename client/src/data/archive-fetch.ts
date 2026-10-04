import type { TelemetryFetchStatus } from '@f1-live/shared';
import { z } from 'zod';

const statusSchema: z.ZodType<TelemetryFetchStatus> = z.discriminatedUnion('state', [
	z.object({ state: z.literal('idle') }),
	z.object({ state: z.literal('queued'), ahead: z.int().nonnegative() }),
	z.object({
		state: z.literal('fetching'),
		receivedBytes: z.number().nonnegative(),
		totalBytes: z.number().nonnegative().nullable()
	}),
	z.object({ state: z.literal('building') }),
	z.object({ state: z.literal('ready') }),
	z.object({ state: z.literal('unavailable'), reason: z.string() }),
	z.object({ state: z.literal('failed'), message: z.string() })
]);

/** The server's `/telemetry-fetch` endpoint; null when the server fetches nothing on demand. */
export type ArchiveFetchApi = {
	request: (sessionKey: string) => Promise<TelemetryFetchStatus | null>;
	status: (sessionKey: string) => Promise<TelemetryFetchStatus | null>;
};

export function apiArchiveFetch(apiUrl: string): ArchiveFetchApi {
	async function call(sessionKey: string, method: 'GET' | 'POST') {
		const response = await fetch(`${apiUrl}/telemetry-fetch/${encodeURIComponent(sessionKey)}`, {
			method
		});

		// A server without the archive cache, or a static host, has no such path.
		if (response.status === 404 || response.status === 405) {
			return null;
		}

		if (!response.ok) {
			throw new Error(`${method} telemetry-fetch failed with ${response.status}`);
		}

		return statusSchema.parse(await response.json());
	}

	return {
		request: (sessionKey) => call(sessionKey, 'POST'),
		status: (sessionKey) => call(sessionKey, 'GET')
	};
}

/** Still under way on the server, so worth asking again. */
export function isUnderWay(status: TelemetryFetchStatus | null): boolean {
	return status?.state === 'queued' || status?.state === 'fetching' || status?.state === 'building';
}

const POLL_MS = 1000;

type Watch = {
	status: TelemetryFetchStatus | null;
	started: boolean;
	listeners: Set<() => void>;
};

/**
 * Older sessions' telemetry the page asked the server to fetch from the archive, one watch per
 * session shared by every tile: started once, asked again every second while under way.
 */
export class ArchiveFetches {
	private readonly api: ArchiveFetchApi;
	private readonly pollMs: number;
	private readonly watches = new Map<string, Watch>();
	private readonly readyListeners = new Set<(sessionKey: string) => void>();

	constructor(api: ArchiveFetchApi, pollMs = POLL_MS) {
		this.api = api;
		this.pollMs = pollMs;
	}

	/** The session's fetch as last heard; null before it starts or when the server has none. */
	get(sessionKey: string): TelemetryFetchStatus | null {
		return this.watches.get(sessionKey)?.status ?? null;
	}

	subscribe(sessionKey: string, listener: () => void): () => void {
		const watch = this.watch(sessionKey);

		watch.listeners.add(listener);

		return () => watch.listeners.delete(listener);
	}

	/** Called once a session's telemetry is ready, before the tiles hear of it. */
	onReady(listener: (sessionKey: string) => void): () => void {
		this.readyListeners.add(listener);

		return () => this.readyListeners.delete(listener);
	}

	/** Asks the server for the session's telemetry once per page; `retry` asks again after a failure. */
	start(sessionKey: string, retry = false): void {
		const watch = this.watch(sessionKey);

		if (watch.started && !(retry && watch.status?.state === 'failed')) {
			return;
		}

		watch.started = true;
		void this.follow(sessionKey, () => this.api.request(sessionKey));
	}

	private watch(sessionKey: string): Watch {
		let watch = this.watches.get(sessionKey);

		if (!watch) {
			watch = { status: null, started: false, listeners: new Set() };
			this.watches.set(sessionKey, watch);
		}

		return watch;
	}

	private async follow(
		sessionKey: string,
		ask: () => Promise<TelemetryFetchStatus | null>
	): Promise<void> {
		let status: TelemetryFetchStatus | null;

		try {
			status = await ask();
		} catch (error) {
			status = {
				state: 'failed',
				message: error instanceof Error ? error.message : 'Unknown error'
			};
		}

		const watch = this.watch(sessionKey);

		watch.status = status;

		if (status?.state === 'ready') {
			for (const listener of this.readyListeners) {
				listener(sessionKey);
			}
		}

		for (const listener of watch.listeners) {
			listener();
		}

		if (isUnderWay(status)) {
			setTimeout(
				() => void this.follow(sessionKey, () => this.api.status(sessionKey)),
				this.pollMs
			);
		}
	}
}

function megabytes(bytes: number): string {
	return `${Math.round(bytes / 1e6)} MB`;
}

/** What a map says while the server fetches its session's positions; null when nothing is under way. */
export function describeFetch(status: TelemetryFetchStatus | null): string | null {
	switch (status?.state) {
		case 'queued':
			return status.ahead === 0
				? 'Car positions requested from the archive.'
				: `Car positions queued behind ${status.ahead} other ${status.ahead === 1 ? 'session' : 'sessions'}.`;
		case 'fetching':
			if (status.receivedBytes === 0) {
				return 'Fetching car positions from the archive.';
			}

			return status.totalBytes === null || status.totalBytes === 0
				? `Fetching car positions from the archive: ${megabytes(status.receivedBytes)}.`
				: `Fetching car positions from the archive: ${Math.floor((100 * status.receivedBytes) / status.totalBytes)}% (${megabytes(status.receivedBytes)} of ${megabytes(status.totalBytes)}).`;
		case 'building':
			return 'Building the replay from the car positions.';
		case 'failed':
			return `The car positions could not be fetched: ${status.message}`;
		default:
			return null;
	}
}

/** The stage alone, without the bytes: what a screen reader hears, once per stage. */
export function describeStage(status: TelemetryFetchStatus | null): string | null {
	return status?.state === 'fetching'
		? describeFetch({ ...status, receivedBytes: 0 })
		: describeFetch(status);
}
